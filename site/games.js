import { PATCH_VERSION, SAGA_PATCH_VERSION, VS_PATCH_VERSION, VS3_PATCH_VERSION } from './version.mjs?v=20261127-hub-55';

export const GAMES = {
  legacy: {
    format: 'bps',
    source: 'https://github.com/jmacato/ZoidsLegacyDecomp',
    extension: '.gba',
    romSize: 8 * 1024 * 1024,
    romSha1: '460fa2158606097f6e6f63ce966d2d6ecdd58d70',
    version: PATCH_VERSION,
    patches: { en: './patch.bps', es: './patch-es.bps' },
    filenames: { en: 'download.legacy.en', es: 'download.legacy.es' },
    extractor: true
  },
  saga: {
    format: 'bps',
    source: 'https://github.com/jmacato/ZoidsSagaOne',
    extension: '.gba',
    romSize: 8 * 1024 * 1024,
    romSha1: '75d8c15ac281ea93c8ac7cc7641c490799557081',
    version: SAGA_PATCH_VERSION,
    patches: { en: './patch-saga.bps' },
    filenames: { en: 'download.saga.en' },
    extractor: false
  },
  vs: {
    format: 'sparse',
    source: 'https://github.com/jmacato/ZoidsVSOne',
    extension: '.iso',
    romSize: 1459978240,
    romSha1: '245646d06744e6a21ed95f7bdaa66617732f4ea3',
    version: VS_PATCH_VERSION,
    patches: { en: './patch-vs.zsp' },
    filenames: { en: 'download.vs.en' },
    extractor: false
  },
  vs3: {
    format: 'sparse',
    source: 'https://github.com/jmacato/ZoidsVSThree',
    extension: '.iso',
    romSize: 1459978240,
    romSha1: 'b90e034c3d698aaff184fc514a0fcba6df754e64',
    version: VS3_PATCH_VERSION,
    patches: { en: './patch-vs3.zsp' },
    filenames: { en: 'download.vs3.en' },
    extractor: false
  }
};

export const DEFAULT_GAME = 'legacy';
