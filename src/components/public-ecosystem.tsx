"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { EcosystemGraph, GraphEdge, GraphNode } from "@/lib/buildGraph";
import type { ResourcePriority, ResourceType } from "@/lib/types";

type PublicDiagnostics = {
  totalResources: number;
  publicResources: number;
  privateResources: number;
  unlistedResources: number;
};

type PublicEcosystemProps = {
  diagnostics?: PublicDiagnostics;
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

type HoverState =
  | { kind: "node"; node: PositionedNode }
  | { kind: "edge"; edge: GraphEdge; x: number; y: number }
  | null;

const graphWidth = 1200;
const graphHeight = 700;

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

const priorityRadius: Record<ResourcePriority, number> = {
  low: 17,
  medium: 23,
  high: 30,
  critical: 38,
};

export function PublicEcosystem({ diagnostics, graph }: PublicEcosystemProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    graph.nodes[0]?.id ?? null,
  );
  const [view, setView] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 });
  const [panStart, setPanStart] = useState<{
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const [hovered, setHovered] = useState<HoverState>(null);

  const nodes = useMemo(() => layoutNodes(graph.nodes), [graph.nodes]);
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        (edge) =>
          edge.category !== "recommended" &&
          edge.category !== "broken" &&
          nodeMap.has(edge.from) &&
          nodeMap.has(edge.to),
      ),
    [graph.edges, nodeMap],
  );
  const selectedNode =
    (selectedNodeId ? nodeMap.get(selectedNodeId) : undefined) ?? nodes[0];

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pointerX = ((event.clientX - rect.left) / rect.width) * graphWidth;
    const pointerY = ((event.clientY - rect.top) / rect.height) * graphHeight;
    const nextScale = clamp(view.scale * (event.deltaY > 0 ? 0.88 : 1.12), 0.6, 2.4);
    const graphX = (pointerX - view.x) / view.scale;
    const graphY = (pointerY - view.y) / view.scale;

    setView({
      scale: nextScale,
      x: pointerX - graphX * nextScale,
      y: pointerY - graphY * nextScale,
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!panStart) {
      return;
    }

    const rect = svgRef.current?.getBoundingClientRect();
    const scaleX = rect ? graphWidth / rect.width : 1;
    const scaleY = rect ? graphHeight / rect.height : 1;

    setView((current) => ({
      ...current,
      x: panStart.x + (event.clientX - panStart.clientX) * scaleX,
      y: panStart.y + (event.clientY - panStart.clientY) * scaleY,
    }));
  }

  if (graph.nodes.length === 0) {
    return <PublicEmptyState diagnostics={diagnostics} />;
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-md border border-[#cabfaa] bg-[#11131d] shadow-2xl">
        <svg
          ref={svgRef}
          aria-label="Public Orbitory ecosystem map"
          className="h-[58vh] min-h-[500px] w-full touch-none cursor-grab select-none active:cursor-grabbing"
          role="img"
          viewBox={`0 0 ${graphWidth} ${graphHeight}`}
          onPointerDown={(event) => {
            if (event.button !== 0) {
              return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            setPanStart({
              clientX: event.clientX,
              clientY: event.clientY,
              x: view.x,
              y: view.y,
            });
          }}
          onPointerLeave={() => {
            setHovered(null);
            setPanStart(null);
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setPanStart(null);
          }}
          onWheel={handleWheel}
        >
          <defs>
            <radialGradient id="public-orbitory-space" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#28304a" />
              <stop offset="48%" stopColor="#151827" />
              <stop offset="100%" stopColor="#090b12" />
            </radialGradient>
            <filter id="public-planet-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect fill="url(#public-orbitory-space)" height={graphHeight} width={graphWidth} />
          <StarField />

          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {visibleEdges.map((edge) => {
              const from = nodeMap.get(edge.from);
              const to = nodeMap.get(edge.to);

              if (!from || !to) {
                return null;
              }

              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;

              return (
                <g
                  key={edge.id}
                  className="cursor-crosshair"
                  onPointerEnter={() => setHovered({ kind: "edge", edge, x: midX, y: midY })}
                  onPointerLeave={() => setHovered(null)}
                >
                  <line
                    stroke="transparent"
                    strokeLinecap="round"
                    strokeWidth={Math.max(14, edgeStrokeWidth(edge.linkCount) + 8)}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                  <line
                    stroke={edge.category === "manual" ? "#a78bfa" : "#60a5fa"}
                    strokeDasharray={edge.category === "manual" ? "8 7" : undefined}
                    strokeLinecap="round"
                    strokeOpacity="0.78"
                    strokeWidth={edgeStrokeWidth(edge.linkCount)}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                </g>
              );
            })}

            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isImportant =
                node.resource.priority === "critical" ||
                node.resource.priority === "high";
              const isHovered =
                hovered?.kind === "node" && hovered.node.id === node.id;

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
                  onPointerDown={(event) => event.stopPropagation()}
                  onPointerEnter={() => setHovered({ kind: "node", node })}
                  onPointerLeave={() => setHovered(null)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    fill={nodeTypeColors[node.resource.type]}
                    filter="url(#public-planet-glow)"
                    opacity="0.25"
                    r={node.radius + 11}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    fill={nodeTypeColors[node.resource.type]}
                    r={node.radius}
                    stroke={isSelected ? "#fffaf0" : "rgba(255,250,240,0.7)"}
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
                </g>
              );
            })}

            {hovered ? (
              hovered.kind === "node" ? (
                <PublicNodeTooltip node={hovered.node} />
              ) : (
                <PublicEdgeTooltip
                  edge={hovered.edge}
                  nodes={nodeMap}
                  x={hovered.x}
                  y={hovered.y}
                />
              )
            ) : null}
          </g>
        </svg>

        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs text-[#fffaf0] backdrop-blur">
          Scroll to zoom. Drag space to pan.
        </div>

        {selectedNode ? (
          <div className="absolute bottom-4 right-4 w-[min(320px,calc(100%-2rem))]">
            <PublicNodeCard node={selectedNode} />
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {graph.nodes.map((node) => (
          <article
            key={node.id}
            className="rounded-md border border-[#d8d1c4] bg-[#fffdf8] p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-[#8c8170]">
              {node.project?.name ?? "Independent"} / {node.resource.type}
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight">
              {node.resource.name}
            </h2>
            <a
              className="mt-2 block break-words text-sm font-medium text-[#1d4ed8] underline-offset-4 hover:underline"
              href={node.resource.url}
            >
              {formatDomain(node.resource.url)}
            </a>
            {node.resource.owner === "mine" ? (
              <p className="mt-3 text-sm text-[#5f574c]">Owned resource</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {node.resource.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#d8d1c4] px-2.5 py-1 text-xs text-[#5f574c]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function PublicEmptyState({ diagnostics }: { diagnostics?: PublicDiagnostics }) {
  return (
    <div className="rounded-md border border-[#d8d1c4] bg-[#fffdf8] p-6">
      <h2 className="text-xl font-semibold tracking-tight">
        No public resources yet
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f574c]">
        Public mode only renders projects and resources explicitly marked with
        <code className="font-mono"> visibility: public</code>.
      </p>

      {diagnostics ? (
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Development diagnostics</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-4">
            <DiagnosticRow label="Total" value={diagnostics.totalResources} />
            <DiagnosticRow label="Public" value={diagnostics.publicResources} />
            <DiagnosticRow label="Private" value={diagnostics.privateResources} />
            <DiagnosticRow label="Unlisted" value={diagnostics.unlistedResources} />
          </dl>
          <p className="mt-3 leading-6">
            If local data is loaded from
            <code className="font-mono"> data/resources.local.yaml</code>, any
            resource without an explicit visibility remains private by default.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function PublicNodeCard({ node }: { node: PositionedNode }) {
  return (
    <aside className="rounded-md border border-white/15 bg-[#11131d]/90 p-4 text-[#fffaf0] shadow-2xl backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-[#95a0b8]">
        Public resource
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight">
        {node.resource.name}
      </h3>
      <a
        className="mt-2 block break-words text-xs font-medium text-[#9cc7ff] underline-offset-4 hover:underline"
        href={node.resource.url}
      >
        {formatDomain(node.resource.url)}
      </a>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <PublicDetailRow label="Type" value={node.resource.type} />
        <PublicDetailRow label="Group" value={node.project?.name ?? "Independent"} />
        <PublicDetailRow label="Priority" value={node.resource.priority} />
        <PublicDetailRow label="Status" value={node.resource.status} />
      </dl>
      {node.resource.owner === "mine" ? (
        <p className="mt-4 text-xs font-medium text-[#dbeafe]">Owned resource</p>
      ) : null}
    </aside>
  );
}

function PublicNodeTooltip({ node }: { node: PositionedNode }) {
  return (
    <foreignObject height="170" width="280" x={tooltipX(node.x)} y={tooltipY(node.y)}>
      <div className="rounded-md border border-white/15 bg-[#11131d]/95 p-3 text-xs text-[#fffaf0] shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold">{node.label}</p>
        <p className="mt-1 break-words text-[#c8d1e5]">{formatDomain(node.resource.url)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <PublicDetailRow label="Type" value={node.resource.type} />
          <PublicDetailRow label="Group" value={node.project?.name ?? "Independent"} />
          <PublicDetailRow label="Priority" value={node.resource.priority} />
          <PublicDetailRow label="Status" value={node.resource.status} />
        </dl>
      </div>
    </foreignObject>
  );
}

function PublicEdgeTooltip({
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
  return (
    <foreignObject height="150" width="300" x={tooltipX(x)} y={tooltipY(y)}>
      <div className="rounded-md border border-white/15 bg-[#11131d]/95 p-3 text-xs text-[#fffaf0] shadow-2xl backdrop-blur">
        <p className="text-sm font-semibold">
          {nodes.get(edge.from)?.label ?? edge.from} {"->"}{" "}
          {nodes.get(edge.to)?.label ?? edge.to}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <PublicDetailRow
            label="Connection"
            value={edge.category === "manual" ? "curated" : "discovered"}
          />
          <PublicDetailRow label="Weight" value={String(edge.linkCount)} />
        </dl>
      </div>
    </foreignObject>
  );
}

function PublicDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-[#95a0b8]">{label}</dt>
      <dd className="mt-0.5 font-medium text-[#fffaf0]">{value}</dd>
    </div>
  );
}

function DiagnosticRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}

function StarField() {
  return (
    <g opacity="0.65">
      {Array.from({ length: 68 }).map((_, index) => (
        <circle
          key={index}
          cx={(index * 137) % graphWidth}
          cy={(index * 83) % graphHeight}
          fill="#fffaf0"
          opacity={index % 5 === 0 ? 0.7 : 0.38}
          r={index % 9 === 0 ? 1.6 : 0.9}
        />
      ))}
    </g>
  );
}

function layoutNodes(nodes: GraphNode[]): PositionedNode[] {
  const groups = new Map<string, GraphNode[]>();

  nodes.forEach((node) => {
    const key = node.resource.projectId ?? "independent";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  const sortedGroups = [...groups.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );
  const centerX = graphWidth / 2;
  const centerY = graphHeight / 2;
  const groupOrbit = Math.min(graphWidth, graphHeight) * 0.32;

  return sortedGroups.flatMap(([, groupNodes], groupIndex) => {
    const groupAngle =
      (Math.PI * 2 * groupIndex) / Math.max(1, sortedGroups.length) -
      Math.PI / 2;
    const groupCenterX =
      sortedGroups.length === 1
        ? centerX
        : centerX + Math.cos(groupAngle) * groupOrbit;
    const groupCenterY =
      sortedGroups.length === 1
        ? centerY
        : centerY + Math.sin(groupAngle) * (groupOrbit * 0.72);
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

function edgeStrokeWidth(linkCount: number) {
  return Math.min(2 + Math.max(0, linkCount - 1) * 0.75, 6);
}

function tooltipX(x: number) {
  return clamp(x + 18, 12, graphWidth - 320);
}

function tooltipY(y: number) {
  return clamp(y - 30, 12, graphHeight - 180);
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

function shortenLabel(label: string): string {
  return label.length > 24 ? `${label.slice(0, 21)}...` : label;
}
