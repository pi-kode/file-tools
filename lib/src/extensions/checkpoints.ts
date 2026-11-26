import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileToolsRuntime } from '../runtime/files.ts';
import { atomicWrite, hash, optionalText } from '../runtime/utils.ts';

export interface Checkpoint {
  path: string;
  before: string | null;
  after: string;
}

export async function trackedWrite(runtime: FileToolsRuntime, path: string, content: string): Promise<void> {
  const before = await optionalText(path);
  const digest = before === undefined ? null : hash(before);
  const after = hash(content);
  if (before !== undefined) await atomicWrite(join(runtime.store, 'blobs', digest!), before);
  await atomicWrite(path, content);
  runtime.checkpoints.push({ path, before: digest, after });
  runtime.persist();
  runtime.readVersions.set(path, after);
}

export async function rewindFile(runtime: FileToolsRuntime): Promise<string> {
  const checkpoint = runtime.checkpoints.at(-1);
  if (!checkpoint) throw new Error('No file checkpoint to rewind');
  const current = await optionalText(checkpoint.path);
  if (current === undefined || hash(current) !== checkpoint.after) {
    throw new Error('Rewind conflict: file changed outside the tracked edit');
  }
  if (checkpoint.before === null) {
    await rm(checkpoint.path);
  } else {
    const bytes = await readFile(join(runtime.store, 'blobs', checkpoint.before));
    if (hash(bytes) !== checkpoint.before) throw new Error('Checkpoint integrity failure');
    await atomicWrite(checkpoint.path, bytes);
  }
  runtime.checkpoints.pop();
  runtime.readVersions.delete(checkpoint.path);
  runtime.persist();
  return `Restored ${checkpoint.path}. Shell and external edits are not tracked.`;
}
