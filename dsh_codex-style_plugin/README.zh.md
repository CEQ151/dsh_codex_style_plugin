# dsh-ui-sources

为 DeepSeek Harness Web UI 提供一个接近 Codex 交互方式的“来源”面板。

插件严格沿用 DSH 的扩展边界：

- Host 侧会话投影折叠 DSH 原有的持久化会话事件；
- Client 侧通过 `conversation.session.header.utilities` 增加右上角按钮；
- 宽屏下聊天区右上角常驻“引用来源”卡片，单行列出已引用的网页，卡片底部提供“查看全部来源”；
- “查看全部来源”展开 DSH 原生可调宽度右栏（`details` 插槽），完整展示已引用与未引用的全部来源，卡片保持不动；右栏通过标题“来源”右侧的叉号关闭；
- 会话日志右侧的来源按钮只控制卡片的显隐，不影响右栏的展开与关闭；
- 窄屏自动退化为 Codex 风格的右上角圆角临时浮层；
- 只在 `turn/end` 后发布新数据，回答过程中不会频繁刷新。

## 功能

- 汇总所有成功的 `web_search` 来源和 `web_fetch` 页面。
- 汇总成功读取、编辑或创建的本地文件与 PDF；命令与命令输出不会进入来源面板。
- 每次完成一轮问答后，若该轮修改了文件，在助手消息正文与操作按钮之间插入文件变更摘要卡片，显示已编辑文件数、总增删行数、各文件路径和单文件增删行数，并支持展开更多文件。
- 在整个会话内去重，并显示访问次数和引用次数。
- 已引用来源按首次引用顺序排列；右栏按“已引用 / 其他来源”分组完整展示。
- 重新打开历史会话时，通过原始会话日志完整恢复。
- 网站在浏览器新标签页打开；本地文件交给 DSH Host 的系统打开能力。
- 自动跟随 DSH 的语言与主题，小屏幕下显示为右上角临时浮层。

## 从本地压缩包安装

```sh
npm install
npm run build
npm pack
npx @deepseek-ai/dsh plugin --profile web add -w D:\dsh-ui-sources\dsh-ui-sources-0.3.0.tgz
npx @deepseek-ai/dsh web
```

将来发布到 npm 后，可直接按包名安装：

```sh
npx @deepseek-ai/dsh plugin --profile web add -w dsh-ui-sources
```

## 开发验证

```sh
npm run check
npm test
npm run build
npm run pack:check
```

当前目标版本为 DSH `0.1.0-rc.6`。插件不会保存 API Key 或模型凭据。

## 引用判定

最终助手消息中出现规范化 URL 或本地文件路径时，该来源被视为“已引用”；成功访问但未在回答中出现的资料仍会保留在默认折叠的“其他来源”中。
