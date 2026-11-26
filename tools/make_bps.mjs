import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { applyBps, crc32 } from '../site/patcher.mjs';

const [sourcePath, targetPath, outputPath] = process.argv.slice(2);
if (!outputPath) {
  console.error('usage: node tools/make_bps.mjs CLEAN_ROM PATCHED_ROM OUTPUT.bps');
  process.exit(2);
}

function createBps(source, target) {
  const parts = [];
  const number = value => {
    const bytes = [];
    for (;;) {
      const byte = value % 128;
      value = Math.floor(value / 128);
      if (!value) {
        bytes.push(byte | 128);
        break;
      }
      bytes.push(byte);
      value--;
    }
    parts.push(Buffer.from(bytes));
  };
  const same = at => at < source.length && target[at] === source[at];
  const runFrom = at => {
    let stop = at + 1;
    while (stop < target.length && target[stop] === target[at]) stop++;
    return stop - at;
  };
  parts.push(Buffer.from('BPS1', 'latin1'));
  number(source.length);
  number(target.length);
  number(0);
  let cursor = 0;
  let targetRelative = 0;
  while (cursor < target.length) {
    const start = cursor;
    if (same(cursor)) {
      while (cursor < target.length && same(cursor)) cursor++;
      number((cursor - start - 1) * 4);
      continue;
    }
    const run = runFrom(cursor);
    if (run >= 16) {
      number(1);
      parts.push(target.subarray(cursor, cursor + 1));
      number((run - 2) * 4 + 3);
      const offset = cursor - targetRelative;
      number(Math.abs(offset) * 2 + (offset < 0 ? 1 : 0));
      targetRelative = cursor + run - 1;
      cursor += run;
      continue;
    }
    cursor += run;
    while (cursor < target.length && !same(cursor)) {
      const next = runFrom(cursor);
      if (next >= 16) break;
      cursor += next;
    }
    number((cursor - start - 1) * 4 + 1);
    parts.push(target.subarray(start, cursor));
  }
  const footer = Buffer.alloc(8);
  footer.writeUInt32LE(crc32(source), 0);
  footer.writeUInt32LE(crc32(target), 4);
  parts.push(footer);
  const body = Buffer.concat(parts);
  const tail = Buffer.alloc(4);
  tail.writeUInt32LE(crc32(body), 0);
  return Buffer.concat([body, tail]);
}

const source = readFileSync(sourcePath);
const target = readFileSync(targetPath);
const patch = createBps(source, target);
if (!Buffer.from(applyBps(new Uint8Array(source), new Uint8Array(patch))).equals(target)) throw new Error('BPS round trip failed');
writeFileSync(outputPath, patch);
const sha1 = data => createHash('sha1').update(data).digest('hex');
console.log(`source ${sha1(source)} ${source.length}`);
console.log(`target ${sha1(target)} ${target.length}`);
console.log(`patch  ${patch.length} bytes -> ${outputPath}`);
