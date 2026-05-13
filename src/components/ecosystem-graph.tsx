"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type {
  CrawlStatus,
  EcosystemGraph,
  EdgeCategory,
  GraphEdge,
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

type ViewTransform = {
  x: number;
  y: number;
  scale: number;
};

type DragState =
  | { kind: "pan"; startClientX: number; startClientY: number; startX: number; startY: number }
  | { kind: "node"; nodeId: string; pointerOffsetX: number; pointerOffsetY: number };

type HoverState =
  | { kind: "node"; node: PositionedNode }
  | { kind: "edge"; edge: GraphEdge; x: number; y: number }
  | null;

const graphWidth = 1200;
const graphHeight = 720;

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
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState<ResourceOwner | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showRecommendedEdges, setShowRecommendedEdges] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graph.nodes[0]?.id ?? null,
  );
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hovered, setHovered] = useState<HoverState>(null);

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
    () =>
      layoutNodesByProject(visibleNodes).map((node) => ({
        ...node,
        ...(nodePositions[node.id] ?? {}),
      })),
    [nodePositions, visibleNodes],
  );
  const positionedNodeMap = useMemo(
    () => new Map(positionedNodes.map((node) => [node.id, node])),
    [positionedNodes],
  );
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((edge) => {
        if (edge.category === "recommended" && !showRecommendedEdges) {
          return false;
        }

        return positionedNodeMap.has(edge.from) && positionedNodeMap.has(edge.to);
      }),
    [graph.edges, positionedNodeMap, showRecommendedEdges],
  );
  const selectedNode =
    (selectedNodeId ? positionedNodeMap.get(selectedNodeId) : undefined) ??
    positionedNodes[0];
  const nodeMetrics = useMemo(
    () => buildNodeMetrics(positionedNodes, visibleEdges),
    [positionedNodes, visibleEdges],
  );

  function toGraphPoint(event: { clientX: number; clientY: number }) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }

    const x = ((event.clientX - rect.left) / rect.width) * graphWidth;
    const y = ((event.clientY - rect.top) / rect.height) * graphHeight;

    return {
      x: (x - view.x) / view.scale,
      y: (y - view.y) / view.scale,
    };
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pointerX = ((event.clientX - rect.left) / rect.width) * graphWidth;
    const pointerY = ((event.clientY - rect.top) / rect.height) * graphHeight;
    const nextScale = clamp(view.scale * (event.deltaY > 0 ? 0.88 : 1.12), 0.55, 2.6);
    const graphX = (pointerX - view.x) / view.scale;
    const graphY = (pointerY - view.y) / view.scale;

    setView({
      scale: nextScale,
      x: pointerX - graphX * nextScale,
      y: pointerY - graphY * nextScale,
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }

    if (dragState.kind === "pan") {
      const rect = svgRef.current?.getBoundingClientRect();
      const scaleX = rect ? graphWidth / rect.width : 1;
      const scaleY = rect ? graphHeight / rect.height : 1;

      setView((currentView) => ({
        ...currentView,
        x: dragState.startX + (event.clientX - dragState.startClientX) * scaleX,
        y: dragState.startY + (event.clientY - dragState.startClientY) * scaleY,
      }));
      return;
    }

    const point = toGraphPoint(event);
    setNodePositions((positions) => ({
      ...positions,
      [dragState.nodeId]: {
        x: clamp(point.x - dragState.pointerOffsetX, 48, graphWidth - 48),
        y: clamp(point.y - dragState.pointerOffsetY, 48, graphHeight - 48),
      },
    }));
  }

  return (
    <div className="space-y-4">
      <div className="hidden gap-3 rounded-md border border-[#d8d1c4]/80 bg-[#fffaf0]/85 p-3 shadow-sm backdrop-blur md:grid md:grid-cols-5">
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

          <label className="flex items-end gap-2 text-sm font-medium">
            <input
              checked={showRecommendedEdges}
              className="mb-2 size-4 accent-[#161513]"
              type="checkbox"
              onChange={(event) => setShowRecommendedEdges(event.target.checked)}
            />
            <span className="pb-1">Show recommendations</span>
          </label>
      </div>

      <details className="rounded-md border border-[#d8d1c4]/80 bg-[#fffaf0]/85 p-3 shadow-sm md:hidden">
        <summary className="cursor-pointer text-sm font-semibold">
          Filters
        </summary>
        <div className="mt-3 grid gap-3">
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

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={showArchived}
              className="size-4 accent-[#161513]"
              type="checkbox"
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            <span>Show archived</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              checked={showRecommendedEdges}
              className="size-4 accent-[#161513]"
              type="checkbox"
              onChange={(event) => setShowRecommendedEdges(event.target.checked)}
            />
            <span>Show recommendations</span>
          </label>
        </div>
      </details>

      <div className="relative overflow-hidden rounded-md border border-[#cabfaa] bg-[#11131d] shadow-2xl">
        <svg
          ref={svgRef}
          aria-label="Orbitory ecosystem graph"
          className="h-[58vh] min-h-[520px] w-full touch-none cursor-grab select-none active:cursor-grabbing"
          role="img"
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragState({
              kind: "pan",
              startClientX: event.clientX,
              startClientY: event.clientY,
              startX: view.x,
              startY: view.y,
            });
          }}
          onPointerLeave={() => {
            setHovered(null);
            setDragState(null);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragState(null);
          }}
          onWheel={handleWheel}
        >
          <defs>
            <radialGradient id="orbitory-space" cx="50%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#28304a" />
              <stop offset="48%" stopColor="#151827" />
              <stop offset="100%" stopColor="#090b12" />
            </radialGradient>
            <filter id="planet-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect fill="url(#orbitory-space)" height={graphHeight} width={graphWidth} />
          <StarField />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <g>
              {visibleEdges.map((edge) => {
                const from = positionedNodeMap.get(edge.from);
                const to = positionedNodeMap.get(edge.to);

                if (!from || !to) {
                  return null;
                }

                const style = edgeStyles[edge.category];
                const strokeWidth = edgeStrokeWidth(style.width, edge.linkCount);
                const midX = from.id === to.id ? from.x + from.radius + 28 : (from.x + to.x) / 2;
                const midY = from.id === to.id ? from.y - from.radius - 28 : (from.y + to.y) / 2;

                return (
                  <g
                    key={edge.id}
                    className="cursor-crosshair"
                    onPointerEnter={() => setHovered({ kind: "edge", edge, x: midX, y: midY })}
                    onPointerLeave={() => setHovered(null)}
                  >
                    {from.id === to.id ? (
                      <circle
                        cx={from.x + from.radius + 13}
                        cy={from.y - from.radius - 13}
                        fill="none"
                        r="22"
                        stroke={style.stroke}
                        strokeDasharray={edgeDash(edge.category, style.dash)}
                        strokeOpacity="0.82"
                        strokeWidth={strokeWidth}
                      />
                    ) : (
                      <>
                        <line
                          stroke="transparent"
                          strokeLinecap="round"
                          strokeWidth={Math.max(14, strokeWidth + 8)}
                          x1={from.x}
                          x2={to.x}
                          y1={from.y}
                          y2={to.y}
                        />
                        <line
                          stroke={style.stroke}
                          strokeDasharray={edgeDash(edge.category, style.dash)}
                          strokeLinecap="round"
                          strokeOpacity="0.78"
                          strokeWidth={strokeWidth}
                          x1={from.x}
                          x2={to.x}
                          y1={from.y}
                          y2={to.y}
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            <g>
              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const isImportant =
                  node.resource.priority === "critical";
                const isHovered =
                  hovered?.kind === "node" && hovered.node.id === node.id;
                const metrics = nodeMetrics.get(node.id) ?? { incoming: 0, outgoing: 0 };

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
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
                      const point = toGraphPoint(event);
                      setDragState({
                        kind: "node",
                        nodeId: node.id,
                        pointerOffsetX: point.x - node.x,
                        pointerOffsetY: point.y - node.y,
                      });
                    }}
                    onPointerEnter={() => setHovered({ kind: "node", node })}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      fill={nodeTypeColors[node.resource.type]}
                      filter="url(#planet-glow)"
                      opacity="0.28"
                      r={node.radius + 11}
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      fill={nodeTypeColors[node.resource.type]}
                      r={node.radius}
                      stroke={isSelected ? "#fffaf0" : crawlStatusColor(node.crawlStatus)}
                      strokeOpacity="0.95"
                      strokeWidth={isSelected ? 4 : 2}
                    />
                    <circle
                      cx={node.x - node.radius * 0.28}
                      cy={node.y - node.radius * 0.32}
                      fill="#ffffff"
                      opacity="0.28"
                      r={Math.max(5, node.radius * 0.28)}
                    />
                    {(isImportant || isSelected || isHovered) ? (
                      <text
                        fill="#fffaf0"
                        fontSize="13"
                        fontWeight="700"
                        textAnchor="middle"
                        x={node.x}
                        y={node.y + node.radius + 22}
                      >
                        {shortenLabel(node.label)}
                      </text>
                    ) : null}
                    <title>
                      {`${node.label} / ${node.resource.type} / ${node.project?.name ?? "Unassigned"} / in ${metrics.incoming}, out ${metrics.outgoing}`}
                    </title>
                  </g>
                );
              })}
            </g>

            {hovered ? (
              hovered.kind === "node" ? (
                <NodeTooltip
                  metrics={nodeMetrics.get(hovered.node.id) ?? { incoming: 0, outgoing: 0 }}
                  node={hovered.node}
                />
              ) : (
                <EdgeTooltip
                  edge={hovered.edge}
                  nodes={positionedNodeMap}
                  x={hovered.x}
                  y={hovered.y}
                />
              )
            ) : null}

            {positionedNodes.length === 0 ? (
              <text
                fill="#fffaf0"
                fontSize="18"
                fontWeight="700"
                textAnchor="middle"
                x={graphWidth / 2}
                y={graphHeight / 2}
              >
                No resources match the selected filters.
              </text>
            ) : null}
          </g>
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs text-[#fffaf0] backdrop-blur">
          Scroll to zoom. Drag space to pan. Drag planets to arrange.
        </div>

        <div className="absolute bottom-4 right-4 w-[min(320px,calc(100%-2rem))]">
          <NodeDetailCard node={selectedNode} />
        </div>
      </div>

      <GraphLegend />
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
  const centerX = graphWidth / 2;
  const centerY = graphHeight / 2;
  const groupOrbit = Math.min(graphWidth, graphHeight) * 0.32;

  return sortedGroups.flatMap(([, groupNodes], groupIndex) => {
    const groupAngle = (Math.PI * 2 * groupIndex) / Math.max(1, sortedGroups.length) - Math.PI / 2;
    const groupCenterX =
      sortedGroups.length === 1 ? centerX : centerX + Math.cos(groupAngle) * groupOrbit;
    const groupCenterY =
      sortedGroups.length === 1 ? centerY : centerY + Math.sin(groupAngle) * (groupOrbit * 0.72);
    const localOrbit = Math.max(54, Math.min(120, 34 + groupNodes.length * 15));

    return groupNodes
      .slice()
      .sort((first, second) => first.label.localeCompare(second.label))
      .map((node, nodeIndex) => {
        const nodeAngle =
          (Math.PI * 2 * nodeIndex) / Math.max(1, groupNodes.length) +
          groupAngle * 0.28;

        return {
          ...node,
          x: clamp(
            groupCenterX + Math.cos(nodeAngle) * localOrbit,
            70,
            graphWidth - 70,
          ),
          y: clamp(
            groupCenterY + Math.sin(nodeAngle) * (localOrbit * 0.78),
            70,
            graphHeight - 70,
          ),
          radius: priorityRadius[node.resource.priority],
        };
      });
  });
}

function StarField() {
  return (
    <g opacity="0.65">
      {Array.from({ length: 70 }).map((_, index) => {
        const x = (index * 137) % graphWidth;
        const y = (index * 83) % graphHeight;
        const radius = index % 9 === 0 ? 1.6 : 0.9;

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            fill="#fffaf0"
            opacity={index % 5 === 0 ? 0.7 : 0.38}
            r={radius}
          />
        );
      })}
    </g>
  );
}

