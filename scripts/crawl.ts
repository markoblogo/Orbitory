import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadResources } from "../src/lib/loadResources";
import {
  createKnownResourceMatcher,
  normalizeUrlForMatch,
  resolveConfiguredCrawlUrl,
} from "../src/lib/urlMatching";
import type { OrbitoryData, Resource } from "../src/lib/types";

const DATA_PATH = path.join(process.cwd(), "data", "resources.yaml");
const SNAPSHOT_PATH = path.join(process.cwd(), "data", "snapshots", "latest.json");
const USER_AGENT = "OrbitoryLocalCrawler/0.1 (+https://orbitory.abvx.xyz)";
const FETCH_TIMEOUT_MS = 10_000;

type CrawlTarget = {
  resource: Resource;
  url: string;
};

type FoundEdge = {
  from: string;
  to: string;
  sourceUrl: string;
  linkUrl: string;
  normalizedLinkUrl: string;
};

type PageStatus = {
  resourceId: string;
  requestedUrl: string;
  finalUrl?: string;
  status?: number;
  ok: boolean;
  redirected: boolean;
  contentType?: string;
  linksExtracted: number;
  knownLinksFound: number;
  error?: string;
};

type CrawlIssue = {
  type: "broken_page" | "redirect" | "fetch_error" | "not_html" | "resource_not_crawled";
  resourceId: string;
  url: string;
  message: string;
  status?: number;
  finalUrl?: string;
};

type CrawlSnapshot = {
  generatedAt: string;
  resourcesChecked: number;
  pagesFetched: number;
  foundEdges: FoundEdge[];
  pageStatuses: PageStatus[];
  issues: CrawlIssue[];
};

async function main() {
  const data = loadResources(DATA_PATH);
  const targets = buildCrawlTargets(data);
  const matchKnownResource = createKnownResourceMatcher(data.resources);
  const foundEdges = new Map<string, FoundEdge>();
  const pageStatuses: PageStatus[] = [];
  const issues: CrawlIssue[] = [];
  const successfulFetchesByResource = new Map<string, number>();

  for (const target of targets) {
    const pageResult = await fetchPage(target);
    pageStatuses.push(pageResult.pageStatus);
    addIssuesForPageStatus(pageResult.pageStatus, issues);

    if (!pageResult.html) {
      continue;
    }

    const extractedLinks = extractHtmlLinks(pageResult.html, pageResult.pageStatus.finalUrl ?? target.url);
    const matchedResourceIds = new Set<string>();

    for (const linkUrl of extractedLinks) {
      const match = matchKnownResource(linkUrl);

      if (!match || match.resource.id === target.resource.id) {
        continue;
      }

      matchedResourceIds.add(match.resource.id);

      const edge: FoundEdge = {
        from: target.resource.id,
        to: match.resource.id,
        sourceUrl: target.url,
        linkUrl,
        normalizedLinkUrl: match.normalizedUrl,
      };

      foundEdges.set(
        `${edge.from}|${edge.to}|${normalizeUrlForMatch(edge.sourceUrl)}|${edge.normalizedLinkUrl}`,
        edge,
      );
    }

    pageResult.pageStatus.linksExtracted = extractedLinks.length;
    pageResult.pageStatus.knownLinksFound = matchedResourceIds.size;
    successfulFetchesByResource.set(
      target.resource.id,
      (successfulFetchesByResource.get(target.resource.id) ?? 0) + 1,
    );
  }

  data.resources
    .filter((resource) => resource.crawl.enabled)
    .forEach((resource) => {
      if (!successfulFetchesByResource.has(resource.id)) {
        issues.push({
          type: "resource_not_crawled",
          resourceId: resource.id,
          url: resource.url,
          message: `No configured pages could be crawled for resource "${resource.id}".`,
        });
      }
    });

  const snapshot: CrawlSnapshot = {
    generatedAt: new Date().toISOString(),
    resourcesChecked: data.resources.filter((resource) => resource.crawl.enabled).length,
    pagesFetched: pageStatuses.length,
    foundEdges: [...foundEdges.values()].sort(sortFoundEdges),
    pageStatuses: pageStatuses.sort(sortPageStatuses),
    issues: issues.sort(sortIssues),
  };

  mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `Wrote ${path.relative(process.cwd(), SNAPSHOT_PATH)}: ${snapshot.resourcesChecked} resources, ${snapshot.pagesFetched} pages, ${snapshot.foundEdges.length} found edges, ${snapshot.issues.length} issues.`,
  );
}

function buildCrawlTargets(data: OrbitoryData): CrawlTarget[] {
  const targetsByUrl = new Map<string, CrawlTarget>();

  data.resources
    .filter((resource) => resource.crawl.enabled)
    .sort((first, second) => first.id.localeCompare(second.id))
    .forEach((resource) => {
      addTarget(targetsByUrl, resource, resource.url);

      for (const configuredPath of resource.crawl.paths ?? []) {
        addTarget(
          targetsByUrl,
          resource,
          resolveConfiguredCrawlUrl(resource.url, configuredPath),
        );
      }
    });

  return [...targetsByUrl.values()].sort((first, second) =>
    first.url.localeCompare(second.url),
  );
}

