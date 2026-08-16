import { useMemo, useState, type ReactNode } from 'react'
import {
  IconChevronDownOutline14,
  IconChevronUpOutline14,
  IconEditOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FileChange, FileDiff } from '../types.ts'
import type { FileChangesTurnData } from './turn-file-changes.ts'
import { NS } from './locales.ts'

export interface EditedFilesCardProps extends PropsLocale<typeof NS> {
  /** Chat view's file opener. */
  openFile: TurnTailOwnerProps['openFile']
  /** Chain-selected file changes for this turn. */
  matched: FileChangesTurnData
}

const INITIAL_VISIBLE_FILES = 3

function splitLines(text: string): string[] {
  if (text === '') return []
  return (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n')
}

function diffCounts(diffs: FileDiff[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const diff of diffs) {
    if (diff.oldText !== null) removed += splitLines(diff.oldText).length
    added += splitLines(diff.newText).length
  }
  return { added, removed }
}

function fileCounts(file: FileChange): { added: number; removed: number } {
  return diffCounts(file.diffs)
}

function splitPath(path: string): { directory: string; filename: string } {
  const index = path.lastIndexOf('/')
  if (index === -1) return { directory: '', filename: path }
  return { directory: path.slice(0, index + 1), filename: path.slice(index + 1) }
}

export function EditedFilesCard({
  openFile, matched, t,
}: EditedFilesCardProps): ReactNode {
  const files = matched.files
  const [expanded, setExpanded] = useState(false)

  const total = useMemo(() => {
    let added = 0
    let removed = 0
    for (const file of files) {
      const counts = fileCounts(file)
      added += counts.added
      removed += counts.removed
    }
    return { added, removed }
  }, [files])

  if (files.length === 0) return null

  const visibleFiles = expanded ? files : files.slice(0, INITIAL_VISIBLE_FILES)
  const hidden = files.length - visibleFiles.length

  return (
    <div className="dshSources__editedCard">
      <header className="dshSources__editedHeader">
        <div className="dshSources__editedSummary">
          <span className="dshSources__editedIcon"><IconEditOutline16 size={22} /></span>
          <div className="dshSources__editedText">
            <div className="dshSources__editedTitle">{t('edited.title', { count: files.length })}</div>
            <div className="dshSources__editedStats">
              <span className="dshSources__editedStat dshSources__editedStat--add">+{total.added}</span>
              <span className="dshSources__editedStat dshSources__editedStat--del">-{total.removed}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="dshSources__editedList">
        {visibleFiles.map(file => {
          const counts = fileCounts(file)
          const path = splitPath(file.path)
          return (
            <button
              key={file.path}
              type="button"
              className="dshSources__editedFileRow"
              title={file.path}
              onClick={() => { openFile(file.path) }}
            >
              <span className="dshSources__editedPath">
                {path.directory !== '' && <span className="dshSources__editedDir">{path.directory}</span>}
                <span className="dshSources__editedFile">{path.filename}</span>
              </span>
              <span className="dshSources__editedFileStats">
                <span className="dshSources__editedStat dshSources__editedStat--add">+{counts.added}</span>
                <span className="dshSources__editedStat dshSources__editedStat--del">-{counts.removed}</span>
              </span>
            </button>
          )
        })}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          className="dshSources__editedExpand"
          aria-expanded={expanded}
          onClick={() => { setExpanded(value => !value) }}
        >
          <span>{expanded ? t('edited.collapse') : t('edited.more', { count: hidden })}</span>
          {expanded ? <IconChevronUpOutline14 size={14} /> : <IconChevronDownOutline14 size={14} />}
        </button>
      )}
    </div>
  )
}
