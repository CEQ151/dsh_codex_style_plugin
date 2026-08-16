# dsh_codex_style_plugin

Codex-style plugins for DeepSeek Harness.

This repository is a monorepo. Each directory is one installable DSH plugin.

## Plugins

| Directory | Package | Description |
| --- | --- | --- |
| `dsh_codex-style_plugin` | `dsh_codex-style_plugin` | Codex-style sources panel + per-turn file-change summary card + left-anchored conversation layout. |

## Development

Each plugin has its own `package.json` and can be built independently:

```sh
cd dsh_codex-style_plugin
npm install
npm run check
npm test
npm run build
npm pack
```

## Releases

Ready-to-install tarballs are kept under `releases/`.

```sh
npx @deepseek-ai/dsh plugin --profile web add -w releases/dsh_codex-style_plugin-0.3.7.tgz
```
