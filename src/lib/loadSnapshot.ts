import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { CrawlSnapshot } from "./types";

const DEFAULT_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "snapshots",
  "latest.json",
);

export function loadLatestSnapshot(
  snapshotPath = DEFAULT_SNAPSHOT_PATH,
): CrawlSnapshot | null {
  if (!existsSync(snapshotPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(snapshotPath, "utf8")) as CrawlSnapshot;
  } catch (error) {
    throw new Error(
      `Could not read crawl snapshot at ${snapshotPath}: ${getErrorMessage(error)}`,
    );
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
