export type SourceKind = 'web' | 'file' | 'pdf'

export interface SourceItem {
  id: string
  kind: SourceKind
  referenced: boolean
  accessCount: number
  referenceCount: number
  firstSeenSeq: number
  referenceOrder?: number
  title?: string
  domain?: string
  url?: string
  path?: string
}

/** One file-diff hunk, structurally compatible with DSH's presentation FileDiff. */
export interface FileDiff {
  path: string
  oldText: string | null
  newText: string
}

/** One changed file, aggregated from all diff hunks seen in a turn. */
export interface FileChange {
  path: string
  diffs: FileDiff[]
}

/** File changes belonging to one completed turn (one Q&A round). */
export interface TurnFileChanges {
  turn: number
  files: FileChange[]
}

export interface SourceProjection {
  items: SourceItem[]
  publishedTurn: number | null
  /** The latest completed turn's file changes; `null` when nothing changed. */
  latestChanges: TurnFileChanges | null
  /** Every completed turn's file changes, keyed by turn number. */
  changesByTurn: Record<number, TurnFileChanges>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    sources: SourceProjection
  }
}
