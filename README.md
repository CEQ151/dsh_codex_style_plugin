# dsh_codex_style_plugin

Codex-style plugins for DeepSeek Harness.

This repository is a monorepo. Each directory is one installable DSH plugin.

## Plugins

| Directory | Package | Description |
| --- | --- | --- |
| `dsh-ui-sources` | `dsh-ui-sources` | Codex-style sources panel + per-turn file-change summary card. |
| `dsh-codex-chat-layout` | `dsh-codex-chat-layout` | Left-anchored conversation lane; extra width stays on the right workspace. |

## Development

Each plugin has its own `package.json` and can be built independently:

```sh
cd dsh-ui-sources
npm install
npm run check
npm test
npm run build
npm pack
```

## Releases

Ready-to-install tarballs are kept under `releases/`.

```sh
npx @deepseek-ai/dsh plugin --profile web add -w releases/dsh-ui-sources-0.3.7.tgz
npx @deepseek-ai/dsh plugin --profile web add -w releases/dsh-codex-chat-layout-0.1.0.tgz
```
