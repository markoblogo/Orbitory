# AGENTS.md

This repository is for Orbitory, a personal ecosystem visualizer for owned and partner web resources. Keep work small, deterministic, and easy to inspect.

## Project Overview

- **Project:** Orbitory
- **Purpose:** Visualize a local list of websites, blogs, social profiles, channels, partner pages, and related online resources.
- **Public domain:** `orbitory.abvx.xyz` eventually; deployment is not required yet.
- **Product shape:** Personal/local tool, not SaaS.

Orbitory helps the owner see:

- what resources exist,
- how resources link to each other,
- what is missing,
- what is broken,
- what obvious links should be added.

## Hard Constraints

- Do not build a SaaS product.
- Do not build a whole-internet SEO crawler.
- Do not use AI, LLM APIs, embeddings, or external AI tools inside the product.
- Do not integrate Google, Bing, Ahrefs, social APIs, or external SEO APIs at this stage.
- Only analyze URLs explicitly listed by the user in local project data.
- Prefer simple, inspectable, deterministic logic over complex automation.
- Prioritize a working MVP over clever abstractions.
- Keep private/internal data separate from public/demo data.
- Do not add authentication in the first version.
- Do not add a database in the first version unless clearly justified and approved.

## MVP Goals

1. Maintain a local list of resources: websites, blogs, social profiles, channels, partner pages.
2. Store metadata: name, URL, type, project/group, owner, priority, tags, status, editable flag.
3. Build a graph of resources and links.
4. Crawl only explicitly configured URLs and detect links between known resources.
5. Detect broken links, redirects, orphan resources, one-way links, and missing obvious links.
6. Render an interactive visual graph.
7. Generate a clear local report with findings and recommendations.

## Preferred Stack

- TypeScript
- Next.js with App Router
- React
- Tailwind CSS
- Local YAML/JSON data files for MVP
- npm, unless the repository already uses another package manager

## Architecture Rules

- Keep core logic in reusable library modules.
- Do not hide important parsing, crawling, scoring, graph, or recommendation logic inside UI components.
- Keep UI components focused on rendering and interaction.
- Use deterministic parsing and recommendation rules.
- Keep private/internal datasets separate from demo/public datasets.
- Make data formats readable and easy to edit by hand.

Suggested initial structure:

```text
src/
  app/
  components/
  lib/
    resources/
    crawl/
    graph/
    report/
data/
  demo/
  private/
tests/
```

## Data Rules

- Local YAML or JSON files are the source of truth for the MVP.
- Only crawl URLs present in the configured local data.
- Treat external links that are not known resources as outbound references, not crawl targets.
- Do not store secrets in data files.
- Do not commit private/internal data unless explicitly intended.
- Prefer demo fixtures for tests and examples.

## Expected Scripts

When the project is scaffolded, add or maintain scripts in `package.json` for:

```bash
npm run lint
npm run typecheck
npm run test
npm run crawl
npm run report
```

Use existing script names if the repository later establishes different conventions.

## Testing Expectations

- Add deterministic tests for parsing, URL normalization, scoring, graph generation, and recommendation logic.
- Use fixtures that do not depend on live third-party services.
- Keep network-facing tests separate from pure unit tests.
- Prefer small tests with clear expected outputs.

## Development Workflow

- Read the README and existing code before changing behavior.
- Make small, reviewable changes.
- Change existing code before adding new systems.
- Avoid broad refactors unless explicitly requested.
- Do not upgrade frameworks or tooling unless requested.
- If requirements are ambiguous, ask one precise question or make the smallest reversible assumption and state it.
- Before finishing, run relevant checks or explain why they could not be run.

## Ask Before Doing

Ask for confirmation before:

- adding a database,
- adding authentication,
- adding external APIs,
- adding AI/LLM features,
- changing build tooling or CI,
- introducing major dependencies,
- deleting user data or private files,
- doing large refactors.

## Definition Of Done

A change is complete only when:

- behavior matches the request,
- the diff is minimal and readable,
- relevant tests/checks were run or clearly documented,
- README or docs are updated when behavior or commands change,
- no private data, secrets, or unrelated changes are included.

## Output Protocol

When finishing work, include:

- Summary of what changed,
- Files changed,
- Verification commands run or recommended,
- Risks or assumptions, if any.
