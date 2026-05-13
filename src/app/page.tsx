import { DashboardSection } from "@/components/dashboard-section";
import {
  EcosystemGraphView,
  IssuesPanel,
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
    { label: "Projects", value: orbitoryData.projects.length },
    { label: "Resources", value: orbitoryData.resources.length },
    { label: "Manual edges", value: orbitoryData.manualEdges.length },
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#161513]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-[#d8d1c4] pb-5">
          <p className="text-xl font-semibold tracking-tight">Orbitory</p>
          <p className="hidden text-sm text-[#6f6658] sm:block">
            Local-first ecosystem visibility
          </p>
        </header>

        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              A personal ecosystem map for everything you own online.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f574c]">
              Orbitory keeps a local, inspectable map of websites, blogs,
              social profiles, channels, partner pages, and the links between
              them so gaps and broken connections are easy to spot.
            </p>
          </div>

          <div className="rounded-lg border border-[#d8d1c4] bg-[#fffdf8] p-5 shadow-sm">
            <p className="text-sm font-medium text-[#6f6658]">MVP scope</p>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-xs uppercase tracking-wide text-[#8c8170]">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <DashboardSection
            title="Ecosystem graph"
            description="Resources render as nodes, and manual edges render as deterministic local graph connections."
          >
            <EcosystemGraphView graph={graph} />
          </DashboardSection>

          <DashboardSection
            title="Snapshot summary"
            description="Latest local crawler snapshot status. No network calls are made by the UI."
          >
            <SnapshotSummaryPanel graph={graph} />
          </DashboardSection>
        </section>

        <DashboardSection
          title="Issues"
          description="Derived from local resources, manual edges, and the latest crawler snapshot."
        >
          <IssuesPanel issues={graph.issues} />
        </DashboardSection>

        <DashboardSection
          title="Resources by project"
          description="This list is loaded from the local YAML dataset and grouped by configured project."
        >
          {resourceGroups.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {resourceGroups.map((group) => (
                <div
                  key={group.project?.id ?? "unassigned"}
                  className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4"
                >
                  <h3 className="font-medium">
                    {group.project?.name ?? "Unassigned"}
                  </h3>
                  {group.project?.description ? (
                    <p className="mt-1 text-sm leading-6 text-[#6f6658]">
                      {group.project.description}
                    </p>
                  ) : null}
                  <ul className="mt-4 space-y-3">
                    {group.resources.map((resource) => (
                      <li key={resource.id}>
                        <a
                          className="break-words text-sm font-medium underline-offset-4 hover:underline"
                          href={resource.url}
                        >
                          {resource.name}
                        </a>
                        <p className="mt-1 text-xs uppercase tracking-wide text-[#8c8170]">
                          {resource.type} / {resource.owner} /{" "}
                          {resource.priority}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-[#d8d1c4] bg-[#fcfaf4] p-4 text-sm text-[#6f6658]">
              No resources are configured yet. Add resources to
              <code className="font-mono"> data/resources.yaml</code> or
              <code className="font-mono"> data/resources.local.yaml</code>,
              then run <code className="font-mono">npm run validate:data</code>.
            </p>
          )}
        </DashboardSection>
      </div>
    </main>
  );
}
