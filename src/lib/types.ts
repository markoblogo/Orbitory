export const resourceTypes = [
  "website",
  "blog",
  "landing",
  "social",
  "video",
  "newsletter",
  "github",
  "partner",
  "directory",
  "other",
] as const;

export const resourceOwners = ["mine", "partner", "external"] as const;

export const resourcePriorities = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const resourceStatuses = [
  "active",
  "inactive",
  "archived",
  "unknown",
] as const;

export const manualEdgeTypes = [
  "intended",
  "known",
  "partner",
  "owned-by",
  "related",
] as const;

export type ResourceType = (typeof resourceTypes)[number];
export type ResourceOwner = (typeof resourceOwners)[number];
export type ResourcePriority = (typeof resourcePriorities)[number];
export type ResourceStatus = (typeof resourceStatuses)[number];
export type ManualEdgeType = (typeof manualEdgeTypes)[number];

export type Project = {
  id: string;
  name: string;
  description?: string;
  tags: string[];
};

export type ResourceCrawlConfig = {
  enabled: boolean;
  paths?: string[];
};

export type Resource = {
  id: string;
  name: string;
  url: string;
  type: ResourceType;
  projectId?: string;
  owner: ResourceOwner;
  priority: ResourcePriority;
  status: ResourceStatus;
  editable: boolean;
  tags: string[];
  crawl: ResourceCrawlConfig;
};

export type ManualEdge = {
  from: string;
  to: string;
  type: ManualEdgeType;
  note?: string;
};

export type FoundEdgeSnapshot = {
  from: string;
  to: string;
  sourceUrl: string;
  linkUrl: string;
  normalizedLinkUrl: string;
};

export type PageStatusSnapshot = {
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

export type CrawlIssueSnapshot = {
  type: string;
  resourceId: string;
  url: string;
  message: string;
  status?: number;
  finalUrl?: string;
};

export type CrawlSnapshot = {
  generatedAt: string;
  resourcesChecked: number;
  pagesFetched: number;
  foundEdges: FoundEdgeSnapshot[];
  pageStatuses: PageStatusSnapshot[];
  issues: CrawlIssueSnapshot[];
};

export type OrbitoryData = {
  projects: Project[];
  resources: Resource[];
  manualEdges: ManualEdge[];
};

export type ProjectResourceGroup = {
  project: Project | null;
  resources: Resource[];
};
