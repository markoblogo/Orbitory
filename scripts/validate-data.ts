import { getDefaultResourcesPath, loadResources } from "../src/lib/loadResources";
import { findGranularityWarnings } from "../src/lib/granularityWarnings";

const dataPath = process.argv[2] ?? getDefaultResourcesPath();

try {
  const data = loadResources(dataPath);
  console.log(
    `Validated ${dataPath}: ${data.projects.length} projects, ${data.resources.length} resources, ${data.manualEdges.length} manual edges.`,
  );

  const warnings = findGranularityWarnings(data);

  if (warnings.length > 0) {
    console.warn(
      `Granularity warnings: ${warnings.length} resource(s) may be too fine-grained for Orbitory's coarse ecosystem model.`,
    );
    warnings.slice(0, 25).forEach((warning) => {
      const parent = warning.suggestedParent
        ? ` Suggested parent: ${warning.suggestedParent}.`
        : "";
      console.warn(
        `- ${warning.resourceId}: ${warning.reason} URL: ${warning.url}.${parent}`,
      );
    });

    if (warnings.length > 25) {
      console.warn(`- ${warnings.length - 25} more warning(s) omitted.`);
    }
  }
} catch (error) {
  console.error("Orbitory data validation failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
