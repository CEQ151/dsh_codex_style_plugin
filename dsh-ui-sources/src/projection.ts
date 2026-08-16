import { z } from 'zod'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { FileChange, FileDiff, SourceItem, SourceKind, SourceProjection } from './types.ts'

interface PendingCall {
  name: string
  args: Record<string, unknown>
  seq: number
  turn: number
}

export interface SourcesState {
  items: Record<string, SourceItem>
  pendingCalls: Record<string, PendingCall>
  assistantTextByTurn: Record<string, string>
  /** File-diff hunks collected per turn, keyed by turn then normalized path. */
  changesByTurn: Record<string, Record<string, FileChange>>
  published: SourceProjection
  nextSeenSeq: number
  nextReferenceOrder: number
}

const sourceItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['web', 'file', 'pdf']),
  referenced: z.boolean(),
  accessCount: z.number().int().nonnegative(),
  referenceCount: z.number().int().nonnegative(),
  firstSeenSeq: z.number().int().nonnegative(),
  referenceOrder: z.number().int().positive().optional(),
  title: z.string().optional(),
  domain: z.string().optional(),
  url: z.string().optional(),
  path: z.string().optional(),
})

const fileDiffSchema = z.object({
  path: z.string(),
  oldText: z.string().nullable(),
  newText: z.string(),
}) as z.ZodType<FileDiff>

const fileChangeSchema = z.object({
  path: z.string(),
  diffs: z.array(fileDiffSchema),
}) as z.ZodType<FileChange>

const turnFileChangesSchema = z.object({
  turn: z.number().int().positive(),
  files: z.array(fileChangeSchema),
})

export const sourceProjectionSchema = z.object({
  items: z.array(sourceItemSchema),
  publishedTurn: z.number().int().positive().nullable(),
  latestChanges: turnFileChangesSchema.nullable(),
  changesByTurn: z.record(z.number(), turnFileChangesSchema),
}) as z.ZodType<SourceProjection>

const EMPTY_PROJECTION: SourceProjection = { items: [], publishedTurn: null, latestChanges: null, changesByTurn: {} }

export function createSourcesState(): SourcesState {
  return {
    items: {},
    pendingCalls: {},
    assistantTextByTurn: {},
    changesByTurn: {},
    published: EMPTY_PROJECTION,
    nextSeenSeq: 1,
    nextReferenceOrder: 1,
  }
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw)
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function canonicalizeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    url.hash = ''
    url.protocol = url.protocol.toLowerCase()
    url.hostname = url.hostname.toLowerCase()
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = ''
    if (url.pathname === '') url.pathname = '/'
    return url.toString()
  } catch {
    return undefined
  }
}

