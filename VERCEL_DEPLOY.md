# Deploying Our Space to Vercel

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- Your code pushed to a GitHub/GitLab/Bitbucket repository

## Quick Deploy

### 1. Push to Git

```bash
git add -A
git commit -m "Add Vercel deployment config"
git push origin main
```

### 2. Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** on your `Our_Space` repository
3. Vercel auto-detects the config from `vercel.json` — no framework preset needed
4. Click **Deploy**

### 3. Set Environment Variables

In the Vercel Dashboard → **Settings** → **Environment Variables**, add:

| Variable | Value | Required |
|----------|-------|----------|
| `JWT_SECRET` | Random 64-char hex string | ✅ |
| `JWT_REFRESH_SECRET` | Different random 64-char hex string | ✅ |
| `NODE_ENV` | `production` | ✅ |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | ✅ |

> **Generate secrets** with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 4. Redeploy

After setting env vars, trigger a redeploy:
**Deployments** → click the `...` menu on the latest → **Redeploy**

---

## How It Works

```
your-app.vercel.app
├── /              → Vite SPA (client/dist/index.html)
├── /finance       → SPA fallback → index.html
├── /api/auth/*    → Serverless Function (api/index.js → Express)
├── /api/posts/*   → Serverless Function (api/index.js → Express)
└── /api/health    → Serverless Function (api/index.js → Express)
```

- **Client**: Built with `vite build` and served as static files
- **Server**: The Express app runs as a single Vercel Serverless Function
- **Routing**: `vercel.json` rewrites `/api/*` to the function, everything else to the SPA

## Local Development

Nothing changes for local development:

```bash
# Terminal 1 — API server
cd server && npm run dev

# Terminal 2 — Vite dev server (with proxy to API)
cd client && npm run dev
```

Or use Vercel CLI to simulate production locally:

```bash
npm i -g vercel
vercel dev
```

## Important Notes

### ⚠️ SQLite on Vercel

Vercel serverless functions have an **ephemeral filesystem**. The SQLite database is stored in `/tmp` and will be reset on cold starts. This is fine for demos and testing.

**For production persistence**, consider:
- [Turso](https://turso.tech) — Cloud-hosted SQLite (free tier, easy migration)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) — Managed PostgreSQL

### ⚠️ File Uploads

Uploaded files (images, videos, audio) are stored in `/tmp/uploads` on Vercel and are **not persistent**. For production file storage, consider:
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) — Simple file storage
- [Cloudflare R2](https://developers.cloudflare.com/r2/) — S3-compatible, free egress
- [AWS S3](https://aws.amazon.com/s3/) — Industry standard

### Custom Domain

1. Go to **Settings** → **Domains** in Vercel Dashboard
2. Add your domain
3. Update `CORS_ORIGIN` env var to match your domain
