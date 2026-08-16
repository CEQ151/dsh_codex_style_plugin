import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { applySourcesEvent, canonicalizeUrl, createSourcesState } from '../src/projection.ts'

let seq = 0

function event(type: string, data: unknown): SessionEvent {
  return { type, data, seq: seq++, time: seq * 10 } as SessionEvent
}

function call(callId: string, name: string, args: Record<string, unknown>, turn = 1): SessionEvent {
  return event('tool/call', { turn, step: 1, callId, name, arguments: JSON.stringify(args) })
}

function result(callId: string, meta?: unknown, text = 'ok', turn = 1, error?: unknown): SessionEvent {
  return event('tool/result', {
    turn,
    step: 1,
    message: {
      id: `result-${callId}`,
      role: 'user',
      source: { kind: 'tool', callId },
      content: [{
        type: 'tool-result',
        toolCallId: callId,
        content: [{ type: 'text', text }],
        isError: error !== undefined,
      }],
    },
    ...(meta !== undefined ? { meta } : {}),
    ...(error !== undefined ? { error } : {}),
  })
}

function assistant(text: string, turn = 1): SessionEvent {
  return event('assistant/message', {
    turn,
    step: 2,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  })
}

function end(turn = 1): SessionEvent {
  return event('turn/end', { turn, reason: { kind: 'completed' } })
}

function replay(events: SessionEvent[]) {
  return events.reduce(applySourcesEvent, createSourcesState())
}

describe('source projection', () => {
  it('publishes only at turn end, dedupes and preserves reference order', () => {
    seq = 0
    const events = [
      call('search', 'web_search', { query: 'DSH' }),
      result('search', {
        sources: [
          { url: 'https://Example.com/docs#intro', title: 'Example docs' },
          { url: 'https://unused.test/page', title: 'Unused page' },
        ],
        truncated: false,
      }),
      call('fetch', 'web_fetch', { url: 'https://example.com/docs' }),
      result('fetch', { url: 'https://example.com/docs#body', statusCode: 200, truncated: false }),
      call('read', 'read', { file_path: 'docs/guide.pdf' }),
      result('read'),
      assistant('See docs/guide.pdf, then https://example.com/docs for the answer.'),
    ]

    const beforeEnd = replay(events)
    expect(beforeEnd.published.items).toEqual([])

    const state = applySourcesEvent(beforeEnd, end())
    expect(state.published.items).toHaveLength(3)
    const [pdf, web, unused] = state.published.items
    expect(pdf).toMatchObject({ kind: 'pdf', referenced: true, referenceOrder: 1 })
    expect(web).toMatchObject({ kind: 'web', referenced: true, accessCount: 2, referenceOrder: 2, title: 'Example docs' })
    expect(unused).toMatchObject({ kind: 'web', referenced: false })
  })

  it('reconstructs the identical published view by replaying durable events', () => {
    seq = 0
    const events = [
      call('read', 'read', { file_path: 'src/main.ts' }),
      result('read'),
      assistant('Changed src/main.ts.'),
      end(),
    ]
    const first = replay(events).published
    const restored = replay(events).published
    expect(restored).toEqual(first)
    expect(restored.items[0]).toMatchObject({ path: 'src/main.ts', referenceCount: 1 })
  })

  it('ignores failed calls and canonicalizes web URLs', () => {
    seq = 0
    const state = replay([
      call('failed', 'read', { file_path: 'secret.txt' }),
      result('failed', undefined, 'denied', 1, { name: 'Error', code: 'DENIED' }),
      call('shell', 'pwsh', { command: 'npm test', cwd: 'D:/project' }),
      result('shell', undefined, '[exit code: 0]'),
      end(),
    ])
    expect(state.published.items).toEqual([])
    expect(canonicalizeUrl('HTTPS://Example.COM:443/a#part')).toBe('https://example.com/a')
    expect(canonicalizeUrl('file:///tmp/a')).toBeUndefined()
  })

  it('publishes latest turn file changes from diff result meta', () => {
    seq = 0
    const state = replay([
      call('edit1', 'edit', { file_path: 'src/a.ts', old_string: 'a', new_string: 'b' }),
      result('edit1', {
        diffs: [{ path: 'src/a.ts', oldText: 'a', newText: 'b' }],
      }),
      assistant('Updated src/a.ts.'),
      end(),
    ])
    expect(state.published.latestChanges).toEqual({
      turn: 1,
      files: [{
        path: 'src/a.ts',
        diffs: [{ path: 'src/a.ts', oldText: 'a', newText: 'b' }],
      }],
    })
    expect(state.published.items).toMatchObject([{ path: 'src/a.ts' }])
  })

  it('falls back to write/str_replace_editor call args and keeps only the newest turn', () => {
    seq = 0
    const state = replay([
      call('w1', 'write', { file_path: 'new.txt', content: 'hello\n' }, 1),
      result('w1', undefined, 'created', 1),
      assistant('Created new.txt.', 1),
      end(1),
      call('edit2', 'str_replace_editor', {
        command: 'str_replace',
        path: 'new.txt',
        old_str: 'hello',
        new_str: 'hi',
      }, 2),
      result('edit2', undefined, 'ok', 2),
      assistant('Updated new.txt.', 2),
      end(2),
    ])
    expect(state.published.latestChanges).toEqual({
      turn: 2,
      files: [{
        path: 'new.txt',
        diffs: [{ path: 'new.txt', oldText: 'hello', newText: 'hi' }],
      }],
    })
  })

  it('ignores failed mutations when collecting file changes', () => {
    seq = 0
    const state = replay([
      call('bad', 'write', { file_path: 'secret.txt', content: 'nope' }, 1),
      result('bad', undefined, 'denied', 1, { name: 'Error', code: 'DENIED' }),
      end(1),
    ])
    expect(state.published.latestChanges).toBeNull()
  })
})
