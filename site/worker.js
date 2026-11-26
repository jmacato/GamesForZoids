import { applyBps } from './patcher.mjs?v=20261127-hub-57';
import { GAMES } from './games.js?v=20261127-hub-57';

const hex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

async function applySparse(rom, patch, gameId) {
  const bytes = new Uint8Array(patch);
  if (bytes.length < 8 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'ZSP1') throw new Error('error.patchInvalid');
  const headerLength = new DataView(patch).getUint32(4, true);
  if (headerLength > bytes.length - 8) throw new Error('error.patchInvalid');
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + headerLength)));
  } catch {
    throw new Error('error.patchInvalid');
  }
  if (!Array.isArray(header.records) || typeof header.payload !== 'string') throw new Error('error.patchInvalid');
  if (header.size !== rom.size) throw new Error(`error.romSize.${gameId}`);
  const parts = [];
  let data = 8 + headerLength;
  if (hex(await crypto.subtle.digest('SHA-1', bytes.subarray(data))) !== header.payload) throw new Error('error.patchDamaged');
  let cursor = 0;
  for (const record of header.records) {
    if (!Number.isSafeInteger(record.offset) || !Number.isSafeInteger(record.length) || record.length < 1) throw new Error('error.patchInvalid');
    if (record.offset < cursor || record.offset + record.length > rom.size || data + record.length > bytes.length) throw new Error('error.patchInvalid');
    const original = await rom.slice(record.offset, record.offset + record.length).arrayBuffer();
    if (hex(await crypto.subtle.digest('SHA-1', original)) !== record.source) throw new Error(`error.romHash.${gameId}`);
    parts.push(rom.slice(cursor, record.offset), bytes.subarray(data, data + record.length));
    data += record.length;
    cursor = record.offset + record.length;
  }
  if (data !== bytes.length) throw new Error('error.patchInvalid');
  parts.push(rom.slice(cursor));
  return new Blob(parts, { type: 'application/octet-stream' });
}

self.onmessage = async ({ data }) => {
  try {
    const game = GAMES[data.game];
    if (!game) throw new Error('error.game');
    if (data.rom.size !== game.romSize) throw new Error(`error.romSize.${data.game}`);
    if (game.format === 'sparse') {
      const patchUrl = game.patches[data.language];
      if (!patchUrl) throw new Error('error.patchLanguage');
      const response = await fetch(patchUrl, { cache: 'no-store' }).catch(() => null);
      if (!response?.ok) throw new Error('error.patchUnavailable');
      const blob = await applySparse(data.rom, await response.arrayBuffer(), data.game);
      self.postMessage(data.action === 'validate' ? { validated: true } : { blob });
      return;
    }
    const source = new Uint8Array(await data.rom.arrayBuffer());
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', source));
    const sha1 = Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
    if (sha1 !== game.romSha1) throw new Error(`error.romHash.${data.game}`);
    if (data.action === 'validate') {
      self.postMessage({ validated: true });
      return;
    }
    const patchUrl = game.patches[data.language];
    if (!patchUrl) throw new Error('error.patchLanguage');
    const response = await fetch(patchUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('error.patchUnavailable');
    const patch = new Uint8Array(await response.arrayBuffer());
    const target = applyBps(source, patch);
    self.postMessage({ target: target.buffer }, [target.buffer]);
  } catch (error) {
    self.postMessage({ error: error.message?.startsWith('error.') ? error.message : 'error.patchFailed' });
  }
};
