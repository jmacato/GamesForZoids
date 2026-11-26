# Games for Zoids

Source for the Games for Zoids patch site. It applies fan translation patches in the browser for Zoids Legacy (English and Spanish), Zoids Saga, Zoids VS. and Zoids VS. III. You need your own copy of each game. The site does not include ROMs or disc images.

The translations are built in their own repositories: [ZoidsLegacyDecomp](https://github.com/jmacato/ZoidsLegacyDecomp), [ZoidsSagaOne](https://github.com/jmacato/ZoidsSagaOne), [ZoidsVSOne](https://github.com/jmacato/ZoidsVSOne) and [ZoidsVSThree](https://github.com/jmacato/ZoidsVSThree). Each one writes its patch into `site/`.

## Run the site

Serve `site/` with any static file server and open `index.html`. The patcher runs in a web worker and needs HTTP, not `file://`.

Before you change a frame or other vector drawing, read `AGENTS.md`. Run `node tools/audit_site_frames.mjs`. It must exit 0.

## Tools

- `tools/make_bps.mjs SOURCE TARGET OUT` makes a BPS patch. `tools/make_sparse_patch.mjs` makes the sparse patches used for the GameCube discs.
- `python3 tools/make_logotype.py` writes `art/logotype.svg` from Xolonium Bold. Add `--page` to also replace the logotype in `site/index.html`.
- `node tools/battle_mechanics/build.mjs` turns `BATTLE_MECHANICS.md` into `site/battle-mechanics.html`. Run `npm install` in `tools/battle_mechanics` first.
- `extract/` is the Zoids Legacy asset extractor (Rust). `cargo run --release -- run --rom ROM --out DIR` writes `plan.json`, and `cargo run --release -- page --plan DIR/plan.json --out site/rom-tool.html` builds the extractor page.

## License

AGPL-3.0-only. See `LICENSE` and `NOTICE`. The Xolonium font stays under the SIL Open Font License 1.1. Zoids names, artwork, screenshots and game data belong to their owners.
