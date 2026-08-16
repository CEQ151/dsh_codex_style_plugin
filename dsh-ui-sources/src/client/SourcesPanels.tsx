import { forwardRef, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  IconBranchOutline16,
  IconCloseOutline16,
  IconDataOutline16,
  IconFolderOpenOutline16,
  IconGlobeOutline14,
  IconLinkOutline16,
  IconRightUpOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SourceItem } from '../types.ts'
import type { OpenLocalPath } from './controller.ts'
import { NS } from './locales.ts'

type Translate = PropsLocale<typeof NS>['t']

export interface SourcesDetailsInjected {
  closeSources: () => void
  openLocalPath: OpenLocalPath
}

export type SourcesDetailsProps =
  PropsRuntime<'details'>
  & PropsLocale<typeof NS>
  & InjectFace<SourcesDetailsInjected>

interface PanelRuntimeProps {
  cwd: string | undefined
  openLocalPath: OpenLocalPath
  t: Translate
}

interface CompactPanelProps extends PanelRuntimeProps {
  items: SourceItem[]
  style: CSSProperties
  onClose: () => void
}

interface CardPanelProps extends PanelRuntimeProps {
  items: SourceItem[]
  onViewAll: () => void
}

function sourceTitle(item: SourceItem): string {
  if (item.title !== undefined && item.title !== '') return item.title
  return item.domain ?? item.path ?? item.url ?? item.id
}

function sourceTarget(item: SourceItem): string | undefined {
  return item.path ?? item.url
}

function Favicon({ item, compact = false }: { item: SourceItem; compact?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (item.url === undefined || failed) return <IconGlobeOutline14 size={compact ? 16 : 18} />
  let src: string
  try {
    src = `${new URL(item.url).origin}/favicon.ico`
  } catch {
    return <IconGlobeOutline14 size={compact ? 16 : 18} />
  }
  return <img className="dshSources__favicon" src={src} alt="" onError={() => { setFailed(true) }} />
}

function KindIcon({ item, compact = false }: { item: SourceItem; compact?: boolean }) {
  if (item.url !== undefined && item.kind !== 'pdf') return <Favicon item={item} compact={compact} />
  if (item.kind === 'pdf') return <IconDataOutline16 size={compact ? 16 : 18} />
  return <IconFolderOpenOutline16 size={compact ? 16 : 18} />
}

function useSourceActivation(item: SourceItem, cwd: string | undefined, openLocalPath: OpenLocalPath) {
  const [copied, setCopied] = useState(false)
  const activate = async () => {
    if (item.url !== undefined) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
      return
    }
    if (item.path === undefined) return
    try {
      await openLocalPath(cwd, item.path)
    } catch {
      await navigator.clipboard?.writeText(item.path)
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 2200)
    }
  }
  return { activate, copied }
}

function FullSourceRow({ item, cwd, openLocalPath, t }: PanelRuntimeProps & { item: SourceItem }) {
  const { activate, copied } = useSourceActivation(item, cwd, openLocalPath)
  const target = sourceTarget(item)
  const metaKind = item.kind === 'pdf' ? t('meta.pdf') : item.kind === 'file' ? t('meta.file') : item.domain
  return (
    <button
      type="button"
      className="dshSources__fullRow"
      title={item.url !== undefined ? t('action.openWeb') : t('action.openFile')}
      onClick={() => { void activate() }}
    >
      <span className="dshSources__fullIcon"><KindIcon item={item} /></span>
      <span className="dshSources__fullBody">
        <span className="dshSources__fullTitle">{sourceTitle(item)}</span>
        {target !== undefined && <span className="dshSources__fullTarget">{target}</span>}
        <span className="dshSources__fullMeta">
          {metaKind !== undefined && <span>{metaKind}</span>}
          <span>{t('meta.accessed', { count: item.accessCount })}</span>
          {item.referenceCount > 0 && <span>{t('meta.referenced', { count: item.referenceCount })}</span>}
        </span>
        {copied && <span className="dshSources__notice">{t('action.copied')}</span>}
      </span>
      <IconRightUpOutline14 size={14} className="dshSources__openIcon" />
    </button>
  )
}

function CompactSourceRow({ item, cwd, openLocalPath, t }: PanelRuntimeProps & { item: SourceItem }) {
  const { activate, copied } = useSourceActivation(item, cwd, openLocalPath)
  return (
    <button
      type="button"
      className="dshSources__compactRow"
      title={item.url !== undefined ? t('action.openWeb') : t('action.openFile')}
      onClick={() => { void activate() }}
    >
      <span className="dshSources__compactIcon"><KindIcon item={item} compact /></span>
      <span className="dshSources__compactTitle">{sourceTitle(item)}</span>
      {copied && <span className="dshSources__compactNotice">{t('action.copied')}</span>}
    </button>
  )
}

function MoreButton({ expanded, count, t, onClick }: {
  expanded: boolean
  count: number
  t: Translate
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="dshSources__more"
      aria-expanded={expanded}
      aria-label={`${expanded ? t('action.collapse') : t('action.viewAll')} (${count})`}
      onClick={onClick}
    >
      <IconBranchOutline16 size={17} />
      <span>{expanded ? t('action.collapse') : t('action.viewAll')}</span>
    </button>
  )
}

function splitSources(items: SourceItem[]) {
  return {
    referenced: items.filter(item => item.referenced),
    other: items.filter(item => !item.referenced),
  }
}

