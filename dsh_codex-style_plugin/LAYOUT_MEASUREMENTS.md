# 布局测量记录

> 本文件由 `scripts/measure-layout.mts` 生成，使用与插件运行时相同的 `computeChatLayout()` 纯函数。
> 固定参数：卡片宽 340px、右侧边距 16px、稳定轨道 inset 0px、最小间距 12px、聊天最大宽 860px、聊天最小宽 520px。
> Sidebar 展开右边界 280px，收起右边界 56px。

| Viewport | Sidebar | Card | CardLeft | ChatLeft | ChatWidth | ChatRight | LeftGap | RightGap | Overlap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1920 | expanded | yes | 1564 | 492 | 860 | 1352 | 212 | 212 | no |
| 1920 | collapsed | yes | 1564 | 492 | 860 | 1352 | 436 | 212 | no |
| 1920 | collapsed (card hidden) | no | — | 662 | 860 | 1522 | 606 | — | no |
| 1680 | expanded | yes | 1324 | 372 | 860 | 1232 | 92 | 92 | no |
| 1680 | collapsed | yes | 1324 | 372 | 860 | 1232 | 316 | 92 | no |
| 1680 | collapsed (card hidden) | no | — | 542 | 860 | 1402 | 486 | — | no |
| 1440 | expanded | yes | 1084 | 292 | 780 | 1072 | 12 | 12 | no |
| 1440 | collapsed | yes | 1084 | 292 | 780 | 1072 | 236 | 12 | no |
| 1440 | collapsed (card hidden) | no | — | 422 | 860 | 1282 | 366 | — | no |
| 1366 | expanded | yes | 1010 | 292 | 706 | 998 | 12 | 12 | no |
| 1366 | collapsed | yes | 1010 | 292 | 706 | 998 | 236 | 12 | no |
| 1366 | collapsed (card hidden) | no | — | 385 | 860 | 1245 | 329 | — | no |
| 1280 | expanded | yes | 924 | 292 | 620 | 912 | 12 | 12 | no |
| 1280 | collapsed | yes | 924 | 292 | 620 | 912 | 236 | 12 | no |
| 1280 | collapsed (card hidden) | no | — | 342 | 860 | 1202 | 286 | — | no |
| 1220 | expanded | yes | 864 | 292 | 560 | 852 | 12 | 12 | no |
| 1220 | collapsed | yes | 864 | 292 | 560 | 852 | 236 | 12 | no |
| 1220 | collapsed (card hidden) | no | — | 312 | 860 | 1172 | 256 | — | no |
| 1100 | expanded | yes | 744 | 292 | 440 | 732 | 12 | 12 | ⚠ yes |
| 1100 | collapsed | yes | 744 | 292 | 440 | 732 | 236 | 12 | ⚠ yes |
| 1100 | collapsed (card hidden) | no | — | 292 | 780 | 1072 | 236 | — | no |
| 1000 | expanded | yes | 644 | 292 | 340 | 632 | 12 | 12 | ⚠ yes |
| 1000 | collapsed | yes | 644 | 292 | 340 | 632 | 236 | 12 | ⚠ yes |
| 1000 | collapsed (card hidden) | no | — | 292 | 680 | 972 | 236 | — | no |
| 900 | expanded | yes | 544 | 292 | 240 | 532 | 12 | 12 | ⚠ yes |
| 900 | collapsed | yes | 544 | 292 | 240 | 532 | 236 | 12 | ⚠ yes |
| 900 | collapsed (card hidden) | no | — | 292 | 580 | 872 | 236 | — | no |
| 800 | expanded | yes | 444 | 292 | 140 | 432 | 12 | 12 | ⚠ yes |
| 800 | collapsed | yes | 444 | 292 | 140 | 432 | 236 | 12 | ⚠ yes |
| 800 | collapsed (card hidden) | no | — | 292 | 480 | 772 | 236 | — | no |
| 720 | expanded | yes | 364 | 292 | 60 | 352 | 12 | 12 | ⚠ yes |
| 720 | collapsed | yes | 364 | 292 | 60 | 352 | 236 | 12 | ⚠ yes |
| 720 | collapsed (card hidden) | no | — | 292 | 400 | 692 | 236 | — | no |

## 结论

- 同一视口宽度下，Sidebar 展开/收起时 **CardLeft、ChatLeft、ChatWidth、ChatRight 完全一致**，卡片尺寸不变，聊天区位置不变。
- 收起后 **LeftGap 变大**（到真实 Sidebar 线的距离改变），满足“收起前后距离不应保持一样”。
- 展开状态下，聊天区到真实 Sidebar 线的距离与聊天区到卡片左侧的距离相等：`LeftGap === RightGap`。
- 当视口窄到聊天最小宽度会与卡片冲突时（本表约 ≤1220px），标记 `Overlap = yes`，插件会自动隐藏卡片；隐藏后聊天区左边界不变，仅向右扩展。

---

# 真实浏览器测量（Chrome Headless / DSH 3081）

> 测量方式：用 Chrome Headless 打开实际 DSH 页面，进入 `codex源代码桌面端UI设计框架` 会话，
> 通过 CDP 读取 `[data-conversation-scroll]`、`[data-chat-flow]`、`.dshSources__card` 的 `getBoundingClientRect()`，
> 并切换侧边栏收起/展开、改变窗口尺寸。插件版本 `0.4.6`。

| innerWidth | Sidebar | Card | CardLeft | CardWidth | ChatLeft | ChatWidth | ChatRight | LeftGap | RightGap | Overlap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1416 | expanded | yes | 1052 | 340 | 292 | 748 | 1040 | 12 | 12 | no |
| 1416 | collapsed | yes | 1052 | 340 | 292 | 748 | 1040 | 236 | 12 | no |
| 1100 | collapsed | hidden | — | — | 292 | 772 | 1064 | 236 | — | auto-hide |
| 1000 | collapsed | hidden | — | — | 292 | 672 | 964 | 236 | — | auto-hide |

结论（真实浏览器）：

- 同一窗口宽度下，Sidebar 展开/收起时卡片 `CardLeft/CardWidth` 完全不变。
- 聊天区 `ChatLeft/ChatWidth/ChatRight` 也完全不变；`LeftGap` 从 12 变为 236，符合“收起前后距离不应保持一样”。
- 展开时 `LeftGap === RightGap === 12`，聊天区位于 Sidebar 与引用来源卡片正中间。
- 窗口缩窄到 1100/1000 时，引用来源卡片自动隐藏，聊天区左边界仍保持 292，只调整宽度，不发生重叠。
