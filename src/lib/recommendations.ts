import type { CrawlSnapshot, ManualEdge, OrbitoryData, Resource } from "./types";

export const DEFAULT_RECOMMENDATION_LIMIT = 20;

export type RecommendationType =
  | "same_project_missing_link"
  | "important_resource_low_incoming"
  | "social_missing_website_link"
  | "website_missing_social_link"
  | "shared_tags_missing_link"
  | "manual_edge_not_found";

export type RecommendationSeverity = "low" | "medium" | "high";
export type RecommendationConfidence = "low" | "medium" | "high";

export type Recommendation = {
  id: string;
  type: RecommendationType;
  from: string;
  to: string;
  severity: RecommendationSeverity;
  reason: string;
  suggestedAction: string;
  confidence: RecommendationConfidence;
  ruleId: string;
};

type LinkIndex = {
  linkedPairs: Set<string>;
  directedLinks: Set<string>;
  incomingCounts: Map<string, number>;
  outgoingCounts: Map<string, number>;
};

export function generateRecommendations(
  data: OrbitoryData,
  snapshot: CrawlSnapshot | null = null,
  limit = DEFAULT_RECOMMENDATION_LIMIT,
): Recommendation[] {
  const activeResources = data.resources.filter(
    (resource) => resource.status === "active",
  );
  const linkIndex = buildLinkIndex(data.manualEdges, snapshot);
  const recommendations = new Map<string, Recommendation>();

  addSameProjectMissingLinks(activeResources, linkIndex, recommendations);
  addImportantResourceLowIncoming(activeResources, linkIndex, recommendations);
  addSocialMissingWebsiteLinks(activeResources, linkIndex, recommendations);
  addWebsiteMissingSocialLinks(activeResources, linkIndex, recommendations);
  addSharedTagsMissingLinks(activeResources, linkIndex, recommendations);
  addManualEdgesNotFound(data.manualEdges, snapshot, recommendations);

  return [...recommendations.values()]
    .sort(sortRecommendations)
    .slice(0, limit);
}

// Rule 1: resources in the same active project should usually expose a path between them.
function addSameProjectMissingLinks(
  resources: Resource[],
  linkIndex: LinkIndex,
  recommendations: Map<string, Recommendation>,
) {
  const byProject = groupByProject(resources);

  for (const projectResources of byProject.values()) {
    for (const [first, second] of uniquePairs(projectResources)) {
      if (hasAnyLink(linkIndex, first.id, second.id)) {
        continue;
      }

      addRecommendation(recommendations, {
        id: recommendationId("same-project-missing-link", first.id, second.id),
        type: "same_project_missing_link",
        from: first.id,
        to: second.id,
        severity: first.priority === "critical" || second.priority === "critical" ? "high" : "medium",
        reason: `${first.name} and ${second.name} are active resources in the same project with no ecosystem link in either direction.`,
        suggestedAction: `Add a clear link between ${first.name} and ${second.name}, or add a manual edge if the relationship is intentional but not crawl-visible.`,
        confidence: "medium",
        ruleId: "R1_SAME_PROJECT_MISSING_LINK",
      });
    }
  }
}

// Rule 2: high-priority resources should not be isolated from the rest of the ecosystem.
function addImportantResourceLowIncoming(
  resources: Resource[],
  linkIndex: LinkIndex,
  recommendations: Map<string, Recommendation>,
) {
  const possibleSources = resources
    .slice()
    .sort((first, second) => first.id.localeCompare(second.id));

  for (const resource of possibleSources) {
    if (resource.priority !== "high" && resource.priority !== "critical") {
      continue;
    }

    const incomingCount = linkIndex.incomingCounts.get(resource.id) ?? 0;
    const threshold = resource.priority === "critical" ? 2 : 1;

    if (incomingCount > threshold) {
      continue;
    }

    const source =
      possibleSources.find(
        (candidate) =>
          candidate.id !== resource.id &&
          candidate.projectId === resource.projectId &&
          !hasDirectedLink(linkIndex, candidate.id, resource.id),
      ) ??
      possibleSources.find(
        (candidate) =>
          candidate.id !== resource.id &&
          !hasDirectedLink(linkIndex, candidate.id, resource.id),
      );

    if (!source) {
      continue;
    }

    addRecommendation(recommendations, {
      id: recommendationId("important-low-incoming", source.id, resource.id),
      type: "important_resource_low_incoming",
      from: source.id,
      to: resource.id,
      severity: resource.priority === "critical" ? "high" : "medium",
      reason: `${resource.name} is ${resource.priority} priority and has ${incomingCount} incoming ecosystem link${incomingCount === 1 ? "" : "s"}.`,
      suggestedAction: `Add prominent links from related resources to ${resource.name}.`,
      confidence: "high",
      ruleId: "R2_IMPORTANT_RESOURCE_LOW_INCOMING",
    });
  }
}

