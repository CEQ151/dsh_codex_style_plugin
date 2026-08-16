import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export const CARD_WIDTH = 340
export const CARD_MARGIN_RIGHT = 16
export const TRACK_INSET = 0
export const CONTENT_PADDING = 32
export const MIN_GAP = 12
export const CHAT_MAX_WIDTH = 860
export const CHAT_MIN_WIDTH = 520
export const SIDEBAR_EXPANDED_WIDTH = 280
export const SIDEBAR_COLLAPSED_WIDTH = 56

export interface ChatLayoutInput {
  /** Scrollport left edge when the sidebar is expanded (absolute px). */
  expandedLeft: number
  /** Scrollport right edge (absolute px). */
  expandedRight: number
  /** Current scrollport left edge (absolute px). */
  currentLeft: number
  /** Whether the resident sources card is currently mounted. */
  cardVisible: boolean
  cardWidth?: number
  cardMarginRight?: number
  trackInset?: number
  minGap?: number
  chatMaxWidth?: number
  chatMinWidth?: number
}

export interface ChatLayoutResult {
  /** Stable left boundary of the conversation track (absolute px). */
  stableLeft: number
  /** Card left edge when visible; otherwise null. */
  cardLeft: number | null
  cardWidth: number
  /** Absolute left edge of the chat lane. */
  chatLeft: number
  /** Chat lane width. */
  chatWidth: number
  /** Absolute right edge of the chat lane. */
  chatRight: number
  /** Distance from the current sidebar right edge to the chat left edge. */
  leftGap: number
  /** Distance from chat right edge to card left edge when card is visible. */
  rightGap: number | null
  /** True when the card would overlap / crowd the chat at this width. */
  wouldOverlap: boolean
}

export function computeChatLayout(input: ChatLayoutInput): ChatLayoutResult {
  const {
    expandedLeft,
    expandedRight,
    currentLeft,
    cardVisible,
    cardWidth = CARD_WIDTH,
    cardMarginRight = CARD_MARGIN_RIGHT,
    trackInset = TRACK_INSET,
    minGap = MIN_GAP,
    chatMaxWidth = CHAT_MAX_WIDTH,
    chatMinWidth = CHAT_MIN_WIDTH,
  } = input

  const stableLeft = expandedLeft + trackInset
  const cardLeft = expandedRight - cardMarginRight - cardWidth
  const rightEdge = expandedRight - cardMarginRight

  const visibleTrack = Math.max(0, cardLeft - stableLeft)
  const visibleWidth = Math.min(chatMaxWidth, Math.max(0, visibleTrack - minGap * 2))
  const visibleLeft = stableLeft + Math.max(minGap, (visibleTrack - visibleWidth) / 2)
  const wouldOverlap = cardVisible && visibleTrack < chatMinWidth + minGap * 2

  if (cardVisible) {
    const chatRight = visibleLeft + visibleWidth
    return {
      stableLeft,
      cardLeft,
      cardWidth,
      chatLeft: visibleLeft,
      chatWidth: visibleWidth,
      chatRight,
      leftGap: visibleLeft - currentLeft,
      rightGap: cardLeft - chatRight,
      wouldOverlap,
    }
  }

  // Card is hidden (user preference or automatic overlap hiding). Use the full
  // scrollport right edge while keeping the same stable left track.
  const hiddenTrack = Math.max(0, rightEdge - stableLeft)
  const hiddenWidth = Math.min(chatMaxWidth, Math.max(0, hiddenTrack - minGap * 2))
  const hiddenLeft = stableLeft + Math.max(minGap, (hiddenTrack - hiddenWidth) / 2)
  const hiddenRight = hiddenLeft + hiddenWidth
  return {
    stableLeft,
    cardLeft: null,
    cardWidth,
    chatLeft: hiddenLeft,
    chatWidth: hiddenWidth,
    chatRight: hiddenRight,
    leftGap: hiddenLeft - currentLeft,
    rightGap: null,
    wouldOverlap,
  }
}

const CSS = `
[data-phase] {
  --dsh-chat-content-width: 860px;
}

[data-conversation-scroll] [data-chat-flow] {
  margin-left: var(--dsh-chat-flow-margin-left, 0px);
  margin-right: auto;
}

[data-composer-card] {
  align-self: flex-start;
  width: min(calc(100% - 16px), var(--dsh-composer-card-max-width));
  margin-left: calc(16px + var(--dsh-chat-flow-margin-left, 0px));
}

[data-conversation-scroll] [data-chat-flow] > * {
  min-width: 0;
}
`

export function installChatLayout(ctx: ClientContext): void {
  ctx.effect(() => {
    const element = document.createElement('style')
    element.dataset.plugin = 'dsh-ui-sources'
    element.textContent = CSS
    document.head.append(element)

    let frame: HTMLElement | null = null
    let root: HTMLElement | null = null
    let scrollport: HTMLElement | null = null
    const locate = () => {
      frame = document.querySelector('[data-shell-overlay]')?.parentElement ?? null
      root = document.querySelector('[data-phase]')
      scrollport = document.querySelector('[data-conversation-scroll]')
    }

    const cardIsVisible = () => {
      const host = document.querySelector('[data-ui-sources-card-host]')
      const card = host?.querySelector('.dshSources__card') ?? null
      if (card !== null) return true
      // Before the card portal mounts, the active header button means the card
      // is intended to be visible; don't switch to hidden geometry too early.
      return document.querySelector('.dshSources__trigger--active') !== null
    }

    const setVars = () => {
      if (root === null || scrollport === null) return
      const rect = scrollport.getBoundingClientRect()
      if (rect.width <= 0) return
      const centerLeft = rect.left
      const contentRight = centerLeft + scrollport.clientWidth
      const collapsed = scrollport.closest('[data-sidebar-collapsed]') !== null
      // Use the settled sidebar edge, not the animating rect.left, so the
      // final margin is correct after the sidebar transition finishes.
      const settledLeft = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH

      // The conversation track is anchored to the app-level expanded sidebar
      // edge (280px), not to the currently animating sidebar width.
      const layout = computeChatLayout({
        expandedLeft: SIDEBAR_EXPANDED_WIDTH,
        expandedRight: contentRight,
        currentLeft: settledLeft,
        cardVisible: cardIsVisible(),
      })

      const marginLeft = layout.chatLeft - (settledLeft + CONTENT_PADDING)

      root.style.setProperty('--dsh-chat-content-width', `${Math.round(layout.chatWidth)}px`)
      root.style.setProperty('--dsh-chat-flow-margin-left', `${Math.round(marginLeft)}px`)
      root.style.setProperty('--dsh-sources-card-width', `${CARD_WIDTH}px`)
    }

    const measure = () => {
      locate()
      setVars()
    }

    measure()
    const raf = requestAnimationFrame(measure)

    const observer = new ResizeObserver(measure)
    if (scrollport !== null) observer.observe(scrollport)
    if (frame !== null) observer.observe(frame)
    window.addEventListener('resize', measure)

    const mutation = new MutationObserver(() => { measure() })
    if (frame !== null) {
      mutation.observe(frame, {
        attributes: true,
        attributeFilter: ['data-sidebar-collapsed', 'data-details-collapsed', 'style'],
      })
    }
    if (document.body !== null) {
      mutation.observe(document.body, {
        childList: true,
        subtree: true,
        attributeFilter: ['data-ui-sources-card-host'],
      })
    }

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      mutation.disconnect()
      window.removeEventListener('resize', measure)
      element.remove()
    }
  }, 'dsh-ui-sources: chat layout')
}
