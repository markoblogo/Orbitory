import { PublicEcosystem } from "@/components/public-ecosystem";
import { buildGraph } from "@/lib/buildGraph";
import { loadResources } from "@/lib/loadResources";
import { filterPublicData } from "@/lib/visibility";

export default function PublicPage() {
  const publicData = filterPublicData(loadResources());
  const graph = buildGraph(publicData, null, { includeRecommendations: false });

  return (
    <main className="min-h-screen bg-[#f7f4ed] text-[#161513]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-[#d8d1c4] pb-5">
          <p className="text-xl font-semibold tracking-tight">Orbitory</p>
          <p className="hidden text-sm text-[#6f6658] sm:block">
            Public ecosystem map
          </p>
        </header>

        <section className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            A curated map of public ecosystem resources.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5f574c]">
            This view only includes resources explicitly marked public. Audit
            diagnostics, private notes, and internal planning details are
            intentionally excluded.
          </p>
        </section>

        <PublicEcosystem graph={graph} />
      </div>
    </main>
  );
}
