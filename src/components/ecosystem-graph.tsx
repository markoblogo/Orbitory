"use client";

import { useMemo, useState } from "react";
import type {
  CrawlStatus,
  EcosystemGraph,
  EdgeCategory,
  GraphIssue,
  GraphNode,
} from "@/lib/buildGraph";
import type {
  ResourceOwner,
  ResourcePriority,
  ResourceType,
} from "@/lib/types";

type EcosystemGraphProps = {
  graph: EcosystemGraph;
};

type PositionedNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
};

const nodeTypeColors: Record<ResourceType, string> = {
  website: "#2563eb",
  blog: "#7c3aed",
  landing: "#db2777",
  social: "#0891b2",
  video: "#dc2626",
  newsletter: "#ca8a04",
  github: "#334155",
  partner: "#16a34a",
  directory: "#ea580c",
  other: "#6b7280",
};

const edgeStyles: Record<EdgeCategory, { stroke: string; dash?: string; width: number }> = {
  manual: { stroke: "#7c3aed", dash: "8 6", width: 2 },
  found: { stroke: "#2563eb", width: 2 },
  both: { stroke: "#16a34a", width: 3 },
  broken: { stroke: "#dc2626", dash: "3 4", width: 2 },
  recommended: { stroke: "#ca8a04", dash: "10 5", width: 2 },
};

const crawlStatusStyles: Record<CrawlStatus, string> = {
  OK: "border-emerald-200 bg-emerald-50 text-emerald-800",
  redirected: "border-amber-200 bg-amber-50 text-amber-800",
  broken: "border-red-200 bg-red-50 text-red-800",
  "fetch error": "border-red-200 bg-red-50 text-red-800",
  "not crawled": "border-[#d8d1c4] bg-[#fffdf8] text-[#6f6658]",
};

const priorityRadius: Record<ResourcePriority, number> = {
  low: 18,
  medium: 24,
  high: 31,
  critical: 38,
};

