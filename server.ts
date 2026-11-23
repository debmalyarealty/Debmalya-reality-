import fs from 'node:fs';
import path from 'node:path';
import express, { type Request } from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getWebsiteSettings,
  hydrateProperties,
  initDatabase,
  UPLOADS_DIR,
} from './server/db';
import { apiRouter } from './server/routes';
import {
  injectRuntimeConfigIntoHtml,
  resolveRuntimeSupabaseConfig,
} from './server/supabaseConfig';
import {
  buildPropertyMetaTags,
  buildSiteMetaTags,
  injectMetaIntoHtml,
  resolveServerOrigin,
  type PageMetaConfig,
} from './src/lib/metaTags';

dotenv.config();
dotenv.config({ path: '.env.local', override: false });

function resolvePageMetaForRequest(req: Request): PageMetaConfig {
  const origin = resolveServerOrigin(
    process.env.APP_URL,
    req.protocol,
    req.get('host')
  );
  const settings = getWebsiteSettings();
  const pathname = req.path || '/';

  const propMatch = pathname.match(/^\/properties\/([^/]+)\/?$/);
  if (propMatch) {
    const slugOrId = decodeURIComponent(propMatch[1]);
    const row = db
      .prepare(
        'SELECT * FROM properties WHERE (slug = ? OR id = ?) AND is_published = 1'
      )
      .get(slugOrId, slugOrId) as Record<string, unknown> | undefined;

    if (row) {
      const [property] = hydrateProperties([row]);
      return buildPropertyMetaTags(property, {
        origin,
        pathname,
        settings,
      });
    }

    return buildSiteMetaTags({
      title: 'Property Not Found — Debmalya Realty',
      description:
        'The requested property listing could not be found. Browse verified properties across Siliguri with Debmalya Realty.',
      pathname,
      origin,
      robots: 'noindex, nofollow',
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  if (pathname === '/properties') {
    return buildSiteMetaTags({
      title: 'Properties in Siliguri — Debmalya Realty',
      description:
        'Browse verified flats, villas, houses, residential plots, and commercial spaces for sale or rent across Siliguri, Sevoke Road, Bhanu Nagar, and Haiderpara.',
      pathname,
      origin,
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  if (pathname === '/privacy-policy') {
    return buildSiteMetaTags({
      title: 'Privacy Policy — Debmalya Realty',
      description:
        'Read how Debmalya Realty collects, safeguards, and uses personal details submitted via property inquiries, site visit bookings, and customer accounts.',
      pathname,
      origin,
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  if (pathname === '/terms') {
    return buildSiteMetaTags({
      title: 'Terms & Conditions — Debmalya Realty',
      description:
        'Review terms governing property listings, pricing, site visit scheduling, and consultation services offered by Debmalya Realty in Siliguri.',
      pathname,
      origin,
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  if (pathname === '/disclaimer') {
    return buildSiteMetaTags({
      title: 'Disclaimer — Debmalya Realty',
      description:
        'Important property consultation disclaimer covering specifications, availability, and on-site verification for Debmalya Realty listings.',
      pathname,
      origin,
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  if (
    pathname.startsWith('/my-account') ||
    pathname.startsWith('/owner-login') ||
    pathname.startsWith('/owner-dashboard')
  ) {
    return buildSiteMetaTags({
      title:
        pathname.startsWith('/owner-login') ||
        pathname.startsWith('/owner-dashboard')
          ? 'Owner Portal — Debmalya Realty'
          : 'My Account — Debmalya Realty',
      pathname,
      origin,
      robots: 'noindex, nofollow',
      image: settings.hero_image_url,
      siteName: settings.business_name,
    });
  }

  return buildSiteMetaTags({
    pathname: '/',
    origin,
    image: settings.hero_image_url,
    siteName: settings.business_name,
  });
}

async function startServer() {
  initDatabase();

  const app = express();
  app.set('trust proxy', true);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded property/team/logo images safely
  app.use('/uploads', express.static(UPLOADS_DIR));

  // SEO robots.txt & dynamic sitemap.xml
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolveServerOrigin(
      process.env.APP_URL,
      req.protocol,
      req.get('host')
    );
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /owner-login\nDisallow: /owner-login/\nDisallow: /owner-dashboard\nDisallow: /my-account\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = resolveServerOrigin(
      process.env.APP_URL,
      req.protocol,
      req.get('host')
    );
    const props = db
      .prepare('SELECT slug, updated_at FROM properties WHERE is_published = 1')
      .all() as { slug: string; updated_at: string }[];

    const staticUrls = [
      '/',
      '/properties',
      '/privacy-policy',
      '/terms',
      '/disclaimer',
    ];

    const urlEntries = [
      ...staticUrls.map(
        (u) => `  <url><loc>${baseUrl}${u}</loc><changefreq>weekly</changefreq></url>`
      ),
      ...props.map(
        (p) =>
          `  <url><loc>${baseUrl}/properties/${p.slug}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod></url>`
      ),
    ].join('\n');

    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>`
    );
  });

  app.use('/api', apiRouter);

  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distDir)) {
    const distHtmlPath = path.join(distDir, 'index.html');
    const cachedTemplate = fs.readFileSync(distHtmlPath, 'utf-8');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res) => {
      const meta = resolvePageMetaForRequest(req);
      const htmlWithMeta = injectMetaIntoHtml(cachedTemplate, meta);
      const runtimeConfig = resolveRuntimeSupabaseConfig(process.env);
      const html = injectRuntimeConfigIntoHtml(htmlWithMeta, runtimeConfig);
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).send(html);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    const devHtmlPaths = [
      '/',
      '/properties',
      '/properties/:slug',
      '/privacy-policy',
      '/terms',
      '/disclaimer',
      '/my-account',
      '/owner-login',
      '/owner-login/dashboard',
      '/owner-dashboard',
    ];

    app.get(devHtmlPaths, async (req, res, next) => {
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const rawHtml = fs.readFileSync(indexPath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const meta = resolvePageMetaForRequest(req);
        const finalHtml = injectMetaIntoHtml(transformed, meta);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(finalHtml);
      } catch (err) {
        if (err instanceof Error) {
          vite.ssrFixStacktrace(err);
        }
        next(err);
      }
    });

    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Debmalya Realty server listening on http://localhost:${PORT}`);
  });
}

startServer();
