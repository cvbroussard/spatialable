# CLAUDE.md — ModelVault

## Project Overview

Standalone 3D product model generation and asset library service. Generates GLB files from product images using an automated pipeline: Meshy API (mesh), Claude Vision (material ID), headless Blender/Modal (PBR material application). Assets stored in Cloudflare R2.

Dev code: **ModelVault**. RetailSpec is the first API client.

## Tech Stack

- **Framework**: Next.js (App Router), TypeScript (strict: false)
- **Database**: Neon (serverless PostgreSQL) via `@neondatabase/serverless`
- **Storage**: Cloudflare R2 via `@aws-sdk/client-s3`
- **Pipeline**: Inngest (orchestration), Modal (headless Blender GPU)
- **AI**: Vercel AI SDK + `@ai-sdk/anthropic` (material identification)
- **3D**: Meshy API (mesh generation)
- **Auth**: API key (Bearer token, bcryptjs hash comparison)

## Commands

```bash
npm run dev       # Dev server (localhost:3000)
npm run build     # Production build
node scripts/create-database.js    # Create/update DB schema
node scripts/create-client.js      # Register API client
node scripts/seed-materials.js     # Seed material library
```

## Auth

No NextAuth. API-first service using Bearer token API keys. Keys are bcrypt-hashed in the `clients` table. Use `scripts/create-client.js` to generate.

## Environment Variables

See `.env.local.example`. Required: `DATABASE_URL`, `R2_*`, `MESHY_API_KEY`, `ANTHROPIC_API_KEY`, `INNGEST_*`.

## Path Alias

`@/*` maps to project root (e.g., `@/lib/db`, `@/lib/r2/client`).
