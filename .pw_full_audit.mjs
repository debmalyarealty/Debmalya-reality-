import { chromium } from '/usr/local/share/bun-global/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:3000';
const CHROME =
  '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';

const TEST_PROPERTIES = [
  {
    id: 'test-prop-1',
    slug: 'sevoke-skyline-3bhk-test',
    title: '3 BHK Skyline Balcony Residence — Sevoke Road With Extra Long Title Test',
    description: 'Spacious architectural residence off Sevoke Road with panoramic views.',
    price: 6850000,
    listing_type: 'buy',
    category: 'Flats / Apartments',
    location: 'Sevoke Road',
    address_detail: 'Near Ward 13, Sevoke Road',
    bedrooms: 3,
    bathrooms: 2,
    area_sqft: 1580,
    furnishing: 'Semi-Furnished',
    parking: '1 Covered Car Parking',
    status: 'available',
    is_published: true,
    is_featured: true,
    amenities: ['Lift', 'Power Backup', '24x7 Security', 'Covered Parking', 'Balcony'],
    images: [
      '/src/assets/images/prop_sevoke_apartment_1795102917013.jpg',
      '/src/assets/images/prop_interior_suite_1795102917447.jpg',
      '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
    ],
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'test-prop-2',
    slug: 'bhanu-nagar-duplex-villa-test',
    title: '4 BHK Independent Duplex Villa — Bhanu Nagar',
    description: 'Independent villa with private lawn in peaceful Bhanu Nagar.',
    price: 13500000,
    listing_type: 'buy',
    category: 'Villas',
    location: 'Bhanu Nagar',
    address_detail: 'Dasrath Pally, Bhanu Nagar',
    bedrooms: 4,
    bathrooms: 4,
    area_sqft: 2650,
    furnishing: 'Fully Furnished',
    parking: '2 Covered Parking Bays',
    status: 'available',
    is_published: true,
    is_featured: true,
    amenities: ['Private Garden', 'Solar Heating', 'CCTV Perimeter'],
    images: [
      '/src/assets/images/prop_bhanu_house_1795102916929.jpg',
      '/src/assets/images/hero_siliguri_villa_1795102916572.jpg',
    ],
    created_at: '2026-11-19T10:00:00.000Z',
    updated_at: '2026-11-19T10:00:00.000Z',
  },
  {
    id: 'test-prop-3',
    slug: 'central-2bhk-rental-test',
    title: 'Furnished Executive 2 BHK Suite — Siliguri Central',
    description: 'Move-in ready furnished rental residence.',
    price: 28000,
    listing_type: 'rent',
    category: 'Flats / Apartments',
    location: 'Siliguri',
    address_detail: 'Central Residential Pocket',
    bedrooms: 2,
    bathrooms: 2,
    area_sqft: 1180,
    furnishing: 'Fully Furnished',
    parking: '1 Covered Parking',
    status: 'available',
    is_published: true,
    is_featured: false,
    amenities: ['Lift', 'Air Conditioning', 'Power Backup'],
    images: [
      '/src/assets/images/prop_interior_suite_1795102917447.jpg',
      '/src/assets/images/prop_sevoke_apartment_1795102917013.jpg',
    ],
    created_at: '2026-11-18T10:00:00.000Z',
    updated_at: '2026-11-18T10:00:00.000Z',
  },
];

const TEST_REVIEWS = [
  {
    id: 'rev-1',
    name: 'Anirban Chatterjee',
    email: 'anirban@example.com',
    category: 'Home Buyer',
    rating: 5,
    text: 'Debmalya Realty guided our entire flat purchase on Sevoke Road with complete honesty, transparent documentation checks, boundary verification, bank coordination, and timely site visits at every milestone without any hidden surprises or delays at all.',
    status: 'approved',
    is_featured: true,
    created_at: '2026-11-22T09:30:00.000Z',
  },
  {
    id: 'rev-2',
    name: 'Rituparna Sen',
    email: 'ritu@example.com',
    category: 'Villa Client',
    rating: 5,
    text: 'Smooth process from first visit to registration in Bhanu Nagar.',
    status: 'approved',
    is_featured: true,
    created_at: '2026-11-18T14:00:00.000Z',
  },
];

