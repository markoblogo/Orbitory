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
npm run validate:data
npm run crawl
npm run test
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

## Private vs Public Mode

- `/` is the private audit dashboard. It may show private resources, partner/internal data, broken links, crawler issues, owner labels, and recommendations. Do not deploy `/` publicly without authentication or another access control layer.
- `/public` is the public-safe curated map. It only renders projects and resources marked `visibility: public`; it does not show issues, broken links, recommendations, private notes, or editable flags.
- `visibility` defaults to `private` for both projects and resources. Mark data as public explicitly before expecting it to appear on `/public`.

## Weekly Snapshots

The workflow at `.github/workflows/weekly-snapshot.yml` runs once per week and can also be started manually from GitHub Actions. It installs dependencies, validates local data, runs the bounded crawler, builds the app, and commits `data/snapshots/latest.json` only when the snapshot changes.

The crawler does not follow arbitrary discovered links. It only fetches resources and paths explicitly configured in `data/resources.yaml`. Individual unreachable resources are recorded in the snapshot as issues instead of crashing the run; data validation failures still fail the workflow clearly.

To disable weekly snapshots, remove or comment out the `schedule` block in `.github/workflows/weekly-snapshot.yml`. Manual runs remain available while `workflow_dispatch` is present.