// Rule 3: social profiles in a project should point visitors back to the project's website.
function addSocialMissingWebsiteLinks(
  resources: Resource[],
  linkIndex: LinkIndex,
  recommendations: Map<string, Recommendation>,
) {
  for (const social of resources.filter((resource) => resource.type === "social")) {
    for (const website of sameProjectResources(resources, social).filter(
      (resource) => resource.type === "website",
    )) {
      if (hasDirectedLink(linkIndex, social.id, website.id)) {
        continue;
      }

      addRecommendation(recommendations, {
        id: recommendationId("social-missing-website", social.id, website.id),
        type: "social_missing_website_link",
        from: social.id,
        to: website.id,
        severity: "high",
        reason: `${social.name} is a social resource in the same project as ${website.name}, but it does not link to the website.`,
        suggestedAction: `Add ${website.name} as the primary website link on ${social.name}.`,
        confidence: "high",
        ruleId: "R3_SOCIAL_MISSING_WEBSITE_LINK",
      });
    }
  }
}

// Rule 4: websites should expose active social profiles from the same project.
function addWebsiteMissingSocialLinks(
  resources: Resource[],
  linkIndex: LinkIndex,
  recommendations: Map<string, Recommendation>,
) {
  for (const website of resources.filter((resource) => resource.type === "website")) {
    for (const social of sameProjectResources(resources, website).filter(
      (resource) => resource.type === "social",
    )) {
      if (hasDirectedLink(linkIndex, website.id, social.id)) {
        continue;
      }

      addRecommendation(recommendations, {
        id: recommendationId("website-missing-social", website.id, social.id),
        type: "website_missing_social_link",
        from: website.id,
        to: social.id,
        severity: "medium",
        reason: `${website.name} does not link to active social resource ${social.name}.`,
        suggestedAction: `Add ${social.name} to the social links or footer on ${website.name}.`,
        confidence: "high",
        ruleId: "R4_WEBSITE_MISSING_SOCIAL_LINK",
      });
    }
  }
}

// Rule 5: two resources sharing multiple explicit tags are likely related enough to review.
function addSharedTagsMissingLinks(
  resources: Resource[],
  linkIndex: LinkIndex,
  recommendations: Map<string, Recommendation>,
) {
  for (const [first, second] of uniquePairs(resources)) {
    if (hasAnyLink(linkIndex, first.id, second.id)) {
      continue;
    }

    const sharedTags = first.tags.filter((tag) => second.tags.includes(tag));

    if (sharedTags.length < 2) {
      continue;
    }

    addRecommendation(recommendations, {
      id: recommendationId("shared-tags-missing-link", first.id, second.id),
      type: "shared_tags_missing_link",
      from: first.id,
      to: second.id,
      severity: "low",
      reason: `${first.name} and ${second.name} share tags: ${sharedTags.slice(0, 4).join(", ")}.`,
      suggestedAction: "Review whether these resources should link to each other or be marked as related.",
      confidence: "low",
      ruleId: "R5_SHARED_TAGS_MISSING_LINK",
    });
  }
}

// Rule 6: intended/known manual edges should be visible to the crawler when crawl data exists.
function addManualEdgesNotFound(
  manualEdges: ManualEdge[],
  snapshot: CrawlSnapshot | null,
  recommendations: Map<string, Recommendation>,
) {
  if (!snapshot) {
    return;
  }

  const foundDirectedLinks = new Set(
    snapshot.foundEdges.map((edge) => directedKey(edge.from, edge.to)),
  );

  for (const edge of manualEdges.filter(
    (manualEdge) => manualEdge.type === "intended" || manualEdge.type === "known",
  )) {
    if (foundDirectedLinks.has(directedKey(edge.from, edge.to))) {
      continue;
    }

    addRecommendation(recommendations, {
      id: recommendationId("manual-edge-not-found", edge.from, edge.to),
      type: "manual_edge_not_found",
      from: edge.from,
      to: edge.to,
      severity: edge.type === "known" ? "high" : "medium",
      reason: `Manual ${edge.type} edge from ${edge.from} to ${edge.to} was not found in the latest crawl snapshot.`,
      suggestedAction: "Check whether the link is missing, blocked from crawl, hidden behind script-only UI, or intentionally private.",
      confidence: "high",
      ruleId: "R6_MANUAL_EDGE_NOT_FOUND",
    });
  }
}

