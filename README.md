# Workspace Studio

[![CI](https://github.com/lucky-ivanius/workspace-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/lucky-ivanius/workspace-studio/actions/workflows/ci.yml)

An interactive studio for designing a Bali workspace from [monis.rent](https://monis.rent)
rental gear, then renting the whole setup. Pick a desk, add a chair, drop in
monitors and a lamp, arrange everything on an isometric grid, and check out.

## Getting started

```bash
pnpm install
pnpm exec playwright install chromium   # once, for the browser tests
pnpm dev
```

Open http://localhost:3000.

## Docs

- [docs/FOUNDATION.md](./docs/FOUNDATION.md) — architecture, the isometric grid,
  the asset contract, and the product data pipeline. **Read this before adding
  art or products.**
- [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md) — the brief.

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
| `pnpm catalog:sync`        | Refresh product data from monis.rent           |
| `pnpm assets:placeholders` | Draw stand-in art for any asset missing a PNG  |
