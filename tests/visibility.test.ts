import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { loadResources } from "../src/lib/loadResources";
import { filterPublicData } from "../src/lib/visibility";
import type { OrbitoryData, Resource } from "../src/lib/types";

test("filterPublicData keeps only public projects and public resources", () => {
  const data = makeVisibilityData();
  const publicData = filterPublicData(data);

  assert.deepEqual(
    publicData.projects.map((project) => project.id),
    ["public-project"],
  );
  assert.deepEqual(
    publicData.resources.map((resource) => resource.id).sort(),
    ["mine-public", "partner-public"].sort(),
  );
});

test("filterPublicData removes edges touching private or unlisted resources", () => {
  const data = makeVisibilityData();
  const publicData = filterPublicData(data);

  assert.deepEqual(publicData.manualEdges, [
    {
      from: "mine-public",
      to: "partner-public",
      type: "known",
    },
  ]);
});

test("demo data includes public resources for the public ecosystem map", () => {
  const demoData = loadResources(path.join(process.cwd(), "data", "resources.yaml"));
  const publicData = filterPublicData(demoData);

  assert.ok(publicData.projects.length > 0);
  assert.ok(publicData.resources.length > 0);
});

function makeVisibilityData(): OrbitoryData {
  return {
    projects: [
      {
        id: "public-project",
        name: "Public Project",
        visibility: "public",
        tags: [],
      },
      {
        id: "private-project",
        name: "Private Project",
        visibility: "private",
        tags: [],
      },
    ],
    resources: [
      resource("mine-public", "public-project", "public", "mine"),
      resource("partner-public", "public-project", "public", "partner"),
      resource("private-resource", "public-project", "private", "mine"),
      resource("unlisted-resource", "public-project", "unlisted", "mine"),
      resource("hidden-project-resource", "private-project", "public", "mine"),
    ],
    manualEdges: [
      {
        from: "mine-public",
        to: "partner-public",
        type: "known",
      },
      {
        from: "mine-public",
        to: "private-resource",
        type: "known",
      },
      {
        from: "hidden-project-resource",
        to: "mine-public",
        type: "known",
      },
    ],
  };
}

function resource(
  id: string,
  projectId: string,
  visibility: Resource["visibility"],
  owner: Resource["owner"],
): Resource {
  return {
    id,
    name: id,
    url: `https://example.com/${id}`,
    type: "website",
    projectId,
    owner,
    visibility,
    priority: "medium",
    status: "active",
    editable: true,
    tags: [],
    crawl: {
      enabled: false,
    },
  };
}
