# skene

A web page as a semantic **Scene**, and the perceive → decide → act loop that
drives it toward a goal. Extracted from
[aristodromos](https://github.com/gavmor/aristodromos), the browser extension
that hosts it. Nothing in here knows about extensions, ports or storage, and
nothing in here knows about any particular site or application.

| Import | What | Needs |
|---|---|---|
| `@gavmor/skene/core` | `Scene` and its patches, `buildActionSchema`, `SceneStore`, `TabScene` (frames → one Scene), `AgentLoop`, the `Brain`/`Decision` seam, `describeScene`, `createGatedBrain` | — |
| `@gavmor/skene/dom` | `SceneProjector`, `applyPlan`, `handlePlan`: perceive and act on a live document (content script, jsdom, a Playwright page) | a DOM |
| `@gavmor/skene/brains/system-one` | the `/v1/systemone` classifier brain, its questions and playbooks | `fetch` |
| `@gavmor/skene/brains/ai-sdk` | the AI SDK brain and free-text value filler | `ai` |
| `@gavmor/skene/tracing` | OpenInference DECISION spans for classifier calls | `@opentelemetry/*`, `@arizeai/openinference-*` |

The optional dependencies are peer dependencies: install only what the subpaths
you import need.

## Use

```bash
pnpm add github:gavmor/skene#v0.1.0   # builds dist/ on install (`prepare`)
```

pnpm runs a dependency's build only when allowed; in the consumer's
`pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@gavmor/skene': true
```

For local development against a checkout: `pnpm link ../skene`.

## Develop

| Command | |
|---|---|
| `pnpm test` | Vitest (jsdom) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm cpd` | jscpd copy-paste detection |
| `pnpm build` | emit `dist/` |
| `pnpm probe` | live probe against a running System One server (not a gate) |

Lefthook runs typecheck, tests and cpd before every commit.
