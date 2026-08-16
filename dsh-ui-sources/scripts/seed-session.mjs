import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'

const [sessionFile] = process.argv.slice(2)
if (!sessionFile) throw new Error('usage: node scripts/seed-session.mjs <session.jsonl.zstd>')

const existing = await readFile(sessionFile)
const decoded = spawnSync('zstd', ['-dc', '--', sessionFile], { encoding: 'utf8', windowsHide: true })
const text = decoded.status === 0 ? decoded.stdout : zstdDecompressSync(existing).toString('utf8')
const records = text.trim().split(/\r?\n/).map(line => JSON.parse(line))
const header = records[0]
if (header?.type !== 'session') throw new Error('target is not a DSH session log')

const committed = []
for (const record of records.slice(1)) {
  if (record?.type === 'turn/start' && record.data?.turn === 1) break
  if (record?.seq !== committed.length) break
  committed.push(record)
}
const baseSeq = committed.length

const time0 = Date.now() - 20_000
const modelSource = { kind: 'model', provider: 'fixture', model: 'fixture' }
const resultMessage = (callId, text, isError = false) => ({
  id: `fixture-result-${callId}`,
  role: 'user',
  source: { kind: 'tool', callId },
  content: [{
    type: 'tool-result',
    toolCallId: callId,
    content: [{ type: 'text', text }],
    isError,
  }],
})

const calls = [
  { id: 'search-1', name: 'web_search', args: { query: 'DeepSeek Harness plugin development' } },
  { id: 'fetch-1', name: 'web_fetch', args: { url: 'https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/' } },
  { id: 'read-1', name: 'read', args: { file_path: 'docs/source-panel-guide.pdf' } },
  { id: 'shell-1', name: 'pwsh', args: { command: 'npm test', cwd: 'D:/dsh-ui-sources' } },
]

const events = []
const push = (type, data, surfaceOp) => {
  const event = { type, seq: baseSeq + events.length, time: time0 + events.length * 100, data }
  if (surfaceOp) event.surfaceOp = surfaceOp
  events.push(event)
}

push('turn/start', { turn: 1 })
push('user/message', {
  id: 'fixture-user-1',
  role: 'user',
  content: [{ type: 'text', text: '请整理 DSH 插件开发资料并给出来源。' }],
  source: { kind: 'user' },
}, 'append')
push('step/start', { turn: 1, step: 1 })
push('assistant/message', {
  turn: 1,
  step: 1,
  message: {
    id: 'fixture-assistant-tools',
    role: 'assistant',
    content: calls.map(call => ({ type: 'tool-call', id: call.id, name: call.name, arguments: JSON.stringify(call.args) })),
    source: modelSource,
  },
}, 'append')

for (const call of calls) {
  push('tool/call', { turn: 1, step: 1, callId: call.id, name: call.name, arguments: JSON.stringify(call.args) })
  const meta = call.id === 'search-1'
    ? { sources: [
        { url: 'https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/', title: 'Plugin Development — DeepSeek Harness' },
        { url: 'https://github.com/deepseek-harness/deepseek-harness', title: 'DeepSeek Harness on GitHub' },
      ] }
    : call.id === 'fetch-1'
      ? { url: 'https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/', statusCode: 200 }
      : undefined
  const text = call.id === 'shell-1' ? '3 tests passed\n[exit code: 0]' : 'ok'
  push('tool/result', {
    turn: 1,
    step: 1,
    message: resultMessage(call.id, text),
    ...(meta ? { meta } : {}),
  }, 'append')
}

push('step/end', { turn: 1, step: 1 })
push('step/start', { turn: 1, step: 2 })
push('assistant/message', {
  turn: 1,
  step: 2,
  message: {
    id: 'fixture-assistant-final',
    role: 'assistant',
    content: [{
      type: 'text',
      text: '主要参考 [DSH 插件开发文档](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/) 和本地资料 docs/source-panel-guide.pdf。',
    }],
    source: modelSource,
  },
}, 'append')
push('step/end', { turn: 1, step: 2 })
push('turn/end', { turn: 1, reason: { kind: 'completed' } })

const headerFrame = zstdCompressSync(Buffer.from(`${JSON.stringify(header)}\n`))
const eventsFrame = zstdCompressSync(Buffer.from(`${[...committed, ...events].map(record => JSON.stringify(record)).join('\n')}\n`))
await writeFile(sessionFile, Buffer.concat([headerFrame, eventsFrame]))
process.stdout.write(`${JSON.stringify({ sessionFile, preservedEvents: committed.length, appendedEvents: events.length })}\n`)
