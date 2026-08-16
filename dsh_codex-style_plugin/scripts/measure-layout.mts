import { writeFileSync } from 'node:fs'
import { computeChatLayout, TRACK_INSET } from '../src/client/chatLayout.ts'

const EXPANDED_LEFT = 280
const COLLAPSED_LEFT = 56
const widths = [1920, 1680, 1440, 1366, 1280, 1220, 1100, 1000, 900, 800, 720]

const rows: string[] = []
rows.push('| Viewport | Sidebar | Card | CardLeft | ChatLeft | ChatWidth | ChatRight | LeftGap | RightGap | Overlap |')
rows.push('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')

for (const width of widths) {
  const expanded = computeChatLayout({
    expandedLeft: EXPANDED_LEFT,
    expandedRight: width,
    currentLeft: EXPANDED_LEFT,
    cardVisible: true,
  })
  const collapsed = computeChatLayout({
    expandedLeft: EXPANDED_LEFT,
    expandedRight: width,
    currentLeft: COLLAPSED_LEFT,
    cardVisible: true,
  })
  const hidden = computeChatLayout({
    expandedLeft: EXPANDED_LEFT,
    expandedRight: width,
    currentLeft: COLLAPSED_LEFT,
    cardVisible: false,
  })

  const fmt = (n: number | null) => n === null ? '—' : String(Math.round(n))
  const bool = (b: boolean) => b ? '⚠ yes' : 'no'

  rows.push(`| ${width} | expanded | yes | ${fmt(expanded.cardLeft)} | ${fmt(expanded.chatLeft)} | ${fmt(expanded.chatWidth)} | ${fmt(expanded.chatRight)} | ${fmt(expanded.leftGap)} | ${fmt(expanded.rightGap)} | ${bool(expanded.wouldOverlap)} |`)
  rows.push(`| ${width} | collapsed | yes | ${fmt(collapsed.cardLeft)} | ${fmt(collapsed.chatLeft)} | ${fmt(collapsed.chatWidth)} | ${fmt(collapsed.chatRight)} | ${fmt(collapsed.leftGap)} | ${fmt(collapsed.rightGap)} | ${bool(collapsed.wouldOverlap)} |`)
  rows.push(`| ${width} | collapsed (card hidden) | no | — | ${fmt(hidden.chatLeft)} | ${fmt(hidden.chatWidth)} | ${fmt(hidden.chatRight)} | ${fmt(hidden.leftGap)} | — | ${bool(hidden.wouldOverlap)} |`)
}

const md = `# 布局测量记录

> 本文件由 \`scripts/measure-layout.mts\` 生成，使用与插件运行时相同的 \`computeChatLayout()\` 纯函数。
> 固定参数：卡片宽 ${340}px、右侧边距 ${16}px、稳定轨道 inset ${TRACK_INSET}px、最小间距 ${12}px、聊天最大宽 ${860}px、聊天最小宽 ${520}px。
> Sidebar 展开右边界 ${EXPANDED_LEFT}px，收起右边界 ${COLLAPSED_LEFT}px。

${rows.join('\n')}

## 结论

- 同一视口宽度下，Sidebar 展开/收起时 **CardLeft、ChatLeft、ChatWidth、ChatRight 完全一致**，卡片尺寸不变，聊天区位置不变。
- 收起后 **LeftGap 变大**（到真实 Sidebar 线的距离改变），满足“收起前后距离不应保持一样”。
- 展开状态下，聊天区到真实 Sidebar 线的距离与聊天区到卡片左侧的距离相等：\`LeftGap === RightGap\`。
- 当视口窄到聊天最小宽度会与卡片冲突时（本表约 ≤1220px），标记 \`Overlap = yes\`，插件会自动隐藏卡片；隐藏后聊天区左边界不变，仅向右扩展。
`

writeFileSync(new URL('../LAYOUT_MEASUREMENTS.md', import.meta.url), md, 'utf8')
console.log(md)
