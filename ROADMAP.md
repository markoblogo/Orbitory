# ROADMAP

## Phase 1: Local Inventory And Graph

- Maintain local YAML data for projects, resources, and manual edges.
- Validate data strictly before use.
- Render a deterministic interactive ecosystem graph.
- Keep private/local data separate from committed demo data.

## Phase 2: Crawler And Snapshots

- Crawl only explicitly configured resources and paths.
- Extract ecosystem links from HTML.
- Record status, redirects, fetch errors, and found edges.
- Save human-readable snapshots in `data/snapshots/latest.json`.

## Phase 3: Recommendations

- Add deterministic rule-based recommendations.
- Explain every recommendation with rule IDs, severity, confidence, and actions.
- Avoid AI, embeddings, semantic services, and external SEO APIs.

## Phase 4: Public Ecosystem Page

- Provide a curated `/public` page.
- Show only projects and resources marked `visibility: public`.
- Exclude private audit details, issues, broken links, and recommendations.

## Phase 5: Optional Open-Source Polish

- Improve documentation and examples.
- Add more fixtures and tests.
- Refine graph layout for larger inventories.
- Add optional export/report formats.
- Add authentication before exposing the private dashboard.