export function SourcesDetailsPanel({
  sessionId, useProjection, useSessions, openLocalPath, closeSources, t,
}: SourcesDetailsProps): ReactNode {
  const projection = useProjection('sources')
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  const { referenced, other } = useMemo(() => splitSources(projection?.items ?? []), [projection?.items])
  const shared = { cwd, openLocalPath, t }

  return (
    <aside className="dshSources__details" aria-label={t('panel.title')}>
      <header className="dshSources__detailsHeader">
        <div className="dshSources__detailsTab">
          <IconLinkOutline16 size={15} />
          <span>{t('panel.title')}</span>
          <button type="button" className="dshSources__close" aria-label={t('panel.close')} onClick={closeSources}>
            <IconCloseOutline16 size={14} />
          </button>
        </div>
      </header>
      <div className="dshSources__detailsBody">
        {referenced.length > 0 && (
          <>
            <h2 className="dshSources__section">{t('section.referenced')}</h2>
            {referenced.map(item => <FullSourceRow key={item.id} item={item} {...shared} />)}
          </>
        )}
        {other.length > 0 && (
          <>
            <h2 className="dshSources__section">{t('section.other')}</h2>
            {other.map(item => <FullSourceRow key={item.id} item={item} {...shared} />)}
          </>
        )}
        {referenced.length === 0 && other.length === 0 && (
          <p className="dshSources__empty">{t('empty.referenced')}</p>
        )}
      </div>
    </aside>
  )
}

/** Cap and floor for the card's self-fitted width (px). */
const CARD_WIDTH_CAP = 360
const CARD_WIDTH_FLOOR = 160

/** Fit the card into the chat area's right gutter so it never covers the
  * message text: the message column is a centered `--dsh-chat-content-width`
  * box inside a `--dsh-composer-side-clearance` + 16px padded scrollport, so
  * the free space to its right is `side + (width - 2·side - content)/2`. */
function fitCardWidth(scrollport: HTMLElement): number {
  const root = scrollport.closest<HTMLElement>('[data-phase]')
  const style = root !== null ? getComputedStyle(root) : null
  const token = (name: string, fallback: number): number => {
    const match = style !== null ? /^([\d.]+)px$/.exec(style.getPropertyValue(name).trim()) : null
    return match !== null ? Number(match[1]) : fallback
  }
  const contentWidth = token('--dsh-chat-content-width', 748)
  const clearance = token('--dsh-composer-side-clearance', 16)
  const side = clearance + 16
  const width = scrollport.clientWidth
  const gutter = side + Math.max(0, (width - side * 2 - contentWidth) / 2)
  return Math.min(CARD_WIDTH_CAP, Math.max(CARD_WIDTH_FLOOR, Math.round(gutter - 24)))
}

/** The resident top-right card: briefly lists referenced sources, one per
  * single line, with a "view all sources" action that opens the sidebar. */
export function SourcesCard({
  items, cwd, openLocalPath, t, onViewAll,
}: CardPanelProps): ReactNode {
  const { referenced } = useMemo(() => splitSources(items), [items])
  const [cardWidth, setCardWidth] = useState<number | null>(null)
  const rootRef = useRef<HTMLElement>(null)
  const shared = { cwd, openLocalPath, t }

  /* Track the chat scrollport's width (the card lives in a host inside it)
     and keep the card fitted to the right gutter. */
  useLayoutEffect(() => {
    const scrollport = rootRef.current?.parentElement?.parentElement
    if (scrollport === undefined || scrollport === null) return
    const update = () => { setCardWidth(fitCardWidth(scrollport)) }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(scrollport)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <aside
      ref={rootRef}
      className="dshSources__card"
      aria-label={t('card.title')}
      style={cardWidth === null ? undefined : { width: cardWidth }}
    >
      <header className="dshSources__cardHeader">
        <span className="dshSources__cardLabelIcon"><IconLinkOutline16 size={15} /></span>
        <span className="dshSources__cardLabel">{t('card.title')}</span>
        <span className="dshSources__cardCount" aria-label={t('meta.total', { count: items.length })}>
          {items.length}
        </span>
      </header>
      <div className="dshSources__cardList">
        {referenced.length > 0
          ? referenced.map(item => <CompactSourceRow key={item.id} item={item} {...shared} />)
          : <p className="dshSources__empty dshSources__empty--card">{t('empty.referenced')}</p>}
      </div>
      <button type="button" className="dshSources__cardMore" onClick={onViewAll}>
        <IconBranchOutline16 size={16} />
        <span>{t('card.viewAll')}</span>
      </button>
    </aside>
  )
}

export const SourcesCompactPanel = forwardRef<HTMLDivElement, CompactPanelProps>(function SourcesCompactPanel({
  items, cwd, openLocalPath, t, style, onClose,
}, ref) {
  const { referenced, other } = useMemo(() => splitSources(items), [items])
  const [showOther, setShowOther] = useState(false)
  const shared = { items, cwd, openLocalPath, t }
  return (
    <div ref={ref} className="dshSources__compact" style={style} role="dialog" aria-label={t('panel.title')}>
      <header className="dshSources__compactHeader">
        <span>{t('panel.title')}</span>
        <button type="button" className="dshSources__close" aria-label={t('panel.close')} onClick={onClose}>
          <IconCloseOutline16 size={16} />
        </button>
      </header>
      <div className="dshSources__compactList">
        {referenced.length > 0
          ? referenced.map(item => <CompactSourceRow key={item.id} item={item} {...shared} />)
          : <p className="dshSources__empty dshSources__empty--compact">{t('empty.referenced')}</p>}
        {showOther && other.map(item => <CompactSourceRow key={item.id} item={item} {...shared} />)}
        {other.length > 0 && (
          <MoreButton expanded={showOther} count={other.length} t={t} onClick={() => { setShowOther(value => !value) }} />
        )}
      </div>
    </div>
  )
})
