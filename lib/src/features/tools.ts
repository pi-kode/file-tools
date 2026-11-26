import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { FileToolsRuntime } from '../runtime/files.ts';
import { registerTools } from '../extensions/tools.ts';
import { rewindFile } from '../extensions/checkpoints.ts';

const CHANNEL = 'pi-ko:file-tools:v1';

export default function (pi: ExtensionAPI): void {
  let existing: FileToolsRuntime | undefined;
  pi.events.emit(CHANNEL, { accept: (value: FileToolsRuntime) => { existing = value; } });
  if (existing) {
    existing.pi = pi;
    return;
  }

  const r = new FileToolsRuntime(pi);
  const unsubscribe = pi.events.on(CHANNEL, (request: any) => request.accept(r));

  pi.on('session_start', (_e, ctx) => r.start(ctx));
  pi.on('session_tree', (_e, ctx) => r.start(ctx));
  pi.on('session_shutdown', e => {
    r.ready = false;
    if (e.reason === 'reload' || e.reason === 'quit') unsubscribe();
  });

  registerTools(r);

  pi.registerCommand('pk-rewind', {
    description: 'Rewind the last tracked Read/Write/Edit/NotebookEdit file change',
    handler: async (_args, ctx) => {
      const point = r.checkpoints.at(-1);
      if (!point) {
        ctx.ui.notify('No tracked file edits to rewind.', 'info');
        return;
      }
      if (ctx.hasUI) {
        const choice = await ctx.ui.select(`Rewind last tracked file edit?\n${point.path}`, ['Allow once', 'Deny'], {
          signal: ctx.signal,
        });
        if (choice !== 'Allow once') return;
      }
      const message = await rewindFile(r);
      pi.sendMessage({ customType: 'code-compat', content: message, display: true });
    },
  });
}
