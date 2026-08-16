# dsh-codex-chat-layout

Left-anchored Codex-style conversation lane for DeepSeek Harness Web UI.

- Keeps the conversation column near the sidebar with a stable left gutter.
- Lets extra window width accumulate on the right as a future workspace.
- Composer shares the same left edge as the conversation column.

## Install

```sh
npm pack
npx @deepseek-ai/dsh plugin --profile web add -w dsh-codex-chat-layout-0.1.0.tgz
npx @deepseek-ai/dsh web
```
