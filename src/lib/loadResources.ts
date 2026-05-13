import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { ZodError } from "zod";
import { orbitoryDataSchema } from "./schema";
import type { OrbitoryData, ProjectResourceGroup } from "./types";

const DEMO_DATA_PATH = path.join(process.cwd(), "data", "resources.yaml");
const LOCAL_DATA_PATH = path.join(process.cwd(), "data", "resources.local.yaml");

export function getDefaultResourcesPath(): string {
  return existsSync(LOCAL_DATA_PATH) ? LOCAL_DATA_PATH : DEMO_DATA_PATH;
}

export function loadResources(dataPath = getDefaultResourcesPath()): OrbitoryData {
  let fileContents: string;

  try {
    fileContents = readFileSync(dataPath, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read Orbitory data file at ${dataPath}: ${getErrorMessage(error)}\nCheck that the file exists and is readable. For private data, use data/resources.local.yaml.`,
    );
  }

  let parsedYaml: unknown;

  try {
    parsedYaml = parse(fileContents);
  } catch (error) {
    throw new Error(
      `Could not parse Orbitory YAML at ${dataPath}: ${getErrorMessage(error)}\nFix the YAML syntax, then run npm run validate:data again.`,
    );
  }

  try {
    return orbitoryDataSchema.parse(parsedYaml);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(formatValidationError(dataPath, error));
    }

    throw error;
  }
}

export function groupResourcesByProject(
  data: OrbitoryData,
): ProjectResourceGroup[] {
  const resourcesByProjectId = new Map<string, OrbitoryData["resources"]>();
  const unassignedResources: OrbitoryData["resources"] = [];

  data.resources.forEach((resource) => {
    if (!resource.projectId) {
      unassignedResources.push(resource);
      return;
    }

    const projectResources = resourcesByProjectId.get(resource.projectId) ?? [];
    projectResources.push(resource);
    resourcesByProjectId.set(resource.projectId, projectResources);
  });

  const groups: ProjectResourceGroup[] = data.projects.map((project) => ({
    project,
    resources: resourcesByProjectId.get(project.id) ?? [],
  }));

  if (unassignedResources.length > 0) {
    groups.push({
      project: null,
      resources: unassignedResources,
    });
  }

  return groups;
}

function formatValidationError(dataPath: string, error: ZodError): string {
  const issues = error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `- ${location}: ${issue.message}`;
    })
    .join("\n");

  return `Invalid Orbitory data in ${dataPath}:\n${issues}\n\nFix the fields above, then run npm run validate:data again.`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
