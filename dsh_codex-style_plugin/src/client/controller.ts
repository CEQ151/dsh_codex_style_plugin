export type OpenLocalPath = (cwd: string | undefined, path: string) => Promise<void>

export interface SourcesPanelState {
  /** Whether the resident top-right sources card is shown (header button toggles it). */
  cardVisible: boolean
  /** Whether the details column sidebar with all sources is open. */
  detailsOpen: boolean
  /** True when the card was hidden automatically because it overlapped the chat. */
  autoHidden: boolean
  /** True while the user has manually forced the card open despite overlap. */
  suppressAutoHide: boolean
}

export interface SourcesPanelController {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SourcesPanelState
  /** Show or hide the resident card only; never touches the sidebar. */
  setCardVisible: (visible: boolean) => void
  /** Flip card visibility only; never touches the sidebar. */
  toggleCard: () => void
  /** Automatically hide the card when it overlaps the chat (keeps autoHidden). */
  autoHideCard: () => void
  /** Show the card after an automatic hide (clears autoHidden and suppresses re-hide). */
  showCard: () => void
  /** Clear the manual-overlap suppression when the layout no longer overlaps. */
  clearAutoHideSuppression: () => void
  /** Open the details sidebar; the card stays as-is. */
  openDetails: () => void
  /** Close the details sidebar. */
  closeDetails: () => void
}
