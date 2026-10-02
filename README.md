# Workspace Studio

[![CI](https://github.com/lucky-ivanius/workspace-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/lucky-ivanius/workspace-studio/actions/workflows/ci.yml)

An interactive studio for designing a Bali workspace from [monis.rent](https://monis.rent)
rental gear, then renting the whole setup. Pick a desk, add a chair, drop in
monitors and a lamp, arrange everything on an isometric grid, and check out.

The room is a pixi.js canvas with an isometric grid. Everything you place snaps
to tiles, items can sit on top of other items (a monitor on a desk), and the
scene depth-sorts as you drag things around.

## Getting started

```bash
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
pnpm dev
```

Open http://localhost:3000.

## Commands

| Command                    | What it does                                   |
| -------------------------- | ---------------------------------------------- |
| `pnpm dev`                 | Dev server                                     |
| `pnpm build`               | Production build                               |
| `pnpm test`                | Unit tests: grid, placement, store, pricing    |
| `pnpm test:e2e`            | Playwright browser tests (Chromium)            |
| `pnpm typecheck`           | `tsc --noEmit`                                 |
| `pnpm lint`                | Biome check                                    |
| `pnpm format`              | Biome format                                   |
| `pnpm catalog:sync`        | Re-seed product data from monis.rent           |
| `pnpm art:index`           | List `public/assets/studio` for the app to read |
| `pnpm assets:placeholders` | Draw stand-in art for any drawing missing a PNG |
