import assert from "node:assert/strict";
import test from "node:test";
import { buildGraph } from "../src/lib/buildGraph";
import type { CrawlSnapshot, OrbitoryData, Resource } from "../src/lib/types";

test("buildGraph aggregates multiple found links between the same resources into one edge", () => {
  const data = makeData([
    resource("source", "Source", "https://source.example/"),
    resource("target", "Target", "https://target.example/"),
  ]);
  const snapshot: CrawlSnapshot = {
    generatedAt: "2026-05-13T00:00:00.000Z",
    resourcesChecked: 1,
    pagesFetched: 2,
    foundEdges: [
      {
        from: "source",
        to: "target",
        sourceUrl: "https://source.example/a",
        linkUrl: "https://target.example/",
        normalizedLinkUrl: "https://target.example/",
        context: "href",
        anchorText: "Target",
      },
      {
        from: "source",
        to: "target",
        sourceUrl: "https://source.example/b",
        linkUrl: "https://target.example/",
        normalizedLinkUrl: "https://target.example/",
        context: "canonical",
      },
    ],
    pageStatuses: [],
    issues: [],
  };

  const graph = buildGraph(data, snapshot, { includeRecommendations: false });
  const edge = graph.edges.find(
    (candidate) => candidate.from === "source" && candidate.to === "target",
  );

  assert.equal(edge?.category, "found");
  assert.equal(edge?.linkCount, 2);
  assert.equal(edge?.evidence.length, 2);
});

function makeData(resources: Resource[]): OrbitoryData {
  return {
    projects: [
      {
        id: "project",
        name: "Project",
        visibility: "public",
        tags: [],
      },
    ],
    resources,
    manualEdges: [],
  };
}

function resource(id: string, name: string, url: string): Resource {
  return {
    id,
    name,
    url,
    type: "website",
    projectId: "project",
    owner: "mine",
    visibility: "public",
    priority: "medium",
    status: "active",
    editable: true,
    tags: [],
    crawl: {
      enabled: false,
    },
  };
}
