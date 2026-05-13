import type { EcosystemGraph, GraphNode } from "@/lib/buildGraph";
import type { ResourcePriority, ResourceType } from "@/lib/types";

type PublicEcosystemProps = {
  graph: EcosystemGraph;
};

type PositionedNode = GraphNode & {
  x: number;
  y: number;
  radius: number;
};

const nodeTypeColors: Record<ResourceType, string> = {
  website: "#1d4ed8",
  blog: "#7c3aed",
  landing: "#be185d",
  social: "#0e7490",
  video: "#b91c1c",
  newsletter: "#a16207",
  github: "#334155",
  partner: "#15803d",
  directory: "#c2410c",
  other: "#6b7280",
};

const priorityRadius: Record<ResourcePriority, number> = {
  low: 17,
  medium: 23,
  high: 30,
  critical: 37,
};

export function PublicEcosystem({ graph }: PublicEcosystemProps) {
  const nodes = layoutNodes(graph.nodes);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const visibleEdges = graph.edges.filter(
    (edge) => nodeMap.has(edge.from) && nodeMap.has(edge.to),
  );

  if (graph.nodes.length === 0) {
    return (
      <div className="rounded-lg border border-[#d8d1c4] bg-[#fffdf8] p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          No public resources yet
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[#5f574c]">
          Mark projects and resources as public in the local dataset to publish
          a curated ecosystem map here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-lg border border-[#d8d1c4] bg-[#fffdf8] shadow-sm">
        <svg
          aria-label="Public Orbitory ecosystem map"
          className="min-h-[560px] w-full min-w-[900px]"
          role="img"
          viewBox="0 0 1100 620"
        >
          <defs>
            <marker
              id="public-edge-arrow"
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
          <rect fill="#fffdf8" height="620" width="1100" />
          {visibleEdges.map((edge) => {
            const from = nodeMap.get(edge.from);
            const to = nodeMap.get(edge.to);

            if (!from || !to) {
              return null;
            }

            return (
              <line
                key={edge.id}
                markerEnd="url(#public-edge-arrow)"
                stroke="#9c8f7b"
                strokeLinecap="round"
                strokeWidth="2"
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                fill={nodeTypeColors[node.resource.type]}
                r={node.radius}
                stroke="#fffdf8"
                strokeWidth="3"
              />
              <text
                fill="#161513"
                fontSize="13"
                fontWeight="650"
                textAnchor="middle"
                x={node.x}
                y={node.y + node.radius + 20}
              >
                {shortenLabel(node.label)}
              </text>
              <text
                fill="#7a7164"
                fontSize="11"
                textAnchor="middle"
                x={node.x}
                y={node.y + node.radius + 36}
              >
                {node.resource.type}
              </text>
            </g>
          ))}
        </svg>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {graph.nodes.map((node) => (
          <article
            key={node.id}
            className="rounded-lg border border-[#d8d1c4] bg-[#fffdf8] p-5 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-[#8c8170]">
              {node.project?.name ?? "Independent"} / {node.resource.type}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {node.resource.name}
            </h2>
            <a
              className="mt-3 block break-words text-sm font-medium text-[#1d4ed8] underline-offset-4 hover:underline"
              href={node.resource.url}
            >
              {node.resource.url}
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

function layoutNodes(nodes: GraphNode[]): PositionedNode[] {
  const groups = new Map<string, GraphNode[]>();

  nodes.forEach((node) => {
    const key = node.resource.projectId ?? "independent";
    groups.set(key, [...(groups.get(key) ?? []), node]);
  });

  const sortedGroups = [...groups.entries()].sort(([first], [second]) =>
    first.localeCompare(second),
  );
  const columns = Math.max(1, Math.min(3, sortedGroups.length));
  const columnWidth = 980 / columns;

  return sortedGroups.flatMap(([, groupNodes], groupIndex) => {
    const baseX = 80 + (groupIndex % columns) * columnWidth;
    const baseY = 105 + Math.floor(groupIndex / columns) * 190;

    return groupNodes
      .slice()
      .sort((first, second) => first.label.localeCompare(second.label))
      .map((node, nodeIndex) => ({
        ...node,
        x: baseX + 90 + (nodeIndex % 2) * Math.min(170, columnWidth / 2),
        y: baseY + Math.floor(nodeIndex / 2) * 105,
        radius: priorityRadius[node.resource.priority],
      }));
  });
}

function shortenLabel(label: string): string {
  return label.length > 24 ? `${label.slice(0, 21)}...` : label;
}