function addTarget(
  targetsByUrl: Map<string, CrawlTarget>,
  resource: Resource,
  rawUrl: string,
) {
  const normalizedUrl = normalizeUrlForMatch(rawUrl);

  if (!normalizedUrl || targetsByUrl.has(normalizedUrl)) {
    return;
  }

  targetsByUrl.set(normalizedUrl, {
    resource,
    url: rawUrl,
  });
}

async function fetchPage(target: CrawlTarget): Promise<{
  html: string | null;
  pageStatus: PageStatus;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target.url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? undefined;
    const redirectLocation = response.headers.get("location");
    const redirected = isRedirectStatus(response.status);
    const finalUrl = redirectLocation
      ? new URL(redirectLocation, target.url).toString()
      : response.url;
    const pageStatus: PageStatus = {
      resourceId: target.resource.id,
      requestedUrl: target.url,
      finalUrl,
      status: response.status,
      ok: response.ok,
      redirected,
      contentType,
      linksExtracted: 0,
      knownLinksFound: 0,
    };

    if (redirected || !response.ok || !isHtmlContent(contentType)) {
      return {
        html: null,
        pageStatus,
      };
    }

    return {
      html: await response.text(),
      pageStatus,
    };
  } catch (error) {
    return {
      html: null,
      pageStatus: {
        resourceId: target.resource.id,
        requestedUrl: target.url,
        ok: false,
        redirected: false,
        linksExtracted: 0,
        knownLinksFound: 0,
        error: getErrorMessage(error),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function addIssuesForPageStatus(pageStatus: PageStatus, issues: CrawlIssue[]) {
  if (pageStatus.error) {
    issues.push({
      type: "fetch_error",
      resourceId: pageStatus.resourceId,
      url: pageStatus.requestedUrl,
      message: pageStatus.error,
    });
    return;
  }

  if (pageStatus.status !== undefined && pageStatus.status >= 400) {
    issues.push({
      type: "broken_page",
      resourceId: pageStatus.resourceId,
      url: pageStatus.requestedUrl,
      status: pageStatus.status,
      finalUrl: pageStatus.finalUrl,
      message: `Page returned HTTP ${pageStatus.status}.`,
    });
  }

  if (pageStatus.redirected) {
    issues.push({
      type: "redirect",
      resourceId: pageStatus.resourceId,
      url: pageStatus.requestedUrl,
      status: pageStatus.status,
      finalUrl: pageStatus.finalUrl,
      message: `Page redirected to ${pageStatus.finalUrl}.`,
    });
  }

  if (
    pageStatus.ok &&
    pageStatus.contentType &&
    !isHtmlContent(pageStatus.contentType)
  ) {
    issues.push({
      type: "not_html",
      resourceId: pageStatus.resourceId,
      url: pageStatus.requestedUrl,
      status: pageStatus.status,
      finalUrl: pageStatus.finalUrl,
      message: `Page returned non-HTML content type "${pageStatus.contentType}".`,
    });
  }
}

function extractHtmlLinks(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  for (const match of html.matchAll(/\shref\s*=\s*["']([^"']+)["']/gi)) {
    addResolvedUrl(urls, match[1], baseUrl);
  }

  for (const match of html.matchAll(
    /<link\b(?=[^>]*\brel\s*=\s*["'][^"']*\bcanonical\b[^"']*["'])(?=[^>]*\bhref\s*=\s*["']([^"']+)["'])[^>]*>/gi,
  )) {
    addResolvedUrl(urls, match[1], baseUrl);
  }

  for (const match of html.matchAll(
    /<meta\b(?=[^>]*(?:\bproperty|\bname)\s*=\s*["']og:url["'])(?=[^>]*\bcontent\s*=\s*["']([^"']+)["'])[^>]*>/gi,
  )) {
    addResolvedUrl(urls, match[1], baseUrl);
  }

  return [...urls].sort();
}

function addResolvedUrl(urls: Set<string>, rawUrl: string | undefined, baseUrl: string) {
  if (!rawUrl || rawUrl.startsWith("#")) {
    return;
  }

  try {
    const url = new URL(rawUrl, baseUrl);

    if (url.protocol === "http:" || url.protocol === "https:") {
      urls.add(url.toString());
    }
  } catch {
    return;
  }
}

function isHtmlContent(contentType: string | undefined) {
  return !contentType || contentType.toLowerCase().includes("text/html");
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function sortFoundEdges(first: FoundEdge, second: FoundEdge) {
  return (
    first.from.localeCompare(second.from) ||
    first.to.localeCompare(second.to) ||
    first.sourceUrl.localeCompare(second.sourceUrl) ||
    first.normalizedLinkUrl.localeCompare(second.normalizedLinkUrl)
  );
}

function sortPageStatuses(first: PageStatus, second: PageStatus) {
  return (
    first.resourceId.localeCompare(second.resourceId) ||
    first.requestedUrl.localeCompare(second.requestedUrl)
  );
}

function sortIssues(first: CrawlIssue, second: CrawlIssue) {
  return (
    first.resourceId.localeCompare(second.resourceId) ||
    first.type.localeCompare(second.type) ||
    first.url.localeCompare(second.url)
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return `Fetch timed out after ${FETCH_TIMEOUT_MS}ms.`;
  }

  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
