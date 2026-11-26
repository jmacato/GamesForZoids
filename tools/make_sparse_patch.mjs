import { openSync, readSync, writeFileSync, fstatSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [sourcePath, targetPath, outputPath] = process.argv.slice(2);
if (!outputPath) {
  console.error('usage: node tools/make_sparse_patch.mjs CLEAN_IMAGE PATCHED_IMAGE OUTPUT.zsp');
  process.exit(2);
}
const source = openSync(sourcePath, 'r');
const target = openSync(targetPath, 'r');
const size = fstatSync(source).size;
if (fstatSync(target).size !== size) throw new Error('the two images differ in size; a sparse patch needs equal sizes');

const BLOCK = 1 << 20;
const GAP = 64;
const before = Buffer.alloc(BLOCK);
const after = Buffer.alloc(BLOCK);
const runs = [];
let start = -1;
let end = -1;
for (let offset = 0; offset < size; offset += BLOCK) {
  const length = readSync(source, before, 0, BLOCK, offset);
  readSync(target, after, 0, BLOCK, offset);
  if (before.compare(after, 0, length, 0, length) === 0) continue;
  for (let i = 0; i < length; i++) {
    if (before[i] === after[i]) continue;
    const position = offset + i;
    if (start >= 0 && position - end <= GAP) end = position + 1;
    else {
      if (start >= 0) runs.push([start, end]);
      start = position;
      end = position + 1;
    }
  }
}
if (start >= 0) runs.push([start, end]);

const records = [];
const bodies = [];
for (const [from, to] of runs) {
  const original = Buffer.alloc(to - from);
  const replacement = Buffer.alloc(to - from);
  readSync(source, original, 0, to - from, from);
  readSync(target, replacement, 0, to - from, from);
  records.push({ offset: from, length: to - from, source: createHash('sha1').update(original).digest('hex') });
  bodies.push(replacement);
}
const payload = createHash('sha1').update(Buffer.concat(bodies)).digest('hex');
const header = Buffer.from(JSON.stringify({ format: 'zoids-sparse-1', size, payload, records }));
const headerLength = Buffer.alloc(4);
headerLength.writeUInt32LE(header.length);
const patch = Buffer.concat([Buffer.from('ZSP1', 'latin1'), headerLength, header, ...bodies]);
writeFileSync(outputPath, patch);
console.log(`records ${records.length}, replaced bytes ${bodies.reduce((sum, body) => sum + body.length, 0)}`);
console.log(`patch  ${patch.length} bytes -> ${outputPath}`);
