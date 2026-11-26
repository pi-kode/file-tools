import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';

export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export async function canonical(file: string): Promise<string> {
  try {
    return await realpath(file);
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    const parent = dirname(file);
    if (parent === file) return file;
    return resolve(await canonical(parent), relative(parent, file));
  }
}

export async function atomicWrite(file: string, contents: string | Buffer): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  let mode = 0o600;
  try {
    mode = (await stat(file)).mode & 0o777;
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await writeFile(temp, contents, { mode, flag: 'wx' });
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}

export async function optionalText(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, 'utf8');
  } catch (error: any) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
}

export const textResult = (text: string, details: Record<string, unknown> = {}) => ({
  content: [{ type: 'text' as const, text }],
  details,
});
