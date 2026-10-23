import type { TrustedWorkspace } from "@gungnir/agent-core";
import type { ModelAccounting, ModelTextBackend } from "@gungnir/model-adapters";
import { GungnirKnowledgeIndex, type KnowledgeSource } from "@gungnir/knowledge";
import type { TextStreamBackend, TextStreamRequest } from "./session.js";

/** Retrieval is data-only. The model receives no tools and cannot access the disk. */
export class KnowledgeTextBackend implements TextStreamBackend {
  private citations: readonly KnowledgeSource[] = [];
  constructor(
    private readonly model: ModelTextBackend,
    private readonly knowledge: GungnirKnowledgeIndex,
    private readonly options: { readonly workspace?: TrustedWorkspace;
      readonly projectFile?: string } = {},
  ) {}
  get usage(): ModelAccounting { return this.model.usage; }
  get sources(): readonly KnowledgeSource[] { return this.citations; }
  async *streamText(request: TextStreamRequest): AsyncGenerator<string> {
    this.citations = [];
    if(request.signal.aborted) return;
    const prepared=await this.knowledge.prepare(request.prompt,{
      ...(this.options.workspace ? { workspace:this.options.workspace } : {}),
      ...(this.options.projectFile ? { projectFile:this.options.projectFile } : {}),
    });
    this.citations = prepared.sources;
    for await (const part of this.model.streamText({
      ...request,prompt:prepared.prompt,
    })) yield part;
  }
}
