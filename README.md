# Orbitory

Orbitory is a local-first personal ecosystem map for owned and partner websites, blogs, social profiles, channels, directories, and related online resources. It helps you keep an inspectable inventory of resources, see how they link to each other, find obvious gaps, and generate a deterministic local snapshot of crawl results.

The eventual public surface can live at `orbitory.abvx.xyz`, but the current app is an MVP intended for local use and safe public-preview experiments.

## What Orbitory Is

- A local inventory of known resources.
- A deterministic graph of configured resources and known links.
- A bounded crawler for explicitly listed URLs only.
- A dashboard for broken pages, redirects, missing links, and recommendations.
- A public-safe curated map at `/public` for resources explicitly marked public.

## What Orbitory Is Not

- Not a SaaS product.
- Not a whole-internet crawler.
- Not a general SEO crawler.
- Not an AI, LLM, embeddings, or semantic-analysis product.
- Not integrated with Google, Bing, Ahrefs, social APIs, or external SEO APIs.
- Not protected by authentication yet.

## Current MVP Scope

- Store projects, resources, and manual edges in local YAML.
- Validate data strictly with zod.
- Load private local data from `data/resources.local.yaml` when present.
- Render an interactive private dashboard at `/`.
- Render a public-safe curated view at `/public`.
- Crawl only configured resources and paths.
- Extract HTML `href`, canonical, and `og:url` links.
- Match discovered links against known resources.
- Write snapshots to `data/snapshots/latest.json`.
- Generate deterministic rule-based recommendations.

## Why No AI Or External SEO APIs

Orbitory is meant to be predictable, inspectable, and private by default. The MVP avoids AI and external SEO APIs because:

- local data should not be sent to third-party analysis systems;
- recommendations should be explainable rule-by-rule;
- results should be reproducible from the same YAML and snapshot files;
- the crawler should only touch URLs you explicitly configure;
- the tool should remain simple enough to audit.

## Stack

- Next.js App Router
- TypeScript
- React
- Tailwind CSS
- zod
- Local YAML/JSON files
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

## Common Commands

```bash
npm run dev
npm run validate:data
npm run crawl
npm run build
```

Additional checks:

```bash
npm run lint
npm run typecheck
npm run test
```

## Data Model

Data lives in YAML and has three top-level collections:

- `projects`: groups of related resources.
- `resources`: websites, profiles, channels, directories, and other known URLs.
- `manualEdges`: known or intended relationships between resources.

Project fields:

- `id`
- `name`
- `description`
- `visibility`: `private`, `public`, or `unlisted`
- `tags`

Resource fields:

- `id`
- `name`
- `url`
- `type`: `website`, `blog`, `landing`, `social`, `video`, `newsletter`, `github`, `partner`, `directory`, or `other`
- `projectId`
- `owner`: `mine`, `partner`, or `external`
- `visibility`: `private`, `public`, or `unlisted`
- `priority`: `low`, `medium`, `high`, or `critical`
- `status`: `active`, `inactive`, `archived`, or `unknown`
- `editable`
- `tags`
- `crawl.enabled`
- `crawl.paths`

Manual edge fields:

- `from`
- `to`
- `type`: `intended`, `known`, `partner`, `owned-by`, or `related`
- `note`

`visibility` defaults to `private` for projects and resources when omitted.

## Example Data

Use `data/resources.example.yaml` as a small reference. Minimal example:

```yaml
projects:
  - id: example-project
    name: Example Project
    description: Safe public demo project.
    visibility: public
    tags:
      - demo

resources:
  - id: example-home
    name: Example Home
    url: https://example.com/
    type: website
    projectId: example-project
    owner: mine
    visibility: public
    priority: high
    status: active
    editable: true
    tags:
      - home
    crawl:
      enabled: true
      paths:
        - /

manualEdges:
  - from: example-home
    to: example-home
    type: related
    note: Self-reference only for demonstrating shape.
```

The checked-in `data/resources.yaml` contains fake `.example` demo data and is safe to commit.

## Private Data Safety

Real inventories should live in `data/resources.local.yaml`. That file is ignored by git and automatically overrides `data/resources.yaml` locally.

Recommended workflow:

1. Keep `data/resources.yaml` fake and demo-safe.
2. Put real private inventory in `data/resources.local.yaml`.
3. Run `npm run validate:data` before crawling or committing.
4. Check `git status` before every commit.
5. Never commit URLs, notes, or partner data that should stay private.

The `.gitignore` also excludes local/private YAML variants and local/private snapshot variants.

## Private vs Public Mode

- `/` is the private audit dashboard. It may show private resources, partner/internal data, broken links, crawler issues, owner labels, and recommendations. Do not deploy `/` publicly without authentication or another access-control layer.
- `/public` is the public-safe curated map. It only renders projects and resources marked `visibility: public`; it does not show issues, broken links, recommendations, private notes, or editable flags.
- Public mode is meant to feel like a curated ecosystem map, not an audit tool.

## Crawler

Run:

```bash
npm run crawl
```

The crawler:

- loads and validates `data/resources.yaml`;
- fetches only resources where `crawl.enabled` is true;
- fetches the main `url` and explicit `crawl.paths`;
- does not recursively follow discovered links;
- uses plain HTTP fetch with timeouts;
- records errors in `data/snapshots/latest.json`;
- does not use browser automation or external SEO APIs.

Unreachable resources are recorded as issues. Data validation failures still fail the run.

## Weekly Snapshots

`.github/workflows/weekly-snapshot.yml` runs once per week and can also be started manually from GitHub Actions. It:

1. checks out the repository;
2. sets up Node;
3. runs `npm ci`;
4. runs `npm run validate:data`;
5. runs `npm run crawl`;
6. runs `npm run build`;
7. commits `data/snapshots/latest.json` only when it changed.

To disable weekly snapshots, remove or comment out the `schedule` block. Manual runs remain available while `workflow_dispatch` is present.

## Project Structure

```text
src/app          Next.js routes
src/components   UI components
src/lib          data loading, graph, crawler helpers, recommendations
data             demo data and snapshots
scripts          local validation and crawler scripts
tests            deterministic unit tests
```

## Future Roadmap

- Improve graph layout for larger inventories.
- Add richer snapshot history instead of only `latest.json`.
- Add more deterministic recommendation rules.
- Add public publishing controls for curated maps.
- Add authentication before exposing the private dashboard.
- Add import/export helpers for larger local inventories.
- Add stronger report generation for weekly reviews.
