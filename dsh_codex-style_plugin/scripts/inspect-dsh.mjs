import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import WebSocket from 'ws'

const [url, output, profile, widthRaw = '1440', heightRaw = '1000', sessionLabel = 'Fixture 历史会话'] = process.argv.slice(2)
if (!url || !output || !profile) throw new Error('usage: node scripts/inspect-dsh.mjs <url> <png> <profile> [width] [height]')
const width = Number(widthRaw)
const height = Number(heightRaw)
await mkdir(profile, { recursive: true })
const port = 19393
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking',
  '--disable-component-update', '--disable-sync', '--no-first-run', '--no-default-browser-check',
  `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, url,
], { stdio: 'ignore', windowsHide: true })

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let target
for (let i = 0; i < 80; i += 1) {
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())
    target = list.find(entry => entry.type === 'page' && entry.url.startsWith(url)) ?? list.find(entry => entry.type === 'page')
    if (target) break
  } catch {}
  await delay(100)
}
if (!target) {
  chrome.kill()
  throw new Error('Chrome DevTools target did not become ready')
}

const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
let nextId = 1
const pending = new Map()
const diagnostics = []
socket.on('message', raw => {
  const message = JSON.parse(String(raw))
  if (message.method === 'Runtime.exceptionThrown') diagnostics.push(message.params.exceptionDetails.text)
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(message.params.type)) {
    diagnostics.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '))
  }
  if (message.id === undefined) return
  const handler = pending.get(message.id)
  if (!handler) return
  pending.delete(message.id)
  message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result)
})
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})

await call('Page.enable')
await call('Runtime.enable')
await delay(2200)
await call('Runtime.evaluate', {
  expression: `(() => { const button = [...document.querySelectorAll('button')].find(node => /继续|Continue/i.test(node.textContent || '')); if (button) { button.click(); return true } return false })()`,
  returnByValue: true,
})
await delay(700)
await call('Runtime.evaluate', {
  expression: `(() => { const button = [...document.querySelectorAll('button')].find(node => /稍后配置|Set up later/i.test(node.textContent || '')); if (button) { button.click(); return true } return false })()`,
  returnByValue: true,
})
await delay(700)
const selection = await call('Runtime.evaluate', {
  expression: `(() => { const label = ${JSON.stringify(sessionLabel)}; const leaves = [...document.querySelectorAll('*')].filter(item => item.children.length === 0 && (item.textContent || '').trim() === label); const leaf = leaves.find(item => { const rect = item.getBoundingClientRect(); return rect.x < 300 && rect.y > 150 }) || leaves.at(-1); const node = leaf?.closest('button,a,[role="button"],[role="treeitem"]') || leaf; if (node) { node.click(); return { html: node.outerHTML.slice(0, 300), rect: node.getBoundingClientRect().toJSON(), candidates: leaves.map(item => item.getBoundingClientRect().toJSON()) } } return null })()`,
  returnByValue: true,
})
await delay(1400)
const initial = await call('Runtime.evaluate', {
  expression: `(() => { const trigger = document.querySelector('.dshSources__trigger'); return { title: document.title, trigger: trigger ? { disabled: trigger.disabled, label: trigger.getAttribute('aria-label'), expanded: trigger.getAttribute('aria-expanded'), rect: trigger.getBoundingClientRect().toJSON() } : null, panel: !!document.querySelector('.dshSources__details,.dshSources__compact'), pluginStyles: !!document.querySelector('style[data-plugin="dsh-ui-sources"]') } })()`,
  returnByValue: true,
})
await call('Runtime.evaluate', {
  expression: `(() => { const trigger = document.querySelector('.dshSources__trigger'); if (trigger && !trigger.disabled) { trigger.click(); return true } return false })()`,
  returnByValue: true,
})
await delay(400)
const opened = await call('Runtime.evaluate', {
  expression: `(() => { const panel = document.querySelector('.dshSources__details,.dshSources__compact'); const rows = [...document.querySelectorAll('.dshSources__fullRow,.dshSources__compactRow')]; const more = document.querySelector('.dshSources__more'); return { panel: panel ? { kind: panel.classList.contains('dshSources__details') ? 'details' : 'compact', rect: panel.getBoundingClientRect().toJSON(), text: panel.innerText.slice(0, 900) } : null, rowCount: rows.length, otherExpanded: more?.getAttribute('aria-expanded') ?? null, viewport: { width: innerWidth, height: innerHeight }, bodyText: document.body.innerText.slice(0, 500) } })()`,
  returnByValue: true,
})
const disclosure = await call('Runtime.evaluate', {
  expression: `(() => { const more = document.querySelector('.dshSources__more'); if (!more) return null; more.click(); return true })()`,
  returnByValue: true,
})
await delay(120)
const expanded = await call('Runtime.evaluate', {
  expression: `(() => ({ rowCount: document.querySelectorAll('.dshSources__fullRow,.dshSources__compactRow').length, expanded: document.querySelector('.dshSources__more')?.getAttribute('aria-expanded') ?? null }))()`,
  returnByValue: true,
})
if (disclosure.result.value) {
  await call('Runtime.evaluate', { expression: `document.querySelector('.dshSources__more')?.click()` })
  await delay(120)
}
const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
await writeFile(output, Buffer.from(screenshot.data, 'base64'))
await call('Runtime.evaluate', { expression: `document.querySelector('.dshSources__close')?.click()` })
await delay(120)
const closed = await call('Runtime.evaluate', {
  expression: `(() => ({ panel: !!document.querySelector('.dshSources__details,.dshSources__compact'), expanded: document.querySelector('.dshSources__trigger')?.getAttribute('aria-expanded') ?? null }))()`,
  returnByValue: true,
})
process.stdout.write(`${JSON.stringify({ selection: selection.result.value, initial: initial.result.value, opened: opened.result.value, disclosure: expanded.result.value, closed: closed.result.value, diagnostics })}\n`)
socket.close()
chrome.kill()
