# dsh-ui-sources

A Codex-style, whole-session Sources panel for the DeepSeek Harness web UI.

The plugin stays inside DSH's extension contracts:

- a Host-side session projection folds the durable session event log;
- a Client contribution uses `conversation.session.header.utilities` for the button;
- wide screens show a resident "Referenced sources" card pinned at the chat area's
  top-right, listing referenced web pages one per line, with a "View all sources" action;
- "View all sources" opens DSH's native resizable `details` column with the complete
  source list (referenced + other); the card stays in place, and the sidebar closes
  via the "×" next to the "Sources" title;
- the session-log button only toggles the card; it never affects the sidebar;
- narrow screens fall back to a Codex-style rounded popover anchored at the top right;
- published data changes only on `turn/end`, avoiding mid-answer UI churn.

## Features

- Collects every successful `web_search` source and `web_fetch` page.
- Collects successful local file/PDF reads and edits; commands and command output are deliberately excluded.
- After each completed turn that changed files, inserts a file-change summary card between the assistant message body and its action buttons, showing the edited file count, total added/deleted lines, per-file paths and line counts, with an expand control for more files.
- Deduplicates sources across the conversation and shows access/reference counts.
- Orders referenced sources by first citation; the sidebar shows all sources grouped into "Referenced" and "Other sources".
- Restores complete source history by replaying the original session log.
- Opens web sources in a new tab and local files through DSH's Host opener.
- Follows DSH locale and theme tokens; adapts to narrow screens.

## Install from a tarball

```sh
npm install
npm run build
npm pack
npx @deepseek-ai/dsh plugin --profile web add -w D:\dsh-ui-sources\dsh-ui-sources-0.3.0.tgz
npx @deepseek-ai/dsh web
```

After publication, the intended package-name install is:

```sh
npx @deepseek-ai/dsh plugin --profile web add -w dsh-ui-sources
```

## Development

```sh
npm run check
npm test
npm run build
npm run pack:check
```

The package currently targets DSH `0.1.0-rc.6`. No API keys or model credentials are stored by this plugin.

## Source classification

A source is considered referenced when a finalized assistant message contains its canonical URL or file path. A successful access without such a citation remains available under the collapsed “Other sources” group.
