# AI Systems DNA

An interactive map of the core concepts behind production AI systems — LLMs, RAG, agents, MCP, evaluation, and orchestration — with learning paths from beginner to architect. Part of Clarent's AI DNA Framework.

Live site: https://aisystems.clarenttech.com

## Stack

- Vite + React + TypeScript, Tailwind CSS, lucide-react icons
- Supabase for concept content and the updates/waitlist form (falls back to `src/data/*.ts` if the database is unavailable)
- Deployed on Vercel from `main`

## Local development

```bash
npm install
cp .env.example .env   # add your Supabase URL and anon key
npm run dev
```

## Where content lives

- `src/data/concepts.ts`, `learningPaths.ts`, `roadmaps.ts` — built-in content (fallback)
- `supabase/migrations/` — database schema and seed content (what the live site reads)

Content currently exists in both places; edits need to be made in both until it's consolidated.

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-r4mnzqrr)
