import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import install from '../lib/src/features/tools.ts';
import { harness } from './helper.ts';

test('stale reads and unique replacements, literal replacement and checkpoint tracking', async t => {
  const h = await harness(install);
  t.after(() => h.close());
  const path = join(h.root, 'code');
  await writeFile(path, 'x x\r\n');
  await assert.rejects(h.call('Edit', { file_path: path, old_string: 'x', new_string: 'y' }), /Read/);
  await h.call('Read', { file_path: path });
  await assert.rejects(h.call('Edit', { file_path: path, old_string: 'x', new_string: 'y' }), /occurs/);
  await h.call('Edit', { file_path: path, old_string: 'x', new_string: '$&', replace_all: true });
  assert.equal(await readFile(path, 'utf8'), '$& $&\r\n');
  assert.equal(h.runtime.checkpoints.length, 1);
  await writeFile(path, 'external');
  await assert.rejects(h.call('Write', { file_path: path, content: 'overwrite' }), /changed/);
});

test('image result and notebook cell editing preserve structure and clear stale execution output', async t => {
  const h = await harness(install);
  t.after(() => h.close());
  const image = join(h.root, 'tiny.png');
  await writeFile(image, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64'));
  assert.equal((await h.call('Read', { file_path: image })).content[0].type, 'image');
  const path = join(h.root, 'test.ipynb');
  await writeFile(
    path,
    JSON.stringify({
      cells: [{ id: 'cell1', cell_type: 'code', source: ['old'], outputs: [{ text: 'stale' }], execution_count: 2 }],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    }),
  );
  await h.call('Read', { file_path: path });
  await h.call('NotebookEdit', { notebook_path: path, cell_id: 'cell1', new_source: 'new\n' });
  const notebook = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(notebook.cells[0].source, ['new\n']);
  assert.deepEqual(notebook.cells[0].outputs, []);
});
