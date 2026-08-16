export type OpenLocalPath = (cwd: string | undefined, path: string) => Promise<void>

export interface SourcesPanelState {
  /** Whether the resident top-right sources card is shown (header button toggles it). */
  cardVisible: boolean
  /** Whether the details column sidebar with all sources is open. */
  detailsOpen: boolean
}

export interface SourcesPanelController {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => SourcesPanelState
  /** Show or hide the resident card only; never touches the sidebar. */
  setCardVisible: (visible: boolean) => void
  /** Flip card visibility only; never touches the sidebar. */
  toggleCard: () => void
  /** Open the details sidebar; the card stays as-is. */
  openDetails: () => void
  /** Close the details sidebar. */
  closeDetails: () => void
}