const failures = [];
function assert(cond, msg) {
  if (!cond) {
    failures.push(msg);
    console.error('FAIL:', msg);
  }
}

async function setupSupabaseMocks(page, options = {}) {
  const {
    emptyReviews = false,
    role = 'client',
    loginFails = false,
    signupNeedsConfirm = true,
  } = options;

  const userId = role === 'owner' ? 'owner-uuid-1' : 'client-uuid-1';
  const userEmail = role === 'owner' ? 'owner@debmalya.in' : 'client@example.com';
  const fakeJwt = 'header.' + Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.sig';
  const fakeSession = {
    access_token: fakeJwt,
    refresh_token: 'refresh-tok-1',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email: userEmail,
      role: 'authenticated',
      user_metadata: { full_name: role === 'owner' ? 'Debmalya Owner' : 'Test Buyer', phone: '9876543210' },
    },
  };

  let resendCalls = 0;

  await page.route('https://jrnmqbetkixxhpjhktqm.supabase.co/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.includes('/auth/v1/token')) {
      const urlObj = new URL(url);
      const grant = urlObj.searchParams.get('grant_type');
      if (grant === 'password' && loginFails) {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeSession),
      });
    }

    if (url.includes('/auth/v1/signup')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          signupNeedsConfirm
            ? { id: userId, email: 'newuser@example.com', user: { id: userId, email: 'newuser@example.com' }, session: null }
            : fakeSession
        ),
      });
    }

    if (url.includes('/auth/v1/resend')) {
      resendCalls += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    }

    if (url.includes('/auth/v1/user')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fakeSession.user),
      });
    }

    if (url.includes('/rest/v1/properties')) {
      if (url.includes('slug=eq.')) {
        const slugMatch = decodeURIComponent(url.split('slug=eq.')[1].split('&')[0]);
        const found = TEST_PROPERTIES.find((p) => p.slug === slugMatch) || TEST_PROPERTIES[0];
        const accept = req.headers()['accept'] || '';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(accept.includes('vnd.pgrst.object') ? found : [found]),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PROPERTIES),
      });
    }

    if (url.includes('/rest/v1/reviews')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(emptyReviews ? [] : TEST_REVIEWS),
      });
    }

    if (url.includes('/rest/v1/profiles')) {
      const profile = {
        id: userId,
        email: userEmail,
        full_name: role === 'owner' ? 'Debmalya Owner' : 'Test Buyer',
        phone: '9876543210',
        city: 'Siliguri',
        role,
        created_at: '2026-10-01T10:00:00.000Z',
      };
      const accept = req.headers()['accept'] || '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accept.includes('vnd.pgrst.object') ? profile : [profile]),
      });
    }

    if (url.includes('/rest/v1/site_settings')) {
      const accept = req.headers()['accept'] || '';
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accept.includes('vnd.pgrst.object') ? null : []),
      });
    }

    if (url.includes('/rest/v1/')) {
      if (method === 'GET') {
        const accept = req.headers()['accept'] || '';
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(accept.includes('vnd.pgrst.object') ? null : []),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }

    return route.continue();
  });

  return {
    getResendCalls: () => resendCalls,
  };
}

const browser = await chromium.launch({ executablePath: CHROME });

