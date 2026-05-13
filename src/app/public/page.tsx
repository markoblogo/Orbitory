import { PublicEcosystem } from "@/components/public-ecosystem";
import { buildGraph } from "@/lib/buildGraph";
import { loadResources } from "@/lib/loadResources";
import { filterPublicData } from "@/lib/visibility";
import Link from "next/link";

export default function PublicPage() {
  const allData = loadResources();
  const publicData = filterPublicData(allData);
  const graph = buildGraph(publicData, null, { includeRecommendations: false });
  const diagnostics =
    process.env.NODE_ENV !== "production" && graph.nodes.length === 0
      ? {
          totalResources: allData.resources.length,
          publicResources: allData.resources.filter(
            (resource) => resource.visibility === "public",
          ).length,
          privateResources: allData.resources.filter(
            (resource) => resource.visibility === "private",
          ).length,
          unlistedResources: allData.resources.filter(
            (resource) => resource.visibility === "unlisted",
          ).length,
        }
      : undefined;
  const stats = [
    { label: "Public resources", value: graph.nodes.length },
    { label: "Groups", value: graph.projects.length },
    { label: "Connections", value: graph.edges.length },
  ];

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#161513]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#d8d1c4] pb-4">
          <p className="text-lg font-semibold tracking-tight">Orbitory</p>
          <nav className="flex items-center gap-4 text-xs font-medium uppercase tracking-wide text-[#6f6658]">
            <span>Public mode</span>
            <Link className="underline-offset-4 hover:underline" href="/">
              Private dashboard
            </Link>
          </nav>
        </header>

        <section className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Public ecosystem map
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f574c]">
                A curated public view of resources explicitly marked public.
                Audit diagnostics and private/internal details are excluded.
              </p>
            </div>

            <dl className="grid grid-cols-3 gap-2 lg:min-w-[420px]">
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

          <PublicEcosystem diagnostics={diagnostics} graph={graph} />
        </section>
      </div>
    </main>
  );
}