function NodeTooltip({
  metrics,
  node,
}: {
  metrics: { incoming: number; outgoing: number };
  node: PositionedNode;
}) {
  return (
    <foreignObject height="210" width="300" x={tooltipX(node.x)} y={tooltipY(node.y)}>
      <div className="rounded-md border border-white/15 bg-[#11131d]/95 p-3 text-xs text-[#fffaf0] shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold">{node.label}</p>
        <p className="mt-1 break-words text-[#c8d1e5]">{formatDomain(node.resource.url)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <TooltipRow label="Type" value={node.resource.type} />
          <TooltipRow label="Project" value={node.project?.name ?? "Unassigned"} />
          <TooltipRow label="Priority" value={node.resource.priority} />
          <TooltipRow label="Status" value={node.resource.status} />
          <TooltipRow label="Incoming" value={String(metrics.incoming)} />
          <TooltipRow label="Outgoing" value={String(metrics.outgoing)} />
        </dl>
      </div>
    </foreignObject>
  );
}

function EdgeTooltip({
  edge,
  nodes,
  x,
  y,
}: {
  edge: GraphEdge;
  nodes: Map<string, PositionedNode>;
  x: number;
  y: number;
}) {
  const source = nodes.get(edge.from);
  const target = nodes.get(edge.to);
  const evidence = edge.evidence.slice(0, 2);

  return (
    <foreignObject height="230" width="330" x={tooltipX(x)} y={tooltipY(y)}>
      <div className="rounded-md border border-white/15 bg-[#11131d]/95 p-3 text-xs text-[#fffaf0] shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold">
          {source?.label ?? edge.from} {"->"} {target?.label ?? edge.to}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <TooltipRow label="Edge type" value={edge.category} />
          <TooltipRow label="Link count" value={String(edge.linkCount)} />
        </dl>
        {evidence.length > 0 ? (
          <div className="mt-3 space-y-2">
            {evidence.map((item, index) => (
              <div key={`${item.sourceUrl}-${item.targetUrl}-${index}`} className="rounded border border-white/10 bg-white/5 p-2">
                <p className="font-medium text-[#fffaf0]">{item.context}</p>
                <p className="mt-1 break-words text-[#c8d1e5]">
                  {item.anchorText || formatDomain(item.sourceUrl)}
                </p>
              </div>
            ))}
          </div>
        ) : edge.note ? (
          <p className="mt-3 text-[#c8d1e5]">{edge.note}</p>
        ) : null}
      </div>
    </foreignObject>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-[#95a0b8]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[#fffaf0]">{value}</dd>
    </div>
  );
}

function buildNodeMetrics(nodes: PositionedNode[], edges: GraphEdge[]) {
  const metrics = new Map(
    nodes.map((node) => [node.id, { incoming: 0, outgoing: 0 }]),
  );

  edges.forEach((edge) => {
    const outgoing = metrics.get(edge.from);
    const incoming = metrics.get(edge.to);

    if (outgoing) {
      outgoing.outgoing += 1;
    }

    if (incoming) {
      incoming.incoming += 1;
    }
  });

  return metrics;
}

function NodeDetailCard({ node }: { node?: PositionedNode }) {
  if (!node) {
    return (
      <aside className="rounded-md border border-white/15 bg-[#11131d]/90 p-4 text-[#fffaf0] shadow-2xl backdrop-blur">
        <p className="font-medium">No resource selected</p>
      </aside>
    );
  }

  const resource = node.resource;

  return (
    <aside className="rounded-md border border-white/15 bg-[#11131d]/90 p-4 text-[#fffaf0] shadow-2xl backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-[#95a0b8]">
        Selected resource
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {resource.name}
      </h3>
      <a
        className="mt-2 block break-words text-xs font-medium text-[#9cc7ff] underline-offset-4 hover:underline"
        href={resource.url}
      >
        {resource.url}
      </a>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
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
        <p className="text-xs uppercase tracking-wide text-[#95a0b8]">Tags</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {resource.tags.length > 0 ? (
            resource.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-[#95a0b8]">No tags</span>
          )}
        </div>
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#95a0b8]">{label}</dt>
      <dd className="mt-1 font-medium text-[#fffaf0]">{value}</dd>
    </div>
  );
}

function GraphLegend() {
  return (
    <div className="grid gap-4 rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3 text-xs md:grid-cols-2">
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
      <div className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3">
        <p className="font-medium">No crawl snapshot yet</p>
        <p className="mt-1 text-xs leading-5 text-[#6f6658]">
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
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] px-3 py-2"
        >
          <dt className="text-[0.65rem] uppercase tracking-wide text-[#8c8170]">
            {stat.label}
          </dt>
          <dd className="mt-1 truncate text-sm font-semibold">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function IssuesPanel({ issues }: { issues: GraphIssue[] }) {
  const auditIssues = issues.filter((issue) => issue.category !== "recommendation");

  if (auditIssues.length === 0) {
    return (
      <p className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3 text-sm text-[#6f6658]">
        No graph issues found in the current local data.
      </p>
    );
  }

  const groups = groupIssues(auditIssues, (issue) => formatIssueCategory(issue.category));
  const topIssues = auditIssues.slice(0, 5);

  return (
    <div className="space-y-3">
      <CompactIssueList issues={topIssues} />

      {auditIssues.length > topIssues.length ? (
        <details className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Show all {auditIssues.length} issues by type
          </summary>
          <div className="mt-3 space-y-3">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#8c8170]">
                  {group.label} ({group.issues.length})
                </p>
                <CompactIssueList issues={group.issues} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function RecommendationsPanel({ issues }: { issues: GraphIssue[] }) {
  const recommendations = issues.filter(
    (issue) => issue.category === "recommendation" && issue.recommendation,
  );

  if (recommendations.length === 0) {
    return (
      <p className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3 text-sm text-[#6f6658]">
        No recommendations generated for the current local data.
      </p>
    );
  }

  const topRecommendations = recommendations.slice(0, 10);
  const groups = groupIssues(
    recommendations,
    (issue) => issue.recommendation?.ruleId ?? "recommendation",
  );

  return (
    <div className="space-y-3">
      <CompactRecommendationList issues={topRecommendations} />

      {recommendations.length > topRecommendations.length ? (
        <details className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-amber-950">
            Show all {recommendations.length} recommendations by rule
          </summary>
          <div className="mt-3 space-y-3">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  {group.label} ({group.issues.length})
                </p>
                <CompactRecommendationList issues={group.issues} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function CompactIssueList({ issues }: { issues: GraphIssue[] }) {
  return (
    <ul className="mt-2 divide-y divide-[#e3dccf] rounded-md border border-[#d8d1c4] bg-[#fcfaf4]">
      {issues.map((issue, index) => (
        <li
          key={`${issue.category}-${issue.resourceId}-${issue.relatedResourceId ?? ""}-${index}`}
          className="grid gap-1 p-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)]"
        >
          <p className="text-xs uppercase tracking-wide text-[#8c8170]">
            {formatIssueCategory(issue.category)}
          </p>
          <div>
            <p className="font-medium">{issue.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#6f6658]">
              {issue.message}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CompactRecommendationList({ issues }: { issues: GraphIssue[] }) {
  return (
    <ul className="mt-2 divide-y divide-amber-200 rounded-md border border-amber-200 bg-amber-50">
      {issues.map((issue, index) => {
        const recommendation = issue.recommendation;

        return (
          <li
            key={`${issue.category}-${issue.resourceId}-${issue.relatedResourceId ?? ""}-${index}`}
            className="grid gap-1 p-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)]"
          >
            <p className="text-xs uppercase tracking-wide text-amber-800">
              {recommendation?.ruleId ?? "recommendation"}
            </p>
            <div>
              <p className="font-medium text-amber-950">{issue.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-amber-900">
                {recommendation?.suggestedAction ?? issue.message}
              </p>
              {recommendation ? (
                <p className="mt-1 text-[0.65rem] uppercase tracking-wide text-amber-800">
                  severity {recommendation.severity} / confidence{" "}
                  {recommendation.confidence}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function groupIssues(
  issues: GraphIssue[],
  getLabel: (issue: GraphIssue) => string,
) {
  const groups = new Map<string, GraphIssue[]>();

  issues.forEach((issue) => {
    const label = getLabel(issue);
    groups.set(label, [...(groups.get(label) ?? []), issue]);
  });

  return [...groups.entries()]
    .map(([label, groupedIssues]) => ({ label, issues: groupedIssues }))
    .sort(
      (first, second) =>
        second.issues.length - first.issues.length ||
        first.label.localeCompare(second.label),
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

function edgeStrokeWidth(baseWidth: number, linkCount: number) {
  return Math.min(baseWidth + Math.max(0, linkCount - 1) * 0.75, 7);
}

function edgeDash(category: EdgeCategory, fallback?: string) {
  if (category === "found" || category === "both") {
    return undefined;
  }

  if (category === "recommended") {
    return "2 8";
  }

  return fallback;
}

function tooltipX(x: number) {
  return clamp(x + 18, 12, graphWidth - 340);
}

function tooltipY(y: number) {
  return clamp(y - 30, 12, graphHeight - 240);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDomain(value: string) {
  try {
    const url = new URL(value);
    return url.hostname + url.pathname.replace(/\/$/, "");
  } catch {
    return value;
  }
}
