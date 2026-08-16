import { describe, expect, it } from 'vitest'
import {
  CARD_MARGIN_RIGHT,
  CARD_WIDTH,
  CHAT_MIN_WIDTH,
  computeChatLayout,
  MIN_GAP,
  TRACK_INSET,
} from '../src/client/chatLayout.ts'

const EXPANDED_LEFT = 280
const COLLAPSED_LEFT = 56

describe('chat layout stable track', () => {
  it('keeps card position and chat position identical when sidebar collapses', () => {
    const expanded = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1440,
      currentLeft: EXPANDED_LEFT,
      cardVisible: true,
    })
    const collapsed = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1440,
      currentLeft: COLLAPSED_LEFT,
      cardVisible: true,
    })

    expect(expanded.cardLeft).toBe(1440 - CARD_MARGIN_RIGHT - CARD_WIDTH)
    expect(collapsed.cardLeft).toBe(expanded.cardLeft)
    expect(collapsed.chatLeft).toBe(expanded.chatLeft)
    expect(collapsed.chatWidth).toBe(expanded.chatWidth)
    expect(collapsed.chatRight).toBe(expanded.chatRight)
    // The stable track centers the chat between the stable left boundary and card.
    expect(expanded.chatLeft - expanded.stableLeft).toBe(expanded.rightGap)
    expect(collapsed.chatLeft - collapsed.stableLeft).toBe(collapsed.rightGap)
    // The distance to the *actual* sidebar line must change when collapsed.
    expect(collapsed.leftGap).toBeGreaterThan(expanded.leftGap)
  })

  it('marks overlap when the card would crowd the minimum chat width', () => {
    const layout = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1000,
      currentLeft: EXPANDED_LEFT,
      cardVisible: true,
    })

    const track = layout.cardLeft! - layout.stableLeft
    expect(track).toBeLessThan(CHAT_MIN_WIDTH + MIN_GAP * 2)
    expect(layout.wouldOverlap).toBe(true)
    expect(layout.rightGap).toBe(MIN_GAP)
  })

  it('expands the chat into the hidden card space when the card is not visible', () => {
    const hidden = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1000,
      currentLeft: EXPANDED_LEFT,
      cardVisible: false,
    })

    expect(hidden.cardLeft).toBeNull()
    expect(hidden.chatRight).toBeGreaterThan(644)
    expect(hidden.wouldOverlap).toBe(false)
  })

  it('does not move the chat when the card is hidden due to overlap', () => {
    const visibleNarrow = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1000,
      currentLeft: EXPANDED_LEFT,
      cardVisible: true,
    })
    const hidden = computeChatLayout({
      expandedLeft: EXPANDED_LEFT,
      expandedRight: 1000,
      currentLeft: EXPANDED_LEFT,
      cardVisible: false,
    })

    // Same stable left boundary and same chat left edge; only width expands.
    expect(hidden.stableLeft).toBe(visibleNarrow.stableLeft)
    expect(hidden.chatLeft).toBe(visibleNarrow.chatLeft)
    expect(hidden.chatWidth).toBeGreaterThan(visibleNarrow.chatWidth)
  })
})
