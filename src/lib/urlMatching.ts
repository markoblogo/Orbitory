import type { Resource } from "./types";

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_NAMES = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "mc_cid",
  "mc_eid",
]);

export type KnownResourceMatch = {
  resource: Resource;
  normalizedUrl: string;
};

export function normalizeUrlForMatch(rawUrl: string): string | null {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const name of [...url.searchParams.keys()]) {
    const lowerName = name.toLowerCase();
    const isTrackingParam =
      TRACKING_PARAM_NAMES.has(lowerName) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => lowerName.startsWith(prefix));

    if (isTrackingParam) {
      url.searchParams.delete(name);
    }
  }

  url.searchParams.sort();

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

export function createKnownResourceMatcher(resources: Resource[]) {
  const resourceByNormalizedUrl = new Map<string, Resource>();

  resources.forEach((resource) => {
    const normalizedUrl = normalizeUrlForMatch(resource.url);

    if (normalizedUrl) {
      resourceByNormalizedUrl.set(normalizedUrl, resource);
    }
  });

  return function matchKnownResource(rawUrl: string): KnownResourceMatch | null {
    const normalizedUrl = normalizeUrlForMatch(rawUrl);

    if (!normalizedUrl) {
      return null;
    }

    const resource = resourceByNormalizedUrl.get(normalizedUrl);

    return resource ? { resource, normalizedUrl } : null;
  };
}

export function resolveConfiguredCrawlUrl(baseUrl: string, pathOrUrl: string) {
  return new URL(pathOrUrl, baseUrl).toString();
}
