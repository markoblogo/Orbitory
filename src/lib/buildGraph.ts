import type {
  CrawlSnapshot,
  ManualEdge,
  OrbitoryData,
  PageStatusSnapshot,
  Project,
  Resource,
  ResourceOwner,
  ResourceType,
} from "./types";
import {
  generateRecommendations,
  type Recommendation,
} from "./recommendations";

export type EdgeCategory = "manual" | "found" | "both" | "broken" | "recommended";
export type CrawlStatus = "OK" | "redirected" | "broken" | "fetch error" | "not crawled";
export type GraphIssueCategory =
  | "broken_resource_page"
  | "broken_outbound_ecosystem_link"
  | "no_incoming_links"
  | "no_outgoing_links"
  | "manual_edge_not_found"
  | "recommendation";

export type GraphNode = {
  id: string;
  label: string;
  resource: Resource;
  project: Project | null;
  crawlStatus: CrawlStatus;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: ManualEdge["type"] | "found" | "broken" | "recommended";
  category: EdgeCategory;
  note?: string;
  sourceUrl?: string;
};

export type GraphIssue = {
  category: GraphIssueCategory;
  resourceId: string;
  title: string;
  message: string;
  relatedResourceId?: string;
  url?: string;
  recommendation?: Recommendation;
};

export type SnapshotSummary = {
  available: boolean;
  generatedAt?: string;
  resourcesChecked: number;
  pagesFetched: number;
  foundEcosystemLinks: number;
  issueCount: number;
};

export type EcosystemGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  issues: GraphIssue[];
  snapshotSummary: SnapshotSummary;
  projects: Project[];
  resourceTypes: ResourceType[];
  owners: ResourceOwner[];
};

type BuildGraphOptions = {
  includeRecommendations?: boolean;
};

export function buildGraph(
  data: OrbitoryData,
  snapshot: CrawlSnapshot | null = null,
  options: BuildGraphOptions = {},
): EcosystemGraph {
  const includeRecommendations = options.includeRecommendations ?? true;
  const projectsById = new Map(
    data.projects.map((project) => [project.id, project]),
  );
  const resourceIds = new Set(data.resources.map((resource) => resource.id));
  const crawlStatusByResourceId = buildCrawlStatusByResourceId(data, snapshot);

  const nodes = data.resources.map((resource) => ({
    id: resource.id,
    label: resource.name,
    resource,
    project: resource.projectId
      ? (projectsById.get(resource.projectId) ?? null)
      : null,
    crawlStatus: crawlStatusByResourceId.get(resource.id) ?? "not crawled",
  }));

  const edges = buildEdges(data.manualEdges, snapshot, resourceIds);
  const recommendations = includeRecommendations
    ? generateRecommendations(data, snapshot)
    : [];
  const recommendedEdges = buildRecommendedEdges(recommendations, resourceIds);
  const allEdges = [...edges, ...recommendedEdges].sort(sortGraphEdges);
  const issues = buildIssues(data, snapshot, allEdges, recommendations);

  return {
    nodes,
    edges: allEdges,
    issues,
    snapshotSummary: {
      available: Boolean(snapshot),
      generatedAt: snapshot?.generatedAt,
      resourcesChecked: snapshot?.resourcesChecked ?? 0,
      pagesFetched: snapshot?.pagesFetched ?? 0,
      foundEcosystemLinks: snapshot?.foundEdges.length ?? 0,
      issueCount: (snapshot?.issues.length ?? 0) + issues.length,
    },
    projects: data.projects,
    resourceTypes: uniqueValues(data.resources.map((resource) => resource.type)),
    owners: uniqueValues(data.resources.map((resource) => resource.owner)),
  };
}

function buildEdges(
  manualEdges: ManualEdge[],
  snapshot: CrawlSnapshot | null,
  resourceIds: Set<string>,
): GraphEdge[] {
  const foundEdgeKeys = new Set(
    (snapshot?.foundEdges ?? []).map((edge) => edgeKey(edge.from, edge.to)),
  );
  const graphEdges = new Map<string, GraphEdge>();

  manualEdges
    .filter((edge) => resourceIds.has(edge.from) && resourceIds.has(edge.to))
    .forEach((edge) => {
      const key = edgeKey(edge.from, edge.to);

      graphEdges.set(key, {
        id: key,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        category: foundEdgeKeys.has(key) ? "both" : "manual",
        note: edge.note,
      });
    });

  for (const edge of snapshot?.foundEdges ?? []) {
    if (!resourceIds.has(edge.from) || !resourceIds.has(edge.to)) {
      continue;
    }

    const key = edgeKey(edge.from, edge.to);

    if (graphEdges.has(key)) {
      continue;
    }

    graphEdges.set(key, {
      id: key,
      from: edge.from,
      to: edge.to,
      type: "found",
      category: "found",
      sourceUrl: edge.sourceUrl,
    });
  }

  for (const issue of snapshot?.issues ?? []) {
    if (!resourceIds.has(issue.resourceId) || issue.type !== "broken_page") {
      continue;
    }

    const key = edgeKey(issue.resourceId, issue.resourceId, "broken");
    graphEdges.set(key, {
      id: key,
      from: issue.resourceId,
      to: issue.resourceId,
      type: "broken",
      category: "broken",
      note: issue.message,
      sourceUrl: issue.url,
    });
  }

  return [...graphEdges.values()].sort(sortGraphEdges);
}

