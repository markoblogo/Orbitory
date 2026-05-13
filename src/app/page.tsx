import { DashboardSection } from "@/components/dashboard-section";
import {
  EcosystemGraphView,
  IssuesPanel,
  RecommendationsPanel,
  SnapshotSummaryPanel,
} from "@/components/ecosystem-graph";
import { buildGraph } from "@/lib/buildGraph";
import { groupResourcesByProject, loadResources } from "@/lib/loadResources";
import { loadLatestSnapshot } from "@/lib/loadSnapshot";

export default function Home() {
  // Private audit dashboard: this route can expose internal resources, crawler
  // issues, broken links, owner labels, and recommendations. Do not publish `/`
  // publicly without adding authentication or another access control layer.
  const orbitoryData = loadResources();
  const snapshot = loadLatestSnapshot();
  const graph = buildGraph(orbitoryData, snapshot);
  const resourceGroups = groupResourcesByProject(orbitoryData);
  const stats = [
    { label: "Resources", value: orbitoryData.resources.length },
    { label: "Groups", value: orbitoryData.projects.length },
    { label: "Links", value: graph.edges.length },
    {
      label: graph.snapshotSummary.generatedAt ? "Snapshot" : "Issues",
      value: graph.snapshotSummary.generatedAt
        ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
            new Date(graph.snapshotSummary.generatedAt),
          )
        : graph.issues.length,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#161513]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#d8d1c4] pb-4">
          <p className="text-lg font-semibold tracking-tight">Orbitory</p>
          <nav className="flex items-center gap-4 text-xs font-medium uppercase tracking-wide text-[#6f6658]">
            <span>Private mode</span>
            <a className="underline-offset-4 hover:underline" href="/public">
              Public view
            </a>
          </nav>
        </header>

        <section className="min-h-[calc(100vh-6rem)] space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Personal ecosystem map
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f574c]">
                A local visual universe of owned sites, profiles, channels,
                platforms, and the connections between them.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md border border-[#d8d1c4] bg-[#fffdf8] px-3 py-2"
                >
                  <dt className="text-[0.65rem] uppercase tracking-wide text-[#8c8170]">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-lg font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <EcosystemGraphView graph={graph} />
        </section>

        <section className="space-y-4">
          <DashboardSection
            title="Snapshot"
            description="Latest local crawler summary."
          >
            <SnapshotSummaryPanel graph={graph} />
          </DashboardSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <DashboardSection
              title="Issues"
              description="Top audit findings grouped by type."
            >
              <IssuesPanel issues={graph.issues} />
            </DashboardSection>

            <DashboardSection
              title="Recommendations"
              description="Top deterministic rule-based suggestions."
            >
              <RecommendationsPanel issues={graph.issues} />
            </DashboardSection>
          </div>

          <DashboardSection
            title="Resources by project"
            description="Dense local inventory summary."
          >
            <ResourceGroupsSummary groups={resourceGroups} />
          </DashboardSection>
        </section>
      </div>
    </main>
  );
}

type ResourceGroups = ReturnType<typeof groupResourcesByProject>;

function ResourceGroupsSummary({ groups }: { groups: ResourceGroups }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3 text-sm text-[#6f6658]">
        No resources are configured yet. Add resources to
        <code className="font-mono"> data/resources.yaml</code> or
        <code className="font-mono"> data/resources.local.yaml</code>, then run
        <code className="font-mono"> npm run validate:data</code>.
      </p>
    );
  }

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => {
        const keyResources = group.resources
          .slice()
          .sort((first, second) => priorityRank(second.priority) - priorityRank(first.priority))
          .slice(0, 4);

        return (
          <article
            key={group.project?.id ?? "unassigned"}
            className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  {group.project?.name ?? "Unassigned"}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#8c8170]">
                  {group.resources.length} resources
                </p>
              </div>
              <span className="rounded-full border border-[#d8d1c4] px-2 py-0.5 text-xs text-[#6f6658]">
                {group.project?.visibility ?? "mixed"}
              </span>
            </div>

            <ul className="mt-3 space-y-1.5">
              {keyResources.map((resource) => (
                <li
                  key={resource.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-xs"
                >
                  <a
                    className="truncate font-medium underline-offset-4 hover:underline"
                    href={resource.url}
                  >
                    {resource.name}
                  </a>
                  <span className="text-[#8c8170]">{resource.type}</span>
                </li>
              ))}
            </ul>

            {group.resources.length > keyResources.length ? (
              <p className="mt-2 text-xs text-[#8c8170]">
                +{group.resources.length - keyResources.length} more
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function priorityRank(priority: string) {
  const ranks: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return ranks[priority] ?? 0;
}
