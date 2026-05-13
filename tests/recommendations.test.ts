import assert from "node:assert/strict";
import test from "node:test";
import { generateRecommendations } from "../src/lib/recommendations";
import type { CrawlSnapshot, OrbitoryData, Resource } from "../src/lib/types";

const baseResource = {
  url: "https://example.com/",
  owner: "mine",
  visibility: "public",
  priority: "medium",
  status: "active",
  editable: true,
  tags: [],
  crawl: {
    enabled: true,
  },
} satisfies Omit<Resource, "id" | "name" | "type" | "projectId">;

test("same_project_missing_link suggests a link when active same-project resources are unlinked", () => {
  const recommendations = generateRecommendations(
    makeData([
      resource("site", "Website", "website", ["primary"]),
      resource("blog", "Blog", "blog", ["writing"]),
    ]),
    null,
    20,
  );

  assertRecommendation(recommendations, "same_project_missing_link", "blog", "site");
});

test("important_resource_low_incoming suggests links to high or critical active resources", () => {
  const recommendations = generateRecommendations(
    makeData([
      resource("hub", "Hub", "website", ["hub"]),
      {
        ...resource("critical", "Critical", "landing", ["offer"]),
        priority: "critical",
      },
    ]),
    null,
    20,
  );

  assertRecommendation(
    recommendations,
    "important_resource_low_incoming",
    "hub",
    "critical",
  );
});

test("social_missing_website_link suggests adding website links from social resources", () => {
  const recommendations = generateRecommendations(
    makeData([
      resource("website", "Website", "website", ["home"]),
      resource("social", "Social", "social", ["profile"]),
    ]),
    null,
    20,
  );

  assertRecommendation(
    recommendations,
    "social_missing_website_link",
    "social",
    "website",
  );
});

test("website_missing_social_link suggests adding social links from websites", () => {
  const recommendations = generateRecommendations(
    makeData([
      resource("website", "Website", "website", ["home"]),
      resource("social", "Social", "social", ["profile"]),
    ]),
    null,
    20,
  );

  assertRecommendation(
    recommendations,
    "website_missing_social_link",
    "website",
    "social",
  );
});

test("shared_tags_missing_link suggests possible relations for resources sharing at least two tags", () => {
  const recommendations = generateRecommendations(
    makeData([
      resource("one", "One", "blog", ["writing", "tools", "demo"]),
      resource("two", "Two", "newsletter", ["writing", "tools"]),
    ]),
    null,
    20,
  );

  assertRecommendation(recommendations, "shared_tags_missing_link", "one", "two");
});

test("manual_edge_not_found suggests checking intended or known manual edges missing from crawl", () => {
  const data = makeData(
    [
      resource("from", "From", "website", ["home"]),
      resource("to", "To", "blog", ["writing"]),
    ],
    [{ from: "from", to: "to", type: "known" }],
  );
  const snapshot: CrawlSnapshot = {
    generatedAt: "2026-05-13T00:00:00.000Z",
    resourcesChecked: 2,
    pagesFetched: 2,
    foundEdges: [],
    pageStatuses: [],
    issues: [],
  };

  const recommendations = generateRecommendations(data, snapshot, 20);

  assertRecommendation(recommendations, "manual_edge_not_found", "from", "to");
});

function assertRecommendation(
  recommendations: ReturnType<typeof generateRecommendations>,
  type: string,
  from: string,
  to: string,
) {
  assert.ok(
    recommendations.some(
      (recommendation) =>
        recommendation.type === type &&
        recommendation.from === from &&
        recommendation.to === to,
    ),
    `Expected recommendation ${type} from ${from} to ${to}`,
  );
}

function makeData(
  resources: Resource[],
  manualEdges: OrbitoryData["manualEdges"] = [],
): OrbitoryData {
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
    manualEdges,
  };
}

function resource(
  id: string,
  name: string,
  type: Resource["type"],
  tags: string[],
): Resource {
  return {
    ...baseResource,
    id,
    name,
    type,
    projectId: "project",
    url: `https://example.com/${id}`,
    tags,
  };
}
