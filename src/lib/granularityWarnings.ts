import type { OrbitoryData, Resource } from "./types";

export type GranularityWarning = {
  resourceId: string;
  resourceName: string;
  url: string;
  reason: string;
  suggestedParent?: string;
};

const bookArticleTerms = [
  "book",
  "books",
  "article",
  "articles",
  "post",
  "posts",
  "essay",
  "essays",
  "pdf",
  "download",
  "repo",
  "repository",
];

export function findGranularityWarnings(
  data: OrbitoryData,
): GranularityWarning[] {
  const warnings: GranularityWarning[] = [];
  const knownHosts = new Map<string, Resource[]>();

  data.resources.forEach((resource) => {
    const host = getHost(resource.url);

    if (!host) {
      return;
    }

    knownHosts.set(host, [...(knownHosts.get(host) ?? []), resource]);
  });

  data.resources.forEach((resource) => {
    const url = safeUrl(resource.url);

    if (!url) {
      return;
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    const siblingHostResources = knownHosts.get(url.hostname.toLowerCase()) ?? [];
    const parentResource = siblingHostResources.find(
      (candidate) =>
        candidate.id !== resource.id && isRootOrProfileUrl(candidate.url),
    );

    if (isMarkoblogoGithubRepository(url)) {
      warnings.push({
        resourceId: resource.id,
        resourceName: resource.name,
        url: resource.url,
        reason:
          "GitHub repository URLs under github.com/markoblogo/* should usually be evidence on the github-markoblogo resource, not separate resources.",
        suggestedParent: "https://github.com/markoblogo",
      });
      return;
    }

    if (
      parentResource &&
      pathSegments.length >= 1 &&
      url.hostname.toLowerCase() === getHost(parentResource.url)
    ) {
      warnings.push({
        resourceId: resource.id,
        resourceName: resource.name,
        url: resource.url,
        reason:
          "This URL is a path on a domain that already has a parent resource. Internal pages should usually be evidence, tags, or context.",
        suggestedParent: parentResource.url,
      });
      return;
    }

    if (
      pathSegments.some((segment) =>
        bookArticleTerms.some((term) => segment.toLowerCase().includes(term)),
      ) ||
      bookArticleTerms.some((term) => resource.id.includes(term))
    ) {
      warnings.push({
        resourceId: resource.id,
        resourceName: resource.name,
        url: resource.url,
        reason:
          "This resource looks book/article/download-like. It should usually be represented as evidence or context on a coarse resource.",
      });
    }
  });

  return warnings.sort(
    (first, second) =>
      first.resourceId.localeCompare(second.resourceId) ||
      first.url.localeCompare(second.url),
  );
}

function safeUrl(rawUrl: string) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function getHost(rawUrl: string) {
  return safeUrl(rawUrl)?.hostname.toLowerCase() ?? null;
}

function isRootOrProfileUrl(rawUrl: string) {
  const url = safeUrl(rawUrl);

  if (!url) {
    return false;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (pathSegments.length === 0) {
    return true;
  }

  return url.hostname === "github.com" && pathSegments.length === 1;
}

function isMarkoblogoGithubRepository(url: URL) {
  const pathSegments = url.pathname.split("/").filter(Boolean);

  return (
    url.hostname.toLowerCase() === "github.com" &&
    pathSegments[0]?.toLowerCase() === "markoblogo" &&
    pathSegments.length > 1
  );
}
