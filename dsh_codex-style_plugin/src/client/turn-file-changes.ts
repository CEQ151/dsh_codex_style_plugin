import type {
  ConversationMatch,
  ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-runtime/client'
import { isAppendSurfaceEvent } from '@deepseek-ai/dsh-client-runtime/client'
import type { TurnTailOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FileChange, FileDiff } from '../types.ts'

interface PendingCall {
  name: string
  args: Record<string, unknown>
}

export interface FileChangesTurnData {
  turn: number
  files: FileChange[]
}

declare module '@deepseek-ai/dsh-client-runtime/client' {
  interface ConversationTurnDataMap {
    /** Per-turn file-change summary accumulated by dsh-ui-sources. */
    fileChanges: FileChangesTurnData
  }
}

interface FileChangesState {
  turn: number
  pendingCalls: Map<string, PendingCall>
  byPath: Record<string, FileChange>
}


function normalizePath(raw: string): string {
  const trimmed = raw.trim().replace(/^file:\/\//i, '')
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/\.\//g, '/')
  return /^[A-Za-z]:\//.test(normalized)
    ? `${normalized[0]!.toUpperCase()}${normalized.slice(1)}`
    : normalized
}

function pathArg(args: Record<string, unknown>): string | undefined {
  const raw = args.file_path ?? args.path ?? args.filename ?? args.file
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

function diffFromWriteArgs(name: string, args: Record<string, unknown>): FileDiff | null {
  if (name !== 'write' && name !== 'write_file' && name !== 'create') return null
  const path = pathArg(args)
  const content = typeof args.content === 'string' ? args.content : typeof args.file_text === 'string' ? args.file_text : undefined
  if (path === undefined || content === undefined) return null
  return { path: normalizePath(path), oldText: null, newText: content }
}

function diffFromEditArgs(name: string, args: Record<string, unknown>): FileDiff | null {
  if (name !== 'edit' && name !== 'edit_file') return null
  const path = pathArg(args)
  if (path === undefined) return null
  const oldText = typeof args.old_string === 'string' ? args.old_string : typeof args.old_str === 'string' ? args.old_str : null
  const newText = typeof args.new_string === 'string' ? args.new_string : typeof args.new_str === 'string' ? args.new_str : ''
  return { path: normalizePath(path), oldText, newText }
}

function diffFromEditorArgs(args: Record<string, unknown>): FileDiff[] {
  if (typeof args.path !== 'string' || args.path.trim() === '') return []
  const path = normalizePath(args.path)
  const command = typeof args.command === 'string' ? args.command.toLowerCase() : ''
  if (command === 'create') {
    return [{ path, oldText: null, newText: typeof args.file_text === 'string' ? args.file_text : '' }]
  }
  if (command === 'str_replace') {
    return [{
      path,
      oldText: typeof args.old_str === 'string' ? args.old_str : null,
      newText: typeof args.new_str === 'string' ? args.new_str : '',
    }]
  }
  if (command === 'insert') {
    return [{ path, oldText: null, newText: typeof args.new_str === 'string' ? args.new_str : '' }]
  }
  return []
}

function diffHunksFromCall(name: string, args: Record<string, unknown>): FileDiff[] {
  const writeDiff = diffFromWriteArgs(name, args)
  if (writeDiff !== null) return [writeDiff]
  const editDiff = diffFromEditArgs(name, args)
  if (editDiff !== null) return [editDiff]
  if (name === 'str_replace_editor') return diffFromEditorArgs(args)
  return []
}

function diffHunksFromMeta(meta: unknown): FileDiff[] {
  if (!isRecord(meta) || !Array.isArray(meta.diffs)) return []
  const diffs: FileDiff[] = []
  for (const raw of meta.diffs) {
    if (!isRecord(raw) || typeof raw.path !== 'string' || typeof raw.newText !== 'string') continue
    diffs.push({
      path: normalizePath(raw.path),
      oldText: typeof raw.oldText === 'string' ? raw.oldText : null,
      newText: raw.newText,
    })
  }
  return diffs
}


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw)
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function addDiffs(
  byPath: Record<string, FileChange>,
  diffs: FileDiff[],
): Record<string, FileChange> {
  const next: Record<string, FileChange> = { ...byPath }
  for (const diff of diffs) {
    const path = diff.path
    if (path === '' || path.includes('\n')) continue
    const key = path.toLowerCase()
    const existing = next[key]
    const nextDiff: FileDiff = { path, oldText: diff.oldText, newText: diff.newText }
    const already = existing?.diffs.some(
      candidate => candidate.oldText === nextDiff.oldText && candidate.newText === nextDiff.newText,
    ) ?? false
    next[key] = {
      path: existing?.path ?? path,
      diffs: existing === undefined
        ? [nextDiff]
        : already
          ? existing.diffs
          : [...existing.diffs, nextDiff],
    }
  }
  return next
}

function updateFileChanges(
  context: ConversationNodeContext<FileChangesState> & { readonly state: FileChangesState },
  match: ConversationMatch,
): FileChangesState {
  if (match.event.type === 'tool/call') {
    const pendingCalls = new Map(context.state.pendingCalls)
    pendingCalls.set(String(match.event.data.callId), {
      name: match.event.data.name,
      args: parseArguments(match.event.data.arguments),
    })
    return { ...context.state, pendingCalls }
  }

  if (match.event.type !== 'tool/result') return context.state
  const callId = String(match.event.data.message.source.callId)
  const call = context.state.pendingCalls.get(callId)
  const pendingCalls = new Map(context.state.pendingCalls)
  pendingCalls.delete(callId)
  if (call === undefined) return { ...context.state, pendingCalls }

  const resultBlock = match.event.data.message.content[0]
  if (match.event.data.error !== undefined || resultBlock?.isError === true) {
    return { ...context.state, pendingCalls }
  }

  const metaDiffs = diffHunksFromMeta(match.event.data.meta)
  const callDiffs = metaDiffs.length > 0 ? metaDiffs : diffHunksFromCall(call.name, call.args)
  if (callDiffs.length === 0) return { ...context.state, pendingCalls }

  return {
    ...context.state,
    pendingCalls,
    byPath: addDiffs(context.state.byPath, callDiffs),
  }
}

export const fileChangesDefinition: ConversationNodeDefinition<FileChangesState> = {
  kind: 'fileChanges',
  match: (event) => {
    if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(event.data.turn), role: 'update' }
    if (event.type === 'tool/result' && isAppendSurfaceEvent(event)) {
      return { id: String(event.data.turn), role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'turn/start') throw new Error('fileChanges start requires turn/start')
    return { turn: match.event.data.turn, pendingCalls: new Map(), byPath: {} }
  },
  update: updateFileChanges,
  buildLocationData: (context, scope) => scope !== 'turn' || context.state === undefined
    ? null
    : {
      kind: 'turn',
      turn: context.state.turn,
      key: 'fileChanges',
      value: {
        turn: context.state.turn,
        files: Object.values(context.state.byPath),
      },
    },
}

export function selectFileChanges(owner: TurnTailOwnerProps): FileChangesTurnData | null {
  const data = owner.turn.data.get('fileChanges')
  return data !== undefined && data.files.length > 0 ? data : null
}