function normalizePath(raw: string): string {
  const trimmed = raw.trim().replace(/^file:\/\//i, '')
  const normalized = trimmed.replace(/\\/g, '/').replace(/\/\.\//g, '/')
  return /^[A-Za-z]:\//.test(normalized)
    ? `${normalized[0]!.toUpperCase()}${normalized.slice(1)}`
    : normalized
}

function sourceKey(kind: SourceKind, value: string): string {
  const body = kind === 'web' || /^https?:\/\//i.test(value) ? value : normalizePath(value).toLowerCase()
  return `${kind}:${body}`
}

function addOrTouch(
  state: SourcesState,
  input: Omit<SourceItem, 'id' | 'referenced' | 'accessCount' | 'referenceCount' | 'firstSeenSeq'> & { key: string },
): SourcesState {
  const existing = state.items[input.key]
  const items = { ...state.items }
  if (existing !== undefined) {
    items[input.key] = {
      ...existing,
      accessCount: existing.accessCount + 1,
      ...(input.title !== undefined && existing.title === undefined ? { title: input.title } : {}),
      ...(input.domain !== undefined && existing.domain === undefined ? { domain: input.domain } : {}),
    }
    return { ...state, items }
  }
  const { key, ...rest } = input
  items[key] = {
    id: key,
    referenced: false,
    accessCount: 1,
    referenceCount: 0,
    firstSeenSeq: state.nextSeenSeq,
    ...rest,
  }
  return { ...state, items, nextSeenSeq: state.nextSeenSeq + 1 }
}

function addWeb(state: SourcesState, rawUrl: string, title?: string): SourcesState {
  const url = canonicalizeUrl(rawUrl)
  if (url === undefined) return state
  const domain = new URL(url).hostname.replace(/^www\./, '')
  const kind: SourceKind = /\.pdf$/i.test(new URL(url).pathname) ? 'pdf' : 'web'
  return addOrTouch(state, {
    key: sourceKey(kind, url),
    kind,
    url,
    domain,
    ...(title !== undefined && title.trim() !== '' ? { title: title.trim() } : {}),
  })
}

const FILE_TOOLS = /^(?:read|write|edit|apply_patch|create|grep|glob|find|search|list_files|read_file|write_file|edit_file|fs_search|str_replace_editor)$/i
const PATH_KEYS = new Set(['file_path', 'filepath', 'path', 'paths', 'filename', 'file', 'files', 'target_path'])

function filePaths(args: Record<string, unknown>): string[] {
  const found: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (!PATH_KEYS.has(key.toLowerCase())) continue
    if (typeof value === 'string' && value.trim() !== '') found.push(value)
    if (Array.isArray(value)) {
      for (const entry of value) if (typeof entry === 'string' && entry.trim() !== '') found.push(entry)
    }
  }
  return [...new Set(found.map(normalizePath))]
}

function addFile(state: SourcesState, path: string): SourcesState {
  const normalized = normalizePath(path)
  if (normalized === '' || normalized.includes('\n') || /^https?:\/\//i.test(normalized)) return state
  const kind: SourceKind = /\.pdf(?:$|[?#])/i.test(normalized) ? 'pdf' : 'file'
  return addOrTouch(state, {
    key: sourceKey(kind, normalized),
    kind,
    path: normalized,
    title: normalized.split('/').at(-1) || normalized,
  })
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
    return [{
      path,
      oldText: null,
      newText: typeof args.file_text === 'string' ? args.file_text : '',
    }]
  }
  if (command === 'str_replace') {
    return [{
      path,
      oldText: typeof args.old_str === 'string' ? args.old_str : null,
      newText: typeof args.new_str === 'string' ? args.new_str : '',
    }]
  }
  if (command === 'insert') {
    return [{
      path,
      oldText: null,
      newText: typeof args.new_str === 'string' ? args.new_str : '',
    }]
  }
  return []
}

export function diffHunksFromCall(name: string, args: Record<string, unknown>): FileDiff[] {
  const writeDiff = diffFromWriteArgs(name, args)
  if (writeDiff !== null) return [writeDiff]
  const editDiff = diffFromEditArgs(name, args)
  if (editDiff !== null) return [editDiff]
  if (name === 'str_replace_editor') return diffFromEditorArgs(args)
  return []
}

export function diffHunksFromMeta(meta: unknown): FileDiff[] {
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

function addTurnChanges(state: SourcesState, turn: number, diffs: FileDiff[]): SourcesState {
  if (diffs.length === 0) return state
  const turnKey = String(turn)
  const byPath = state.changesByTurn[turnKey] ?? {}
  const nextByPath: Record<string, FileChange> = { ...byPath }
  for (const diff of diffs) {
    const path = normalizePath(diff.path)
    if (path === '' || path.includes('\n') || /^https?:\/\//i.test(path)) continue
    const key = path.toLowerCase()
    const existing = nextByPath[key]
    const nextDiff: FileDiff = { path, oldText: diff.oldText, newText: diff.newText }
    const already = existing?.diffs.some(
      candidate => candidate.oldText === nextDiff.oldText && candidate.newText === nextDiff.newText,
    ) ?? false
    nextByPath[key] = {
      path: existing?.path ?? path,
      diffs: existing === undefined
        ? [nextDiff]
        : already
          ? existing.diffs
          : [...existing.diffs, nextDiff],
    }
  }
  return {
    ...state,
    changesByTurn: {
      ...state.changesByTurn,
      [turnKey]: nextByPath,
    },
  }
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (!isRecord(block)) return ''
      if (block.type === 'text' && typeof block.text === 'string') return block.text
      if (block.type === 'tool-result') return contentText(block.content)
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function messageText(message: unknown): string {
  return isRecord(message) ? contentText(message.content) : ''
}

function messageIsError(message: unknown): boolean {
  if (!isRecord(message)) return false
  if (message.isError === true) return true
  if (!Array.isArray(message.content)) return false
  return message.content.some(block => isRecord(block) && block.type === 'tool-result' && block.isError === true)
}

function resultCallId(message: unknown): string | undefined {
  if (!isRecord(message) || !isRecord(message.source)) return undefined
  const callId = message.source.callId
  return typeof callId === 'string' ? callId : undefined
}

function applyToolResult(state: SourcesState, event: Extract<SessionEvent, { type: 'tool/result' }>): SourcesState {
  const callId = resultCallId(event.data.message)
  if (callId === undefined || !Object.hasOwn(state.pendingCalls, callId)) return state
  const call = state.pendingCalls[callId]!
  const pendingCalls = Object.fromEntries(Object.entries(state.pendingCalls).filter(([id]) => id !== callId))
  let next: SourcesState = { ...state, pendingCalls }
  if (event.data.error !== undefined || messageIsError(event.data.message)) return next

  if (call.name === 'web_search' && isRecord(event.data.meta) && Array.isArray(event.data.meta.sources)) {
    for (const source of event.data.meta.sources) {
      if (!isRecord(source) || typeof source.url !== 'string') continue
      next = addWeb(next, source.url, typeof source.title === 'string' ? source.title : undefined)
    }
    return next
  }
  if (call.name === 'web_fetch') {
    const metaUrl = isRecord(event.data.meta) && typeof event.data.meta.url === 'string' ? event.data.meta.url : undefined
    const argUrl = typeof call.args.url === 'string' ? call.args.url : undefined
    if (metaUrl !== undefined || argUrl !== undefined) next = addWeb(next, metaUrl ?? argUrl!)
    return next
  }

  const metaDiffs = diffHunksFromMeta(event.data.meta)
  const callDiffs = metaDiffs.length > 0 ? metaDiffs : diffHunksFromCall(call.name, call.args)
  if (callDiffs.length > 0) next = addTurnChanges(next, call.turn, callDiffs)

  if (FILE_TOOLS.test(call.name)) {
    for (const path of filePaths(call.args)) next = addFile(next, path)
  }
  return next
}

function urlOccurrences(text: string): Map<string, number> {
  const hits = new Map<string, number>()
  for (const match of text.matchAll(/https?:\/\/[^\s<>()\[\]{}"']+/gi)) {
    const raw = match[0].replace(/[.,;:!?]+$/, '')
    const url = canonicalizeUrl(raw)
    if (url !== undefined) hits.set(url, (hits.get(url) ?? 0) + 1)
  }
  return hits
}

function referenceCount(item: SourceItem, text: string, urls: Map<string, number>): number {
  if (item.url !== undefined) return urls.get(item.url) ?? 0
  const needle = item.path
  if (needle === undefined || needle === '') return 0
  const haystack = text.toLowerCase().replace(/\\/g, '/')
  const normalizedNeedle = needle.toLowerCase().replace(/\\/g, '/')
  let count = 0
  let offset = 0
  while ((offset = haystack.indexOf(normalizedNeedle, offset)) >= 0) {
    count += 1
    offset += Math.max(1, normalizedNeedle.length)
  }
  return count
}

function publishTurn(state: SourcesState, turn: number): SourcesState {
  const text = state.assistantTextByTurn[String(turn)] ?? ''
  const urls = urlOccurrences(text)
  const candidates = Object.values(state.items).map((item) => ({ item, count: referenceCount(item, text, urls) }))
  const newlyReferenced = candidates
    .filter(({ item, count }) => count > 0 && !item.referenced)
    .sort((a, b) => {
      const aNeedle = a.item.url ?? a.item.path ?? ''
      const bNeedle = b.item.url ?? b.item.path ?? ''
      return text.indexOf(aNeedle) - text.indexOf(bNeedle)
    })
  const orderById = new Map<string, number>()
  let nextReferenceOrder = state.nextReferenceOrder
  for (const { item } of newlyReferenced) orderById.set(item.id, nextReferenceOrder++)

  const items: Record<string, SourceItem> = {}
  for (const { item, count } of candidates) {
    items[item.id] = count === 0 ? item : {
      ...item,
      referenced: true,
      referenceCount: item.referenceCount + count,
      referenceOrder: item.referenceOrder ?? orderById.get(item.id)!,
    }
  }
  const publishedItems = Object.values(items)
    .map(item => ({ ...item }))
    .sort((a, b) => {
      if (a.referenced !== b.referenced) return a.referenced ? -1 : 1
      if (a.referenced) return (a.referenceOrder ?? Number.MAX_SAFE_INTEGER) - (b.referenceOrder ?? Number.MAX_SAFE_INTEGER)
      return a.firstSeenSeq - b.firstSeenSeq
    })
  const assistantTextByTurn = Object.fromEntries(Object.entries(state.assistantTextByTurn).filter(([key]) => key !== String(turn)))
  const turnChanges = state.changesByTurn[String(turn)] ?? {}
  const fileChanges = Object.values(turnChanges)
  const changesByTurn = Object.fromEntries(
    Object.entries(state.changesByTurn).map(([turnKey, byPath]) => {
      const turnNumber = Number(turnKey)
      return [turnNumber, { turn: turnNumber, files: Object.values(byPath) }]
    }),
  )
  return {
    ...state,
    items,
    assistantTextByTurn,
    pendingCalls: {},
    nextReferenceOrder,
    published: {
      items: publishedItems,
      publishedTurn: turn,
      latestChanges: fileChanges.length > 0 ? { turn, files: fileChanges } : null,
      changesByTurn,
    },
  }
}

export function applySourcesEvent(state: SourcesState, event: SessionEvent): SourcesState {
  switch (event.type) {
    case 'tool/call':
      return {
        ...state,
        pendingCalls: {
          ...state.pendingCalls,
          [String(event.data.callId)]: {
            name: event.data.name,
            args: parseArguments(event.data.arguments),
            seq: event.seq,
            turn: event.data.turn,
          },
        },
      }
    case 'tool/result':
      return applyToolResult(state, event)
    case 'assistant/message': {
      const text = messageText(event.data.message)
      if (text === '') return state
      const key = String(event.data.turn)
      return {
        ...state,
        assistantTextByTurn: {
          ...state.assistantTextByTurn,
          [key]: `${state.assistantTextByTurn[key] ?? ''}\n${text}`,
        },
      }
    }
    case 'turn/end':
      return publishTurn(state, event.data.turn)
    default:
      return state
  }
}

export const sourcesProjectionDefinition = {
  key: 'sources' as const,
  schema: sourceProjectionSchema,
  init: createSourcesState,
  apply: applySourcesEvent,
  view: (state: SourcesState): SourceProjection => state.published,
  stateVersion: 5,
}
