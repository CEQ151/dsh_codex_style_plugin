import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { IconChecklistOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { OpenLocalPath, SourcesPanelController } from './controller.ts'
import { NS } from './locales.ts'
import { SourcesCard, SourcesCompactPanel } from './SourcesPanels.tsx'

const DETAILS_BREAKPOINT = 1220

export interface SourcesPanelInjected {
  openLocalPath: OpenLocalPath
  panel: SourcesPanelController
}

export type SourcesPanelProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<SourcesPanelInjected>

interface PanelPosition {
  top: number
  right: number
}

function isCompactViewport(): boolean {
  return window.innerWidth < DETAILS_BREAKPOINT
}

/** The chat scrollport — the resident card lives in flow at its top. */
function conversationScrollport(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-conversation-scroll]')
}

export function SourcePanelAction({
  sessionId, useProjection, useSessions, openLocalPath, panel, t,
}: SourcesPanelProps): ReactNode {
  const projection = useProjection('sources')
  const cwd = useSessions(state => state.byId[sessionId]?.cwd)
  const items = projection?.items ?? []
  const panelState = useSyncExternalStore(panel.subscribe, panel.getSnapshot, panel.getSnapshot)
  const [compactViewport, setCompactViewport] = useState(isCompactViewport)
  const [compactOpen, setCompactOpen] = useState(false)
  const [position, setPosition] = useState<PanelPosition>({ top: 56, right: 12 })
  const [cardHost, setCardHost] = useState<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const compactRef = useRef<HTMLDivElement>(null)
  const initialProjectionSeen = useRef(false)
  const previousCount = useRef(0)
  const autoOpened = useRef(false)
  const open = compactViewport ? compactOpen : (panelState.cardVisible && !panelState.detailsOpen)

  useEffect(() => {
    const updateViewport = () => {
      const compact = isCompactViewport()
      setCompactViewport(compact)
      if (!compact) setCompactOpen(false)
      else panel.closeDetails()
    }
    window.addEventListener('resize', updateViewport)
    return () => { window.removeEventListener('resize', updateViewport) }
  }, [panel])

  useEffect(() => {
    if (projection === undefined) return
    if (!initialProjectionSeen.current) {
      initialProjectionSeen.current = true
      previousCount.current = items.length
      return
    }
    if (!autoOpened.current && previousCount.current === 0 && items.length > 0) {
      autoOpened.current = true
      if (isCompactViewport()) setCompactOpen(true)
    }
    previousCount.current = items.length
  }, [items.length, projection])

  useEffect(() => {
    if (items.length !== 0) return
    setCompactOpen(false)
    panel.closeDetails()
  }, [items.length, panel])

  useEffect(() => () => {
    panel.closeDetails()
  }, [panel, sessionId])

  /* The resident card lives in flow at the top of the chat scrollport and
     sticks to its top while the conversation scrolls (the "resident top-right"
     contract): it occupies its own row — the messages start below it and are
     never covered at the top — and stays visible when scrolled down. A host
     node is inserted as the scrollport's first child and the card is portaled
     into it, right-aligned via flex. The scrollport lookup retries briefly in
     case the slot mounts before the conversation body commits. */
  useLayoutEffect(() => {
    if (compactViewport) {
      setCardHost(null)
      return
    }
    let cancelled = false
    let host: HTMLDivElement | null = null
    let attempts = 0
    const mount = () => {
      if (cancelled) return
      const scrollport = conversationScrollport()
      if (scrollport === null) {
        attempts += 1
        if (attempts < 8) requestAnimationFrame(mount)
        return
      }
      host = document.createElement('div')
      host.dataset.uiSourcesCardHost = ''
      host.style.position = 'sticky'
      host.style.top = '0px'
      host.style.zIndex = '6'
      host.style.pointerEvents = 'none'
      host.style.display = 'flex'
      host.style.flex = 'none'
      host.style.justifyContent = 'flex-end'
      scrollport.insertBefore(host, scrollport.firstChild)
      setCardHost(host)
    }
    mount()
    return () => {
      cancelled = true
      setCardHost(null)
      host?.remove()
    }
  }, [compactViewport, sessionId])

  useLayoutEffect(() => {
    if (!compactOpen) return
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect()
      setPosition({
        top: Math.round((rect?.bottom ?? 48) + 8),
        right: Math.max(12, Math.round(window.innerWidth - (rect?.right ?? window.innerWidth - 12))),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [compactOpen])

  useEffect(() => {
    if (!compactOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target === null || compactRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setCompactOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCompactOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [compactOpen])

  /* The header button toggles the resident card only — the sidebar is
     controlled exclusively by the card's "view all sources" action. */
  const toggle = () => {
    if (compactViewport) setCompactOpen(value => !value)
    else panel.toggleCard()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`dshSources__trigger${open ? ' dshSources__trigger--active' : ''}`}
        disabled={items.length === 0}
        aria-expanded={open}
        aria-label={items.length === 0 ? t('button.empty') : t('button.label')}
        title={items.length === 0 ? t('button.empty') : t('button.label')}
        onClick={toggle}
      >
        <IconChecklistOutline14 size={18} />
      </button>
      {/* The card shows only while the sidebar is closed: opening the sidebar
          (via "view all sources") hides the card, closing the sidebar brings
          it back. The header button still only toggles the card preference. */}
      {!compactViewport && panelState.cardVisible && !panelState.detailsOpen && items.length > 0 && cardHost !== null && createPortal(
        <SourcesCard
          items={items}
          cwd={cwd}
          openLocalPath={openLocalPath}
          t={t}
          onViewAll={() => { panel.openDetails() }}
        />,
        cardHost,
      )}
      {compactOpen && createPortal(
        <SourcesCompactPanel
          ref={compactRef}
          items={items}
          cwd={cwd}
          openLocalPath={openLocalPath}
          t={t}
          style={{ top: position.top, right: position.right }}
          onClose={() => { setCompactOpen(false) }}
        />,
        document.body,
      )}
    </>
  )
}