function buildLinkIndex(
  manualEdges: ManualEdge[],
  snapshot: CrawlSnapshot | null,
): LinkIndex {
  const directedLinks = new Set<string>();
  const linkedPairs = new Set<string>();
  const incomingCounts = new Map<string, number>();
  const outgoingCounts = new Map<string, number>();

  for (const edge of manualEdges) {
    addLink(edge.from, edge.to, directedLinks, linkedPairs, incomingCounts, outgoingCounts);
  }

  for (const edge of snapshot?.foundEdges ?? []) {
    addLink(edge.from, edge.to, directedLinks, linkedPairs, incomingCounts, outgoingCounts);
  }

  return {
    linkedPairs,
    directedLinks,
    incomingCounts,
    outgoingCounts,
  };
}

function addLink(
  from: string,
  to: string,
  directedLinks: Set<string>,
  linkedPairs: Set<string>,
  incomingCounts: Map<string, number>,
  outgoingCounts: Map<string, number>,
) {
  const directed = directedKey(from, to);

  if (directedLinks.has(directed)) {
    return;
  }

  directedLinks.add(directed);
  linkedPairs.add(pairKey(from, to));
  incomingCounts.set(to, (incomingCounts.get(to) ?? 0) + 1);
  outgoingCounts.set(from, (outgoingCounts.get(from) ?? 0) + 1);
}

function addRecommendation(
  recommendations: Map<string, Recommendation>,
  recommendation: Recommendation,
) {
  if (!recommendations.has(recommendation.id)) {
    recommendations.set(recommendation.id, recommendation);
  }
}

function groupByProject(resources: Resource[]) {
  const groups = new Map<string, Resource[]>();

  for (const resource of resources) {
    if (!resource.projectId) {
      continue;
    }

    groups.set(resource.projectId, [...(groups.get(resource.projectId) ?? []), resource]);
  }

  return groups;
}

function sameProjectResources(resources: Resource[], resource: Resource) {
  if (!resource.projectId) {
    return [];
  }

  return resources.filter(
    (candidate) =>
      candidate.id !== resource.id && candidate.projectId === resource.projectId,
  );
}

function uniquePairs(resources: Resource[]): Array<[Resource, Resource]> {
  const sorted = resources
    .slice()
    .sort((first, second) => first.id.localeCompare(second.id));
  const pairs: Array<[Resource, Resource]> = [];

  for (let firstIndex = 0; firstIndex < sorted.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < sorted.length;
      secondIndex += 1
    ) {
      pairs.push([sorted[firstIndex], sorted[secondIndex]]);
    }
  }

  return pairs;
}

function hasAnyLink(linkIndex: LinkIndex, firstId: string, secondId: string) {
  return linkIndex.linkedPairs.has(pairKey(firstId, secondId));
}

function hasDirectedLink(linkIndex: LinkIndex, from: string, to: string) {
  return linkIndex.directedLinks.has(directedKey(from, to));
}

function directedKey(from: string, to: string) {
  return `${from}->${to}`;
}

function pairKey(firstId: string, secondId: string) {
  return [firstId, secondId].sort().join("<->");
}

function recommendationId(ruleSlug: string, from: string, to: string) {
  return `${ruleSlug}:${from}->${to}`;
}

function sortRecommendations(first: Recommendation, second: Recommendation) {
  return (
    severityRank(second.severity) - severityRank(first.severity) ||
    confidenceRank(second.confidence) - confidenceRank(first.confidence) ||
    first.ruleId.localeCompare(second.ruleId) ||
    first.from.localeCompare(second.from) ||
    first.to.localeCompare(second.to)
  );
}

function severityRank(severity: RecommendationSeverity) {
  return { low: 1, medium: 2, high: 3 }[severity];
}

function confidenceRank(confidence: RecommendationConfidence) {
  return { low: 1, medium: 2, high: 3 }[confidence];
}
