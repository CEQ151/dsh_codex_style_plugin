import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, useLayoutEffect: actual.useEffect }
})

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const Icon = () => null
  return {
    IconBranchOutline16: Icon,
    IconChevronDownOutline14: Icon,
    IconChevronUpOutline14: Icon,
    IconCloseOutline16: Icon,
    IconDataOutline16: Icon,
    IconEditOutline16: Icon,
    IconFolderOpenOutline16: Icon,
    IconGlobeOutline14: Icon,
    IconLinkOutline16: Icon,
    IconRightUpOutline14: Icon,
  }
})

import { SourcesCard, SourcesCompactPanel } from '../src/client/SourcesPanels.tsx'
import { EditedFilesCard } from '../src/client/EditedFilesCard.tsx'
import type { SourceItem, TurnFileChanges } from '../src/types.ts'

function t(key: string, params?: Record<string, unknown>): string {
  const table: Record<string, string> = {
    'card.title': '引用来源',
    'card.viewAll': '查看全部来源',
    'empty.referenced': '本轮回答尚未引用来源',
    'panel.title': '来源',
    'panel.close': '关闭来源面板',
    'edited.title': '已编辑 {count} 个文件',
    'edited.more': '再显示 {count} 个文件',
    'edited.collapse': '收起',
  }
  const template = table[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

const shared = {
  cwd: 'D:/project',
  openLocalPath: async () => {},
  t: t as never,
}

const items: SourceItem[] = [
  {
    id: 'file:src/a.ts',
    kind: 'file',
    referenced: true,
    accessCount: 1,
    referenceCount: 1,
    firstSeenSeq: 1,
    referenceOrder: 1,
    title: 'a.ts',
    path: 'src/a.ts',
  },
]

const changes: TurnFileChanges = {
  turn: 1,
  files: [
    {
      path: 'src/a.ts',
      diffs: [
        { path: 'src/a.ts', oldText: 'const a = 1', newText: 'const a = 2' },
      ],
    },
  ],
}

function editedProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    openFile: () => {},
    t: t as never,
    matched: changes,
    ...overrides,
  } as never
}

describe('SourcesPanels components', () => {
  it('renders sources card without a file-change section', () => {
    const html = renderToStaticMarkup(
      <SourcesCard
        items={items}
        cwd={shared.cwd}
        openLocalPath={shared.openLocalPath}
        t={shared.t}
        onViewAll={() => {}}
      />,
    )

    expect(html).toContain('dshSources__card')
    expect(html).toContain('dshSources__compactRow')
    expect(html).not.toContain('本轮修改的文件')
    expect(html).not.toContain('dshSources__editedCard')
  })

  it('renders a compact sources panel without a file-change section', () => {
    const html = renderToStaticMarkup(
      <SourcesCompactPanel
        items={items}
        cwd={shared.cwd}
        openLocalPath={shared.openLocalPath}
        t={shared.t}
        style={{ top: 0, right: 0 }}
        onClose={() => {}}
      />,
    )

    expect(html).toContain('dshSources__compact')
    expect(html).not.toContain('dshSources__editedCard')
  })

  it('renders the edited-files summary card with totals and file stats', () => {
    const html = renderToStaticMarkup(<EditedFilesCard {...editedProps()} />)

    expect(html).toContain('已编辑 1 个文件')
    expect(html).toContain('+1')
    expect(html).toContain('-1')
    expect(html).toContain('src/')
    expect(html).toContain('a.ts')
  })

  it('renders an expand control when more than three files changed', () => {
    const manyChanges: TurnFileChanges = {
      turn: 1,
      files: [1, 2, 3, 4].map(index => ({
        path: `src/file-${index}.ts`,
        diffs: [{ path: `src/file-${index}.ts`, oldText: 'old', newText: 'new' }],
      })),
    }
    const html = renderToStaticMarkup(
      <EditedFilesCard
        {...editedProps({ matched: manyChanges })}
      />,
    )

    expect(html).toContain('已编辑 4 个文件')
    expect(html).toContain('再显示 1 个文件')
  })

  it('renders nothing when the turn has no file changes', () => {
    const html = renderToStaticMarkup(
      <EditedFilesCard
        {...editedProps({ matched: { turn: 1, files: [] } })}
      />,
    )

    expect(html).toBe('')
  })
})