function buildRecommendedEdges(
  recommendations: Recommendation[],
  resourceIds: Set<string>,
): GraphEdge[] {
  return recommendations
    .filter(
      (recommendation) =>
        resourceIds.has(recommendation.from) &&
        resourceIds.has(recommendation.to) &&
        recommendation.from !== recommendation.to,
    )
    .map((recommendation) => ({
      id: `recommended--${recommendation.id}`,
      from: recommendation.from,
      to: recommendation.to,
      type: "recommended" as const,
      category: "recommended" as const,
      note: recommendation.reason,
    }))
    .sort(sortGraphEdges);
}

function buildIssues(
  data: OrbitoryData,
  snapshot: CrawlSnapshot | null,
  edges: GraphEdge[],
  recommendations: Recommendation[],
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const resourcesById = new Map(
    data.resources.map((resource) => [resource.id, resource]),
  );
  const foundEdgeKeys = new Set(
    (snapshot?.foundEdges ?? []).map((edge) => edgeKey(edge.from, edge.to)),
  );
  const incomingIds = new Set(edges.map((edge) => edge.to));
  const outgoingIds = new Set(edges.map((edge) => edge.from));

  for (const issue of snapshot?.issues ?? []) {
    if (issue.type === "broken_page" || issue.type === "fetch_error") {
      const resource = resourcesById.get(issue.resourceId);
      issues.push({
        category: "broken_resource_page",
        resourceId: issue.resourceId,
        title: resource
          ? `${resource.name} has a crawl issue`
          : `${issue.resourceId} has a crawl issue`,
        message: issue.message,
        url: issue.url,
      });
    }
  }

  for (const edge of snapshot?.foundEdges ?? []) {
    if (!resourcesById.has(edge.to)) {
      issues.push({
        category: "broken_outbound_ecosystem_link",
        resourceId: edge.from,
        relatedResourceId: edge.to,
        title: `Found edge points to an unknown resource`,
        message: `Crawler found a link from ${edge.from} to ${edge.to}, but the target is not in the resource list.`,
        url: edge.linkUrl,
      });
    }
  }

  for (const resource of data.resources) {
    if (!incomingIds.has(resource.id)) {
      issues.push({
        category: "no_incoming_links",
        resourceId: resource.id,
        title: `${resource.name} has no incoming ecosystem links`,
        message: "No manual or found ecosystem links currently point here.",
      });
    }

    if (!outgoingIds.has(resource.id)) {
      issues.push({
        category: "no_outgoing_links",
        resourceId: resource.id,
        title: `${resource.name} has no outgoing ecosystem links`,
        message: "No manual or found ecosystem links currently leave this resource.",
      });
    }
  }

  if (snapshot) {
    for (const edge of data.manualEdges) {
      if (!foundEdgeKeys.has(edgeKey(edge.from, edge.to))) {
        issues.push({
          category: "manual_edge_not_found",
          resourceId: edge.from,
          relatedResourceId: edge.to,
          title: `Manual edge not found by crawler`,
          message: `Expected ${edge.from} to link to ${edge.to}, but the latest snapshot did not find it.`,
        });
      }
    }
  }

  for (const recommendation of recommendations) {
    issues.push({
      category: "recommendation",
      resourceId: recommendation.from,
      relatedResourceId: recommendation.to,
      title: recommendation.type.replaceAll("_", " "),
      message: recommendation.reason,
      recommendation,
    });
  }

  return issues.sort(
    (first, second) =>
      first.category.localeCompare(second.category) ||
      first.resourceId.localeCompare(second.resourceId) ||
      first.title.localeCompare(second.title),
  );
}

function sortGraphEdges(first: GraphEdge, second: GraphEdge) {
  return (
    first.from.localeCompare(second.from) ||
    first.to.localeCompare(second.to) ||
    first.category.localeCompare(second.category)
  );
}

function buildCrawlStatusByResourceId(
  data: OrbitoryData,
  snapshot: CrawlSnapshot | null,
) {
  const statuses = new Map<string, CrawlStatus>();

  data.resources.forEach((resource) => {
    statuses.set(resource.id, "not crawled");
  });

  if (!snapshot) {
    return statuses;
  }

  const statusesByResource = new Map<string, PageStatusSnapshot[]>();

  snapshot.pageStatuses.forEach((status) => {
    statusesByResource.set(status.resourceId, [
      ...(statusesByResource.get(status.resourceId) ?? []),
      status,
    ]);
  });

  statusesByResource.forEach((pageStatuses, resourceId) => {
    if (pageStatuses.some((status) => status.error)) {
      statuses.set(resourceId, "fetch error");
      return;
    }

    if (pageStatuses.some((status) => status.status && status.status >= 400)) {
      statuses.set(resourceId, "broken");
      return;
    }

    if (pageStatuses.some((status) => status.redirected)) {
      statuses.set(resourceId, "redirected");
      return;
    }

    if (pageStatuses.some((status) => status.ok)) {
      statuses.set(resourceId, "OK");
    }
  });

  return statuses;
}

function edgeKey(from: string, to: string, suffix = "edge") {
  return `${from}--${to}--${suffix}`;
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second),
  );
}
