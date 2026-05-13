import assert from "node:assert/strict";
import test from "node:test";
import {
  createKnownResourceMatcher,
  normalizeUrlForMatch,
  resolveConfiguredCrawlUrl,
} from "../src/lib/urlMatching";
import type { Resource } from "../src/lib/types";

const baseResource: Resource = {
  id: "atlas-home",
  name: "Atlas Home",
  url: "https://example.com/path/",
  type: "website",
  projectId: "atlas",
  owner: "mine",
  priority: "high",
  status: "active",
  editable: true,
  tags: [],
  crawl: {
    enabled: true,
  },
};

test("normalizeUrlForMatch ignores trailing slash, hash, and common tracking params", () => {
  assert.equal(
    normalizeUrlForMatch(
      "https://Example.com/path/?utm_source=newsletter&fbclid=abc&keep=1#section",
    ),
    "https://example.com/path?keep=1",
  );
});

test("normalizeUrlForMatch preserves protocol differences", () => {
  assert.notEqual(
    normalizeUrlForMatch("http://example.com/path"),
    normalizeUrlForMatch("https://example.com/path"),
  );
});

test("createKnownResourceMatcher matches known resources after normalization", () => {
  const matchKnownResource = createKnownResourceMatcher([baseResource]);

  assert.equal(
    matchKnownResource("https://example.com/path?utm_campaign=test")?.resource.id,
    "atlas-home",
  );
});

test("createKnownResourceMatcher does not match unknown resources", () => {
  const matchKnownResource = createKnownResourceMatcher([baseResource]);

  assert.equal(matchKnownResource("https://other.example.com/path"), null);
});

test("resolveConfiguredCrawlUrl resolves explicit paths against the resource URL", () => {
  assert.equal(
    resolveConfiguredCrawlUrl("https://example.com/base/page", "/about"),
    "https://example.com/about",
  );
});
