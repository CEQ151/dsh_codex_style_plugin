const CARD_WIDTH = 320
const CARD_MARGIN_RIGHT = 16
const SIDE = 32
const MIN_GAP = 12
const CHAT_MAX_WIDTH = 860
const CHAT_MIN_WIDTH = 520
const COLLAPSE_LEFT_SHIFT = 64

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

export function apply(ctx) {
  ctx.effect(() => {
    const element = document.createElement('style')
    element.dataset.plugin = 'dsh-codex-chat-layout'
    element.textContent = CSS
    document.head.append(element)

    let frame = null
    let root = null
    let scrollport = null
    let expandedCenterLeft = null
    let expandedChatAbs = null

    const setVars = () => {
      if (root === null || scrollport === null) return
      const rect = scrollport.getBoundingClientRect()
      if (rect.width <= 0) return
      const centerLeft = rect.left
      const centerWidth = rect.width
      const cardLeft = centerWidth - CARD_MARGIN_RIGHT - CARD_WIDTH
      const available = cardLeft - SIDE - MIN_GAP
      const chatWidth = Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, available - MIN_GAP))
      const gap = Math.max(MIN_GAP, (available - chatWidth) / 2)
      const collapsed = scrollport.closest('[data-sidebar-collapsed]') !== null

      let chatLeftRel
      if (collapsed) {
        const assumedExpandedCenterLeft = expandedCenterLeft ?? centerLeft + (280 - 56)
        const assumedExpandedAbs = expandedChatAbs ?? assumedExpandedCenterLeft + SIDE + gap
        chatLeftRel = assumedExpandedAbs - COLLAPSE_LEFT_SHIFT - centerLeft
      } else {
        chatLeftRel = SIDE + gap
        expandedCenterLeft = centerLeft
        expandedChatAbs = centerLeft + chatLeftRel
      }

      const marginLeft = Math.max(0, chatLeftRel - SIDE)
      root.style.setProperty('--dsh-chat-content-width', `${Math.round(chatWidth)}px`)
      root.style.setProperty('--dsh-chat-flow-margin-left', `${Math.round(marginLeft)}px`)
      root.style.setProperty('--dsh-sources-card-width', `${CARD_WIDTH}px`)
    }

    const locate = () => {
      frame = document.querySelector('[data-shell-overlay]')?.parentElement ?? null
      root = document.querySelector('[data-phase]')
      scrollport = document.querySelector('[data-conversation-scroll]')
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

    const mutation = new MutationObserver(() => {
      expandedCenterLeft = null
      expandedChatAbs = null
      measure()
    })
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
  }, 'dsh-codex-chat-layout: styles')
}
