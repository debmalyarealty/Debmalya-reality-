# Debmalya Realty — Setup, Owner Bootstrap & Deployment Guide

## 1. Architecture Overview
- **Frontend**: React 19, TypeScript, Tailwind CSS v4 (Dual-Theme Dark Navy/Gold & Light Cream/Sage), Framer Motion (`motion/react`), Lucide Icons, React Router.
- **Backend & Database**: Express (`server.ts`) + Node built-in SQLite (`node:sqlite`, persisted to `./data/debmalya.sqlite`) + File Uploads (`/uploads`), HMAC-SHA256 HTTP-only session cookies, salted `scrypt` password hashing, and strict server-side RBAC (`owner` vs `customer`).
- **Supabase Migration**: A complete PostgreSQL + Row Level Security (RLS) migration script is also provided at `/supabase/migrations/001_initial_schema.sql` if you wish to host on Supabase Postgres.

## 2. Environment Variables (`.env.example`)
- `APP_URL` — Public deployment URL (used for `sitemap.xml`, `robots.txt`, and session signing).
- `SESSION_SECRET` — Optional strong random string for signing session cookies in production.
- `PORT` — Server port (defaults to `3000`).

## 3. Initial Owner Account Bootstrap (One-Time Security Flow)
1. Navigate to `/owner-login`.
2. When no owner account exists in the database, the page displays the **One-Time Owner Account Bootstrap** form.
3. Submit the owner's full name, email, phone, and a strong password (minimum 8 characters).
4. The server creates the owner profile, assigns `role = 'owner'` server-side, and **permanently locks** `/api/auth/owner-bootstrap` (subsequent calls return `403`).
5. Public registration (`/api/auth/register`) always enforces `role = 'customer'` and never permits role escalation.

## 4. Managing Listings & Replacing Sample Data
- The initial database seeds 5 sample Siliguri listings tagged `Sample Listing` (`is_demo = true`) so search, filters, and the Cover Flow carousel work immediately.
- Sign in at `/owner-login` to open `/owner-login/dashboard`, where you can edit, unpublish, or delete sample listings, upload property photos (`JPEG/PNG/WebP <= 5 MB`), add team members, moderate client reviews, approve/reschedule site visits, and update business info or logos.

## 5. Build & Deployment
```bash
npm install
npm run lint
npm run build
npm run start
```
