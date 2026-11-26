import type { ExtensionAPI, ExtensionContext, ToolDefinition } from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Check } from 'typebox/value';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { hash, textResult } from './utils.ts';
import type { Checkpoint } from '../extensions/checkpoints.ts';

export class FileToolsRuntime {
  pi: ExtensionAPI;
  readonly readVersions = new Map<string, string>();
  checkpoints: Checkpoint[] = [];
  store = '';
  ready = false;

  constructor(pi: ExtensionAPI) {
    this.pi = pi;
  }

  start(ctx: ExtensionContext): void {
    this.readVersions.clear();
    this.checkpoints = [];
    for (const entry of ctx.sessionManager.getBranch() as any[]) {
      if (
        entry.type === 'custom' &&
        (entry.customType === 'pk:checkpoints' || entry.customType === 'cc:checkpoints') &&
        Array.isArray(entry.data?.checkpoints)
      ) {
        this.checkpoints = structuredClone(entry.data.checkpoints);
      } else if (
        entry.type === 'custom' &&
        entry.customType === 'code-compat:state' &&
        Array.isArray(entry.data?.checkpoints)
      ) {
        this.checkpoints = structuredClone(entry.data.checkpoints);
      }
    }
    this.store = join(
      homedir(),
      '.local/share/pi-code-compat',
      hash(ctx.cwd).slice(0, 24),
      hash(ctx.sessionManager.getSessionId()).slice(0, 24),
    );
    this.ready = true;
  }

  persist(): void {
    this.pi.appendEntry('pk:checkpoints', { checkpoints: structuredClone(this.checkpoints) });
  }

  artifact(kind: string): string {
    return join(this.store, kind, randomUUID());
  }

  register(
    schema: TSchema,
    name: string,
    description: string,
    write: boolean,
    backend: (input: any, ctx: ExtensionContext, signal?: AbortSignal) => Promise<ReturnType<typeof textResult>>,
  ): void {
    const tool: ToolDefinition<any, any> = {
      name,
      label: name,
      description,
      parameters: schema,
      executionMode: write ? 'sequential' : 'parallel',
      execute: async (_id, raw, signal, _update, ctx) => {
        if (!this.ready) throw new Error('File tools runtime is unavailable');
        const input: any = structuredClone(raw);
        if (!Check(schema, input)) throw new Error(`Invalid ${name} input`);
        return backend(input, ctx, signal);
      },
    };
    this.pi.registerTool(tool);
  }
}
