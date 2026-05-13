import { z } from "zod";
import {
  manualEdgeTypes,
  resourceOwners,
  resourcePriorities,
  resourceStatuses,
  resourceTypes,
  visibilityLevels,
} from "./types";

const idSchema = z
  .string()
  .trim()
  .min(1, "ID is required")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only",
  );

const stringArraySchema = z.array(z.string().trim().min(1)).default([]);

export const projectSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().min(1).optional(),
  visibility: z.enum(visibilityLevels).default("private"),
  tags: stringArraySchema,
});

export const resourceSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1, "Resource name is required"),
  url: z.url("Resource URL must be a valid absolute URL"),
  type: z.enum(resourceTypes),
  projectId: idSchema.optional(),
  owner: z.enum(resourceOwners),
  visibility: z.enum(visibilityLevels).default("private"),
  priority: z.enum(resourcePriorities),
  status: z.enum(resourceStatuses),
  editable: z.boolean(),
  tags: stringArraySchema,
  crawl: z.object({
    enabled: z.boolean(),
    paths: z.array(z.string().trim().min(1)).optional(),
  }),
});

export const linkEvidenceSchema = z.object({
  sourceUrl: z.url("Evidence sourceUrl must be a valid absolute URL"),
  targetUrl: z.url("Evidence targetUrl must be a valid absolute URL"),
  context: z.string().trim().min(1, "Evidence context is required"),
  anchorText: z.string().trim().min(1).optional(),
  discoveredAt: z.iso.datetime().optional(),
});

export const manualEdgeSchema = z.object({
  from: idSchema,
  to: idSchema,
  type: z.enum(manualEdgeTypes),
  note: z.string().trim().min(1).optional(),
  evidence: z.array(linkEvidenceSchema).default([]),
});

export const orbitoryDataSchema = z
  .object({
    projects: z.array(projectSchema).default([]),
    resources: z.array(resourceSchema).default([]),
    manualEdges: z.array(manualEdgeSchema).default([]),
  })
  .superRefine((data, ctx) => {
    addDuplicateIdIssues(
      data.projects.map((project) => project.id),
      "projects",
      ctx,
    );
    addDuplicateIdIssues(
      data.resources.map((resource) => resource.id),
      "resources",
      ctx,
    );

    const projectIds = new Set(data.projects.map((project) => project.id));
    const resourceIds = new Set(data.resources.map((resource) => resource.id));

    data.resources.forEach((resource, index) => {
      if (resource.projectId && !projectIds.has(resource.projectId)) {
        ctx.addIssue({
          code: "custom",
          path: ["resources", index, "projectId"],
          message: `Unknown projectId "${resource.projectId}" for resource "${resource.id}"`,
        });
      }
    });

    data.manualEdges.forEach((edge, index) => {
      if (!resourceIds.has(edge.from)) {
        ctx.addIssue({
          code: "custom",
          path: ["manualEdges", index, "from"],
          message: `Unknown source resource "${edge.from}"`,
        });
      }

      if (!resourceIds.has(edge.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["manualEdges", index, "to"],
          message: `Unknown target resource "${edge.to}"`,
        });
      }
    });
  });

function addDuplicateIdIssues(
  ids: string[],
  collectionName: "projects" | "resources",
  ctx: z.RefinementCtx,
) {
  const seen = new Map<string, number>();

  ids.forEach((id, index) => {
    const firstIndex = seen.get(id);

    if (firstIndex === undefined) {
      seen.set(id, index);
      return;
    }

    ctx.addIssue({
      code: "custom",
      path: [collectionName, index, "id"],
      message: `Duplicate ${collectionName.slice(0, -1)} id "${id}" also appears at ${collectionName}.${firstIndex}.id`,
    });
  });
}
