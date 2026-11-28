import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: 'Edge Function environment is not configured.' },
      500
    );
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  const jwtPayload = decodeJwtPayload(token);
  const jwtSub = typeof jwtPayload?.sub === 'string' ? jwtPayload.sub.trim() : '';

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(serviceRoleKey.split('.').length === 3
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`,
              apikey: serviceRoleKey,
            },
          },
        }
      : {}),
  });

  // Verify caller JWT server-side and read caller user id
  const {
    data: { user: caller },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !caller) {
    const msg = `Invalid or expired session: ${
      authError?.message || 'unable to verify caller JWT'
    }.`;
    console.error('[admin-client-actions] 401:', msg);
    return jsonResponse({ error: msg }, 401);
  }

  const callerId = caller.id || jwtSub;
  if (!UUID_REGEX.test(callerId)) {
    const msg = `Owner check failed: JWT did not contain a valid user id (got '${callerId}').`;
    console.error('[admin-client-actions] 403:', msg);
    return jsonResponse({ error: msg }, 403);
  }

  // Look up caller's role in public.profiles using the service-role client
  const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('id', callerId)
    .maybeSingle();

  if (callerProfileErr) {
    const msg = `Owner check failed: error querying public.profiles for user ${callerId} (${
      caller.email || 'no email'
    }): ${callerProfileErr.message}`;
    console.error('[admin-client-actions] 403:', msg);
    return jsonResponse({ error: msg }, 403);
  }

  if (!callerProfile) {
    const msg = `Owner check failed: no profile row found in public.profiles for user ${callerId} (${
      caller.email || 'no email'
    }).`;
    console.error('[admin-client-actions] 403:', msg);
    return jsonResponse({ error: msg }, 403);
  }

  const normalizedRole = String(callerProfile.role || '').trim().toLowerCase();
  if (normalizedRole !== 'owner') {
    const msg = `Owner check failed: user ${callerId} (${
      caller.email || callerProfile.email || 'no email'
    }) has role '${callerProfile.role ?? 'null'}' in public.profiles, expected 'owner'.`;
    console.error('[admin-client-actions] 403:', msg);
    return jsonResponse({ error: msg }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
  }

  const action = String(payload.action || '');

  if (action === 'delete-clients') {
    const rawIds = Array.isArray(payload.clientIds)
      ? payload.clientIds
      : payload.clientId
      ? [payload.clientId]
      : [];

    const clientIds = Array.from(
      new Set(
        rawIds
          .map((id) => String(id || '').trim())
          .filter((id) => UUID_REGEX.test(id))
      )
    );

    if (clientIds.length === 0) {
      return jsonResponse({ error: 'No valid client IDs provided.' }, 400);
    }

    if (clientIds.length > 50) {
      return jsonResponse(
        { error: 'Cannot delete more than 50 clients in a single request.' },
        400
      );
    }

    const normalizedCallerId = callerId.trim().toLowerCase();
    if (clientIds.some((id) => id.trim().toLowerCase() === normalizedCallerId)) {
      return jsonResponse(
        { error: 'You cannot delete the active owner account.' },
        403
      );
    }

    const { data: targetProfiles, error: targetErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .in('id', clientIds);

    if (targetErr) {
      return jsonResponse({ error: targetErr.message }, 500);
    }

    const profilesList = targetProfiles || [];
    const nonClient = profilesList.find(
      (p) => String(p.role || '').trim().toLowerCase() !== 'client'
    );
    if (nonClient) {
      return jsonResponse(
        { error: 'Owner accounts cannot be deleted from the client list.' },
        403
      );
    }

    const emailById = new Map<string, string>();
    for (const p of profilesList) {
      const cleanEmail = String(p.email || '').trim();
      if (cleanEmail) {
        emailById.set(String(p.id), cleanEmail);
      }
    }

    const deletedIds: string[] = [];

    for (const clientId of clientIds) {
      const clientEmail = emailById.get(clientId);

      // Clean all client-owned & client-associated records permanently
      const cleanups = await Promise.all([
        supabaseAdmin.from('favourites').delete().eq('user_id', clientId),
        supabaseAdmin.from('saved_searches').delete().eq('user_id', clientId),
        supabaseAdmin
          .from('customer_preferences')
          .delete()
          .eq('user_id', clientId),
        supabaseAdmin.from('bookings').delete().eq('user_id', clientId),
        supabaseAdmin.from('inquiries').delete().eq('user_id', clientId),
        supabaseAdmin.from('reviews').delete().eq('user_id', clientId),
      ]);

      const firstErr = cleanups.find((res) => res.error)?.error;
      if (firstErr) {
        return jsonResponse({ error: firstErr.message }, 500);
      }

      // Also clean inquiries/reviews submitted by this client's email prior to linking user_id
      if (clientEmail) {
        const extraCleanups = await Promise.all([
          supabaseAdmin
            .from('inquiries')
            .delete()
            .is('user_id', null)
            .ilike('email', clientEmail),
          supabaseAdmin
            .from('reviews')
            .delete()
            .is('user_id', null)
            .ilike('email', clientEmail),
        ]);
        const extraErr = extraCleanups.find((res) => res.error)?.error;
        if (extraErr) {
          return jsonResponse({ error: extraErr.message }, 500);
        }
      }

      const { error: profDelErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', clientId)
        .eq('role', 'client');

      if (profDelErr) {
        return jsonResponse({ error: profDelErr.message }, 500);
      }

      const { error: authDelErr } =
        await supabaseAdmin.auth.admin.deleteUser(clientId);
      if (
        authDelErr &&
        !String(authDelErr.message || '').toLowerCase().includes('not found')
      ) {
        return jsonResponse({ error: authDelErr.message }, 500);
      }

      deletedIds.push(clientId);
    }

    return jsonResponse({ ok: true, deletedIds });
  }

  if (action === 'set-client-password') {
    const clientId = String(payload.clientId || '').trim();
    const newPassword =
      typeof payload.newPassword === 'string' ? payload.newPassword : '';

    if (!UUID_REGEX.test(clientId)) {
      return jsonResponse({ error: 'Invalid client ID.' }, 400);
    }

    if (clientId.trim().toLowerCase() === callerId.trim().toLowerCase()) {
      return jsonResponse(
        { error: 'Use account settings to update your own owner password.' },
        403
      );
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      return jsonResponse(
        { error: 'Password must be between 8 and 128 characters.' },
        400
      );
    }

    const { data: targetProfile, error: targetErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', clientId)
      .maybeSingle();

    if (targetErr) {
      return jsonResponse({ error: targetErr.message }, 500);
    }

    if (
      !targetProfile ||
      String(targetProfile.role || '').trim().toLowerCase() !== 'client'
    ) {
      return jsonResponse(
        { error: 'Client account not found or cannot be modified.' },
        404
      );
    }

    const { error: updateErr } =
      await supabaseAdmin.auth.admin.updateUserById(clientId, {
        password: newPassword,
      });

    if (updateErr) {
      return jsonResponse({ error: updateErr.message }, 500);
    }

    // Never return the password back in the response payload
    return jsonResponse({ ok: true, clientId });
  }

  return jsonResponse({ error: 'Unsupported admin action.' }, 400);
});
