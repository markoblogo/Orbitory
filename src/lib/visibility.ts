import type { OrbitoryData } from "./types";

export function filterPublicData(data: OrbitoryData): OrbitoryData {
  const publicProjectIds = new Set(
    data.projects
      .filter((project) => project.visibility === "public")
      .map((project) => project.id),
  );
  const resources = data.resources.filter(
    (resource) =>
      resource.visibility === "public" &&
      (!resource.projectId || publicProjectIds.has(resource.projectId)),
  );
  const resourceIds = new Set(resources.map((resource) => resource.id));

  return {
    projects: data.projects.filter((project) => publicProjectIds.has(project.id)),
    resources,
    manualEdges: data.manualEdges.filter(
      (edge) => resourceIds.has(edge.from) && resourceIds.has(edge.to),
    ),
  };
}
