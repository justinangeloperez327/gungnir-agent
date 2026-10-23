import {
  GungnirProjectIndex,
  type ContextMatch,
  type ContextQueryOptions,
  type ProjectIndexOptions,
  type ProjectIndexStatistics,
  type ProjectMetadata,
  type SourceLines,
  type SourceSummary,
  type TrustedWorkspace,
} from "@gungnir/agent-core";

export interface ProjectOverview {
  readonly project: ProjectMetadata;
  readonly files: readonly SourceSummary[];
  readonly statistics: ProjectIndexStatistics;
}

/**
 * Shared read-only context contract for MCP-compatible adapters.
 * A trusted host creates the workspace; an MCP request cannot change its root.
 * No excerpts are returned from overview, and search excerpts opt in explicitly.
 */
export class ReadOnlyContextAdapter {
  constructor(private readonly workspace: TrustedWorkspace) {}

  async overview(options: ProjectIndexOptions = {}): Promise<ProjectOverview> {
    const index = await GungnirProjectIndex.scan(this.workspace, options);
    return Object.freeze({
      project: index.project,
      files: index.files,
      statistics: index.statistics,
    });
  }

  async search(
    query: string, options: ContextQueryOptions = {}, scanOptions: ProjectIndexOptions = {},
  ): Promise<readonly ContextMatch[]> {
    const index = await GungnirProjectIndex.scan(this.workspace, scanOptions);
    return index.search(query, {
      ...options,
      includeExcerpts: options.includeExcerpts === true,
    });
  }

  async excerpt(
    relativePath: string, firstLine: number, count: number,
    scanOptions: ProjectIndexOptions = {},
  ): Promise<SourceLines> {
    const index = await GungnirProjectIndex.scan(this.workspace, scanOptions);
    return index.sourceLines(relativePath, firstLine, count);
  }
}
