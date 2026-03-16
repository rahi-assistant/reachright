# ReachRight

## What This Is
AI-powered business growth platform for local businesses. Scans Google Maps to find businesses with weak online presence, scores them, and offers website/SEO services.

## Tech Stack
- Next.js 16, React 19, Tailwind CSS 4, TypeScript
- Package manager: `bun`
- Hosting: Vercel (auto-deploy from main branch)
- Domain: reachright.app (DNS on GCP Cloud DNS → Vercel)
- API: Google Maps Places API (New) for business search

## Key Files
- `app/page.tsx` — Landing page with live scanner demo
- `app/api/scan/route.ts` — Google Maps scan API endpoint
- `app/layout.tsx` — Root layout with SEO metadata
- `app/globals.css` — Design system CSS variables

## Scanner Script (offline)
- Path: `~/clawd/scripts/reachright/scanner.py`
- DB: `~/clawd/data/reachright.db` (SQLite, scanned businesses)
- Uses `pass show google/maps-api-key` for API key

## Environment
- `GOOGLE_MAPS_API_KEY` — Google Maps Places API key (set in Vercel env vars and .env.local)

## Design Principles
- Target audience: local business owners + digital marketing agencies in India
- Warm, approachable, NOT generic dark SaaS
- Scanner demo is the hero — show real data
- WhatsApp as primary CTA (standard in India)
- Mobile-first (most visitors will be on phone)

## Don't
- Don't expose API key in client-side code
- Don't use generic AI aesthetic (purple gradients, Inter font, cookie-cutter cards)
- Don't overcomplicate — this is a lead gen landing page, not a SaaS app
