import { getDefaultResourcesPath, loadResources } from "../src/lib/loadResources";

const dataPath = process.argv[2] ?? getDefaultResourcesPath();

try {
  const data = loadResources(dataPath);
  console.log(
    `Validated ${dataPath}: ${data.projects.length} projects, ${data.resources.length} resources, ${data.manualEdges.length} manual edges.`,
  );
} catch (error) {
  console.error("Orbitory data validation failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