export function EcosystemGraphView({ graph }: EcosystemGraphProps) {
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<ResourceOwner | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graph.nodes[0]?.id ?? null,
  );

  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter((node) => {
        const resource = node.resource;

        if (projectFilter !== "all" && resource.projectId !== projectFilter) {
          return false;
        }

        if (typeFilter !== "all" && resource.type !== typeFilter) {
          return false;
        }

        if (ownerFilter !== "all" && resource.owner !== ownerFilter) {
          return false;
        }

        if (!showArchived && resource.status === "archived") {
          return false;
        }

        return true;
      }),
    [graph.nodes, ownerFilter, projectFilter, showArchived, typeFilter],
  );

  const positionedNodes = useMemo(
    () => layoutNodesByProject(visibleNodes),
    [visibleNodes],
  );
  const positionedNodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) => positionedNodeMap.has(edge.from) && positionedNodeMap.has(edge.to),
      ),
    [graph.edges, positionedNodeMap],
  );
  const selectedNode =
    (selectedNodeId ? positionedNodeMap.get(selectedNodeId) : undefined) ??
    positionedNodes[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="grid gap-3 rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4 md:grid-cols-4">
          <label className="space-y-1 text-sm font-medium">
            <span>Project</span>
            <select
              className="w-full rounded-md border border-[#cfc6b7] bg-[#fffdf8] px-3 py-2 text-sm"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All projects</option>
              {graph.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium">
            <span>Resource type</span>
            <select
              className="w-full rounded-md border border-[#cfc6b7] bg-[#fffdf8] px-3 py-2 text-sm"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.target.value as ResourceType | "all")
              }
            >
              <option value="all">All types</option>
              {graph.resourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium">
            <span>Owner</span>
            <select
              className="w-full rounded-md border border-[#cfc6b7] bg-[#fffdf8] px-3 py-2 text-sm"
              value={ownerFilter}
              onChange={(event) =>
                setOwnerFilter(event.target.value as ResourceOwner | "all")
              }
            >
              <option value="all">All owners</option>
              {graph.owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 text-sm font-medium">
            <input
              checked={showArchived}
              className="mb-2 size-4 accent-[#161513]"
              type="checkbox"
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span className="pb-1">Show archived</span>
          </label>
        </div>

        <div className="overflow-x-auto rounded-md border border-[#d8d1c4] bg-[#fcfaf4]">
          <svg
            aria-label="Orbitory ecosystem graph"
            className="min-h-[560px] w-full min-w-[920px]"
            role="img"
            viewBox="0 0 1100 620"
          >
            <defs>
              <marker
                id="edge-arrow"
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
                viewBox="0 0 8 8"
              >
                <path d="M0,0 L8,4 L0,8 z" fill="#7a7164" />
              </marker>
            </defs>

            <rect fill="#fcfaf4" height="620" width="1100" />
            <g opacity="0.55">
              {Array.from({ length: 28 }).map((_, index) => (
                <line
                  key={`v-${index}`}
                  stroke="#e8e1d4"
                  x1={index * 40}
                  x2={index * 40}
                  y1="0"
                  y2="620"
                />
              ))}
              {Array.from({ length: 16 }).map((_, index) => (
                <line
                  key={`h-${index}`}
                  stroke="#e8e1d4"
                  x1="0"
                  x2="1100"
                  y1={index * 40}
                  y2={index * 40}
                />
              ))}
            </g>

            <g>
              {visibleEdges.map((edge) => {
                const from = positionedNodeMap.get(edge.from);
                const to = positionedNodeMap.get(edge.to);

                if (!from || !to) {
                  return null;
                }

                const style = edgeStyles[edge.category];

                return (
                  <g key={edge.id}>
                    {from.id === to.id ? (
                      <circle
                        cx={from.x + from.radius + 8}
                        cy={from.y - from.radius - 8}
                        fill="none"
                        r="18"
                        stroke={style.stroke}
                        strokeDasharray={style.dash}
                        strokeWidth={style.width}
                      />
                    ) : (
                      <line
                        markerEnd="url(#edge-arrow)"
                        stroke={style.stroke}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        strokeWidth={style.width}
                        x1={from.x}
                        x2={to.x}
                        y1={from.y}
                        y2={to.y}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            <g>
              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;

                return (
                  <g
                    key={node.id}
                    aria-label={`Show ${node.label} details`}
                    className="cursor-pointer outline-none"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedNodeId(node.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedNodeId(node.id);
                      }
                    }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      fill={nodeTypeColors[node.resource.type]}
                      r={node.radius}
                      stroke={isSelected ? "#161513" : crawlStatusColor(node.crawlStatus)}
                      strokeWidth={isSelected ? 4 : 2}
                    />
                    <text
                      fill="#161513"
                      fontSize="12"
                      fontWeight="600"
                      textAnchor="middle"
                      x={node.x}
                      y={node.y + node.radius + 18}
                    >
                      {shortenLabel(node.label)}
                    </text>
                  </g>
                );
              })}
            </g>

            {positionedNodes.length === 0 ? (
              <text
                fill="#6f6658"
                fontSize="18"
                fontWeight="600"
                textAnchor="middle"
                x="550"
                y="310"
              >
                No resources match the selected filters.
              </text>
            ) : null}
          </svg>
        </div>

        <GraphLegend />
      </div>

      <NodeDetailCard node={selectedNode} />
    </div>
  );
}

function layoutNodesByProject(nodes: GraphNode[]): PositionedNode[] {
  const groups = new Map<string, GraphNode[]>();

  nodes.forEach((node) => {
    const key = node.resource.projectId ?? "unassigned";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  const sortedGroups = [...groups.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );
  const columns = Math.max(1, Math.min(4, sortedGroups.length));
  const columnWidth = 1040 / columns;

  return sortedGroups.flatMap(([, groupNodes], groupIndex) => {
    const rows = Math.ceil(groupNodes.length / 2);
    const baseX = 50 + (groupIndex % columns) * columnWidth;
    const baseY = 70 + Math.floor(groupIndex / columns) * Math.max(160, rows * 92);

    return groupNodes
      .slice()
      .sort((first, second) => first.label.localeCompare(second.label))
      .map((node, nodeIndex) => ({
        ...node,
        x: baseX + 90 + (nodeIndex % 2) * Math.min(170, columnWidth / 2),
        y: baseY + Math.floor(nodeIndex / 2) * 92,
        radius: priorityRadius[node.resource.priority],
      }));
  });
}

function NodeDetailCard({ node }: { node?: PositionedNode }) {
  if (!node) {
    return (
      <aside className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4">
        <p className="font-medium">No resource selected</p>
      </aside>
    );
  }

  const resource = node.resource;

  return (
    <aside className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4">
      <p className="text-xs uppercase tracking-wide text-[#8c8170]">
        Selected resource
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight">
        {resource.name}
      </h3>
      <a
        className="mt-3 block break-words text-sm font-medium text-[#2563eb] underline-offset-4 hover:underline"
        href={resource.url}
      >
        {resource.url}
      </a>

      <dl className="mt-5 space-y-3 text-sm">
        <DetailRow label="Type" value={resource.type} />
        <DetailRow label="Project" value={node.project?.name ?? "Unassigned"} />
        <DetailRow label="Owner" value={resource.owner} />
        <DetailRow label="Priority" value={resource.priority} />
        <DetailRow label="Status" value={resource.status} />
        <div>
          <dt className="text-xs uppercase tracking-wide text-[#8c8170]">
            Crawl status
          </dt>
          <dd className="mt-1">
            <CrawlStatusBadge status={node.crawlStatus} />
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-wide text-[#8c8170]">Tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {resource.tags.length > 0 ? (
            resource.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#d8d1c4] px-2.5 py-1 text-xs"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#6f6658]">No tags</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#8c8170]">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function GraphLegend() {
  return (
    <div className="grid gap-4 rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4 text-sm md:grid-cols-2">
      <div>
        <p className="font-medium">Node color</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(nodeTypeColors).map(([type, color]) => (
            <span key={type} className="inline-flex items-center gap-2">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {type}
            </span>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium">Edge category</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(edgeStyles).map(([type, style]) => (
            <span key={type} className="inline-flex items-center gap-2">
              <svg height="8" width="36">
                <line
                  stroke={style.stroke}
                  strokeDasharray={style.dash}
                  strokeWidth={style.width}
                  x1="0"
                  x2="36"
                  y1="4"
                  y2="4"
                />
              </svg>
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SnapshotSummaryPanel({ graph }: { graph: EcosystemGraph }) {
  const summary = graph.snapshotSummary;

  if (!summary.available) {
    return (
      <div className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4">
        <p className="font-medium">No crawl snapshot yet</p>
        <p className="mt-2 text-sm leading-6 text-[#6f6658]">
          Run <code className="font-mono">npm run crawl</code> to generate
          <code className="font-mono"> data/snapshots/latest.json</code> and
          populate crawl status, found links, and snapshot issues.
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Last generated", value: formatDate(summary.generatedAt) },
    { label: "Resources checked", value: summary.resourcesChecked },
    { label: "Pages fetched", value: summary.pagesFetched },
    { label: "Found ecosystem links", value: summary.foundEcosystemLinks },
    { label: "Issue count", value: summary.issueCount },
  ];

  return (
    <dl className="grid gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3"
        >
          <dt className="text-xs uppercase tracking-wide text-[#8c8170]">
            {stat.label}
          </dt>
          <dd className="mt-1 font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function IssuesPanel({ issues }: { issues: GraphIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4 text-sm text-[#6f6658]">
        No graph issues found in the current local data.
      </p>
    );
  }

  return (
    <ul className="max-h-[640px] space-y-3 overflow-auto pr-1">
      {issues.map((issue, index) => (
        <li
          key={`${issue.category}-${issue.resourceId}-${issue.relatedResourceId ?? ""}-${index}`}
          className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4"
        >
          <p className="text-xs uppercase tracking-wide text-[#8c8170]">
            {formatIssueCategory(issue.category)}
          </p>
          <p className="mt-1 font-medium">{issue.title}</p>
          <p className="mt-1 text-sm leading-6 text-[#6f6658]">
            {issue.message}
          </p>
          {issue.url ? (
            <p className="mt-2 break-words text-xs text-[#8c8170]">
              {issue.url}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CrawlStatusBadge({ status }: { status: CrawlStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${crawlStatusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function crawlStatusColor(status: CrawlStatus) {
  if (status === "OK") {
    return "#16a34a";
  }

  if (status === "redirected") {
    return "#ca8a04";
  }

  if (status === "broken" || status === "fetch error") {
    return "#dc2626";
  }

  return "#fffdf8";
}

function formatIssueCategory(category: GraphIssue["category"]) {
  return category.replaceAll("_", " ");
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortenLabel(label: string): string {
  return label.length > 22 ? `${label.slice(0, 19)}...` : label;
}
