import assert from "node:assert/strict";
import test from "node:test";
import { findGranularityWarnings } from "../src/lib/granularityWarnings";
import type { OrbitoryData, Resource } from "../src/lib/types";

test("findGranularityWarnings flags internal pages below a known domain resource", () => {
  const warnings = findGranularityWarnings(
    makeData([
      resource("abvx-home", "ABVX", "https://abvx.xyz/"),
      resource("abvx-about", "About", "https://abvx.xyz/about"),
    ]),
  );

  assert.equal(warnings[0]?.resourceId, "abvx-about");
  assert.match(warnings[0]?.reason ?? "", /path on a domain/);
});

test("findGranularityWarnings flags markoblogo GitHub repositories", () => {
  const warnings = findGranularityWarnings(
    makeData([
      resource("github-markoblogo", "GitHub", "https://github.com/markoblogo"),
      resource(
        "orbitory-repo",
        "Orbitory Repository",
        "https://github.com/markoblogo/Orbitory",
      ),
    ]),
  );

  assert.equal(warnings[0]?.resourceId, "orbitory-repo");
  assert.match(warnings[0]?.reason ?? "", /GitHub repository/);
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
