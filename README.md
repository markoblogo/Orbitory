# Orbitory

Orbitory is a personal ecosystem map for owned and partner websites, blogs, social profiles, channels, and related online resources. The MVP is local-first: it will analyze only URLs explicitly listed in local project data and report broken links, redirects, orphan resources, one-way links, and missing obvious links.

This is not a SaaS product, a whole-internet SEO crawler, or an AI-powered tool.

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- Local YAML/JSON data files for the MVP
- npm

## Local Setup

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run validate-data
```

## Project Structure

```text
src/app         Next.js routes and app shell
src/components  Reusable UI components
src/lib         Reusable Orbitory logic
data            Local resource data and fixtures
scripts         Local crawl/report scripts
```

## MVP Boundaries

- No authentication.
- No database.
- No external SEO APIs.
- No Google, Bing, Ahrefs, or social API integrations.
- No AI, LLM APIs, embeddings, or external AI tools inside the product.
- Only configured local URLs should be crawled.

## Local Data

The safe demo dataset lives at `data/resources.yaml`. For private local data, create `data/resources.local.yaml`; Orbitory loads that file when it exists and falls back to the demo dataset otherwise. The local file is ignored by git.

Validate the active dataset with:

```bash
npm run validate-data
```
