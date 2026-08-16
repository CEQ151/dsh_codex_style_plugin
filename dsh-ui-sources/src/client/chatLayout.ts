import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

const CARD_WIDTH = 340
const CARD_MARGIN_RIGHT = 16
const SIDE = 32
const MIN_GAP = 12
const CHAT_MAX_WIDTH = 860
const CHAT_MIN_WIDTH = 520
const COLLAPSE_LEFT_SHIFT = 24

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
    let lastExpandedCenterLeft: number | null = null
    let lastExpandedCenterWidth: number | null = null

    const locate = () => {
      frame = document.querySelector('[data-shell-overlay]')?.parentElement ?? null
      root = document.querySelector('[data-phase]')
      scrollport = document.querySelector('[data-conversation-scroll]')
    }

    const setVars = () => {
      if (root === null || scrollport === null) return
      const rect = scrollport.getBoundingClientRect()
      if (rect.width <= 0) return
      const centerLeft = rect.left
      const centerWidth = rect.width
      const collapsed = scrollport.closest('[data-sidebar-collapsed]') !== null

      let expandedCenterLeft: number
      let expandedCenterWidth: number
      if (collapsed) {
        expandedCenterLeft = lastExpandedCenterLeft ?? centerLeft + (280 - 56)
        expandedCenterWidth = lastExpandedCenterWidth ?? centerWidth - (280 - 56)
      } else {
        expandedCenterLeft = centerLeft
        expandedCenterWidth = centerWidth
        lastExpandedCenterLeft = centerLeft
        lastExpandedCenterWidth = centerWidth
      }

      const expandedCardLeft = expandedCenterWidth - CARD_MARGIN_RIGHT - CARD_WIDTH
      const expandedTrack = expandedCardLeft - SIDE
      let chatWidth = Math.min(CHAT_MAX_WIDTH, expandedTrack - MIN_GAP * 2)
      if (chatWidth < CHAT_MIN_WIDTH) chatWidth = Math.max(0, expandedTrack - MIN_GAP * 2)
      const expandedGap = Math.max(MIN_GAP, (expandedTrack - chatWidth) / 2)
      const expandedChatAbs = expandedCenterLeft + SIDE + expandedGap

      const chatLeftAbs = collapsed ? expandedChatAbs - COLLAPSE_LEFT_SHIFT : expandedChatAbs
      const chatLeftRel = chatLeftAbs - centerLeft
      const marginLeft = Math.max(0, chatLeftRel - SIDE)

      root.style.setProperty('--dsh-chat-content-width', `${Math.round(chatWidth)}px`)
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

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      mutation.disconnect()
      window.removeEventListener('resize', measure)
      element.remove()
    }
  }, 'dsh-ui-sources: chat layout')
}