try {
  console.log('--- 1. Running D1 + D2 Responsive Matrix ---');
  const matrixViewports = [
    { name: '320-port', width: 320, height: 568 },
    { name: '320-land', width: 568, height: 320 },
    { name: '360-port', width: 360, height: 740 },
    { name: '390-port', width: 390, height: 844 },
    { name: '390-land', width: 844, height: 390 },
    { name: '412-port', width: 412, height: 915 },
    { name: '412-land', width: 915, height: 412 },
    { name: '768', width: 768, height: 1024 },
    { name: '1024', width: 1024, height: 768 },
    { name: '1440', width: 1440, height: 900 },
  ];

  for (const theme of ['light', 'dark']) {
    for (const vp of matrixViewports) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
      });
      await ctx.addInitScript((t) => {
        localStorage.setItem('debmalya_theme', t);
        localStorage.setItem('dr_signin_prompt_shown', '1');
      }, theme);
      const page = await ctx.newPage();
      await setupSupabaseMocks(page);

      for (const routePath of ['/', '/properties', '/properties/sevoke-skyline-3bhk-test']) {
        await page.goto(`${BASE}${routePath}`, { waitUntil: 'load' });
        await page.waitForTimeout(450);

        const audit = await page.evaluate(() => {
          const sw = document.documentElement.scrollWidth;
          const iw = window.innerWidth;
          const tinyTargets = [];
          const els = document.querySelectorAll('a, button, input, select, textarea');
          for (const el of els) {
            const st = getComputedStyle(el);
            if (st.display === 'none' || st.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) continue;
            if (el instanceof HTMLInputElement && el.type === 'checkbox') continue;
            if (r.width < 43.5 || r.height < 43.5) {
              tinyTargets.push({
                tag: el.tagName,
                text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 35),
                w: Math.round(r.width),
                h: Math.round(r.height),
              });
            }
          }
          return { sw, iw, tinyTargets };
        });

        assert(
          audit.sw <= audit.iw,
          `${theme} ${vp.name} ${routePath}: horizontal scroll (${audit.sw} > ${audit.iw})`
        );
        assert(
          audit.tinyTargets.length === 0,
          `${theme} ${vp.name} ${routePath}: tiny touch targets: ${JSON.stringify(audit.tinyTargets)}`
        );

        if (vp.width < 768 && routePath === '/properties') {
          await page.waitForSelector('article.property-card-container', { timeout: 5000 });
          const cardCheck = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('article.property-card-container'));
            if (cards.length < 2) return { count: cards.length };
            const imgBox = cards[0].querySelector('div.relative');
            const ir = imgBox?.getBoundingClientRect();
            const r0 = cards[0].getBoundingClientRect();
            const r1 = cards[1].getBoundingClientRect();
            const text = cards[0].innerText;
            return {
              count: cards.length,
              oneColumn: r1.top >= r0.bottom - 2,
              tallPhoto: ir ? ir.height > ir.width : false,
              hasInr: text.includes('₹68.5 Lakh'),
              hasBadge: text.includes('Buy · Available'),
              hasViewDetails: text.includes('View details'),
            };
          });
          assert(cardCheck.count >= 2, `${theme} ${vp.name} /properties should render >=2 cards`);
          assert(cardCheck.oneColumn, `${theme} ${vp.name} /properties cards not 1-col on phone`);
          assert(cardCheck.tallPhoto, `${theme} ${vp.name} /properties cover photo not tall`);
          assert(cardCheck.hasInr && cardCheck.hasBadge && cardCheck.hasViewDetails, `${theme} ${vp.name} card text missing INR/badge/View details`);
        }

        if (vp.width < 768 && routePath === '/properties/sevoke-skyline-3bhk-test') {
          await page.waitForSelector('[data-testid="gallery-counter"]', { timeout: 5000 });
          const detailCheck = await page.evaluate(() => {
            const counter = document.querySelector('[data-testid="gallery-counter"]')?.textContent?.trim();
            const specs = document.querySelector('[data-testid="property-key-specs"]');
            const specCols = specs ? Array.from(specs.children) : [];
            const firstTop = specCols[0]?.getBoundingClientRect().top ?? 0;
            const singleRow =
              specCols.length === 4 &&
              specCols.every((c) => Math.abs(c.getBoundingClientRect().top - firstTop) < 8);
            const stickyBar = document.querySelector('[data-testid="property-sticky-bottom-bar"]');
            const callWaBar = document.querySelector('[data-testid="mobile-bottom-action-bar"]');
            return {
              counter,
              singleRow,
              hasStickyBar: Boolean(stickyBar && stickyBar.getBoundingClientRect().height > 40),
              stickyText: stickyBar?.textContent || '',
              hasCallWaBar: Boolean(callWaBar),
            };
          });
          assert(detailCheck.counter === '1/3', `${theme} ${vp.name} counter expected 1/3 got ${detailCheck.counter}`);
          assert(detailCheck.singleRow, `${theme} ${vp.name} property specs not on 1 row`);
          assert(detailCheck.hasStickyBar, `${theme} ${vp.name} sticky Book a visit bar missing`);
          assert(detailCheck.stickyText.includes('₹68.5 Lakh') && detailCheck.stickyText.includes('Book a visit'), `${theme} ${vp.name} sticky bar text mismatch`);
          assert(!detailCheck.hasCallWaBar, `${theme} ${vp.name} Call/WhatsApp bar should NOT render on property detail`);
        }
      }

      if (vp.width <= 412 || vp.height <= 420) {
        await page.goto(`${BASE}/`, { waitUntil: 'load' });
        await page.waitForTimeout(250);
        await page.click('button[aria-label="Open navigation menu"]');
        await page.waitForTimeout(300);
        const drawerBox = await page.evaluate(() => {
          const d = document.querySelector('aside#universal-nav-drawer');
          if (!d) return null;
          const r = d.getBoundingClientRect();
          return { h: r.height, vh: window.innerHeight, sw: d.scrollWidth, cw: d.clientWidth };
        });
        assert(drawerBox && drawerBox.h <= drawerBox.vh * 0.91, `${theme} ${vp.name} drawer exceeds 90dvh (${JSON.stringify(drawerBox)})`);
        await page.click('button[aria-label="Close navigation menu"]');
        await page.waitForTimeout(200);

        await page.click('button[aria-label="Create account or log in"]');
        await page.waitForTimeout(250);
        const modalBox = await page.evaluate(() => {
          const m = document.querySelector('[role="dialog"][aria-modal="true"] > div');
          if (!m) return null;
          const r = m.getBoundingClientRect();
          return { h: r.height, vh: window.innerHeight, w: r.width, vw: window.innerWidth };
        });
        assert(modalBox && modalBox.h <= modalBox.vh * 0.91 && modalBox.w <= modalBox.vw, `${theme} ${vp.name} auth modal overflow`);
      }

      await ctx.close();
    }
  }

  console.log('--- 2. Running D2 Gallery Swipe, Reviews, and Empty Reviews ---');
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('dr_signin_prompt_shown', '1'));
    const page = await ctx.newPage();
    await setupSupabaseMocks(page, { emptyReviews: false });

    await page.goto(`${BASE}/properties/sevoke-skyline-3bhk-test`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="gallery-counter"]', { timeout: 5000 });
    await page.waitForTimeout(300);
    const gallery = page.locator('section[aria-label="Property Image Gallery"] > div').first();
    const box = await gallery.boundingBox();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.5, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const counterAfterSwipe = await page.locator('[data-testid="gallery-counter"]').textContent();
    assert(counterAfterSwipe?.trim() === '2/3', `Gallery swipe expected 2/3, got ${counterAfterSwipe}`);

    await page.locator('[data-testid="property-sticky-bottom-bar"] button').click();
    await page.waitForTimeout(250);
    const visitPanelText = await page.locator('#property-enquiry-panel').innerText();
    assert(visitPanelText.includes('Book a site visit'), 'Sticky Book a visit button did not open visit option');

    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(450);
    const reviewCheck = await page.evaluate(() => {
      const sec = document.getElementById('reviews');
      if (!sec) return null;
      const text = sec.innerText;
      const prevBtn = sec.querySelector('button[aria-label="Previous review"]');
      const nextBtn = sec.querySelector('button[aria-label="Next review"]');
      const readMore = Array.from(sec.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Read more')
      );
      return {
        hasFormattedDate: text.includes('22 Nov 2026'),
        hasArrows: Boolean(prevBtn && nextBtn),
        hasReadMore: Boolean(readMore),
      };
    });
    assert(reviewCheck?.hasFormattedDate, 'Review date not formatted as 22 Nov 2026');
    assert(reviewCheck?.hasArrows, 'Review carousel arrows missing');
    assert(reviewCheck?.hasReadMore, 'Long review missing Read more toggle');
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('dr_signin_prompt_shown', '1'));
    const page = await ctx.newPage();
    await setupSupabaseMocks(page, { emptyReviews: true });
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(450);
    const emptyCheck = await page.evaluate(() => {
      const sec = document.getElementById('reviews');
      if (!sec) return null;
      const buttons = Array.from(sec.querySelectorAll('button')).filter(
        (b) => b.getBoundingClientRect().width > 0
      );
      return {
        text: sec.innerText,
        btnCount: buttons.length,
        btnText: buttons[0]?.textContent?.trim(),
      };
    });
    assert(emptyCheck?.text.includes('No reviews yet'), 'Empty reviews message missing');
    assert(emptyCheck?.btnCount === 1 && emptyCheck?.btnText?.includes('Share your experience'), `Empty reviews button mismatch: ${JSON.stringify(emptyCheck)}`);
    await ctx.close();
  }

  console.log('--- 3. Running Auth Flow + Callback + Dashboard Audits ---');
  for (const w of [320, 390, 412]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('dr_signin_prompt_shown', '1'));
    const page = await ctx.newPage();
    const { getResendCalls } = await setupSupabaseMocks(page, {
      loginFails: true,
      signupNeedsConfirm: true,
    });

    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForTimeout(300);

    await page.click('button[aria-label="Create account or log in"]');
    await page.waitForTimeout(300);

    const authRegisterAudit = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (!dlg) return null;
      const text = dlg.textContent || '';
      const tabs = Array.from(dlg.querySelectorAll('[role="tab"]')).map((t) => ({
        text: t.textContent?.trim(),
        selected: t.getAttribute('aria-selected'),
        hasSvg: Boolean(t.querySelector('svg')),
      }));
      const closeBtn = dlg.querySelector('button[aria-label="Close dialog"]');
      const hasName = Boolean(dlg.querySelector('#auth-fullname'));
      const hasPhone = Boolean(dlg.querySelector('#auth-phone'));
      const hasEmail = Boolean(dlg.querySelector('#auth-email'));
      const hasPass = Boolean(dlg.querySelector('#auth-password'));
      const hasCity = Boolean(dlg.querySelector('#auth-city'));
      const hasGuest = text.toLowerCase().includes('continue as guest');
      return {
        tabs,
        hasCloseX: Boolean(closeBtn),
        hasName,
        hasPhone,
        hasEmail,
        hasPass,
        hasCity,
        hasGuest,
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      };
    });
    assert(authRegisterAudit?.tabs[0]?.text === 'Create account' && authRegisterAudit?.tabs[0]?.selected === 'true' && authRegisterAudit?.tabs[0]?.hasSvg, `${w}px default view not Create account tab`);
    assert(authRegisterAudit?.tabs[1]?.text === 'Log in' && authRegisterAudit?.tabs[1]?.hasSvg, `${w}px Log in tab missing icon/label`);
    assert(authRegisterAudit?.hasName && authRegisterAudit?.hasPhone && authRegisterAudit?.hasEmail && authRegisterAudit?.hasPass, `${w}px missing required register fields`);
    assert(!authRegisterAudit?.hasCity, `${w}px City field should not be in Create account modal`);
    assert(!authRegisterAudit?.hasGuest && authRegisterAudit?.hasCloseX, `${w}px Continue as guest must be removed and X must stay`);
    assert(authRegisterAudit?.sw <= authRegisterAudit?.iw, `${w}px AuthModal caused horizontal scroll`);

    await page.fill('#auth-fullname', 'Priya Das');
    await page.fill('#auth-phone', '9876543210');
    await page.fill('#auth-email', 'priya@example.com');
    await page.fill('#auth-password', 'secret123');
    await page.click('button[type="submit"]:has-text("Create account")');
    await page.waitForSelector('[data-testid="auth-check-email-screen"]', { timeout: 5000 });
    await page.click('button:has-text("Resend email")');
    await page.waitForTimeout(300);
    const checkEmailText = await page.locator('[data-testid="auth-check-email-screen"]').innerText();
    assert(checkEmailText.includes('Check your email') && checkEmailText.includes('Verification email sent'), `${w}px Check your email / Resend failed`);
    assert(getResendCalls() >= 1, `${w}px Resend endpoint was not called`);

    await page.click('button:has-text("Back to Log in")');
    await page.waitForSelector('#auth-email');
    const passTypeBefore = await page.getAttribute('#auth-password', 'type');
    await page.click('button[aria-label="Show password"]');
    const passTypeAfter = await page.getAttribute('#auth-password', 'type');
    assert(passTypeBefore === 'password' && passTypeAfter === 'text', `${w}px eye toggle failed`);

    const forgotText = await page.locator('button:has-text("Forgot password?")').count();
    assert(forgotText === 1, `${w}px Forgot password missing on Log in`);

    await page.fill('#auth-email', 'wrong@example.com');
    await page.fill('#auth-password', 'wrongpass');
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForTimeout(350);
    const errText = await page.locator('[role="dialog"] [role="alert"]').textContent();
    const passClass = await page.getAttribute('#auth-password', 'class');
    assert(errText?.trim() === 'Incorrect email or password.', `${w}px wrong login error expected 'Incorrect email or password.', got '${errText}'`);
    assert(passClass?.includes('animate-shake-once'), `${w}px password field missing animate-shake-once on error`);

    await ctx.close();
  }

  for (const roleCase of ['client', 'owner']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('dr_signin_prompt_shown', '1'));
    const page = await ctx.newPage();
    await setupSupabaseMocks(page, { role: roleCase });

    await page.goto(`${BASE}/?code=pkce-verified-123&type=signup`, { waitUntil: 'load' });
    await page.waitForTimeout(700);

    const urlNow = new URL(page.url());
    const bodyText = await page.evaluate(() => document.body.innerText);
    const callWaBarCount = await page.locator('[data-testid="mobile-bottom-action-bar"]').count();
    const tableCount = await page.locator('table').count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

    const expectedPath = roleCase === 'owner' ? '/owner-dashboard' : '/my-account';
    assert(urlNow.pathname === expectedPath && !urlNow.search.includes('code='), `${roleCase} callback expected clean ${expectedPath}, got ${page.url()}`);
    assert(bodyText.includes('Email verified. Welcome!'), `${roleCase} callback welcome toast missing`);
    assert(callWaBarCount === 0, `${roleCase} dashboard must NEVER render Call/WhatsApp bar`);
    assert(tableCount === 0, `${roleCase} dashboard must not have raw HTML tables`);
    assert(!overflow, `${roleCase} dashboard has horizontal overflow at 390px`);

    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => localStorage.setItem('dr_signin_prompt_shown', '1'));
    const page = await ctx.newPage();
    const { getResendCalls } = await setupSupabaseMocks(page);

    await page.goto(
      `${BASE}/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
      { waitUntil: 'load' }
    );
    await page.waitForTimeout(450);

    const urlAfter = page.url();
    const modalText = await page.locator('[role="dialog"]').innerText();
    assert(!urlAfter.includes('error_code') && !urlAfter.includes('otp_expired'), `Expired callback did not clean URL: ${urlAfter}`);
    assert(modalText.includes('expired') && modalText.includes('Resend email'), 'Expired link screen or Resend email button missing');

    await page.fill('#auth-expired-email', 'client@example.com');
    await page.click('[role="dialog"] button:has-text("Resend email")');
    await page.waitForTimeout(300);
    assert(getResendCalls() >= 1, 'Expired link Resend email button failed');
    await ctx.close();
  }

  console.log('AUDIT COMPLETE. Total failures:', failures.length);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
