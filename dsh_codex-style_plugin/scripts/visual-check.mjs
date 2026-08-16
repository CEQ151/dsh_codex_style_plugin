import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const [url, output, profile] = process.argv.slice(2)
if (!url || !output || !profile) throw new Error('usage: node scripts/visual-check.mjs <url> <png> <profile>')
mkdirSync(profile, { recursive: true })
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const result = spawnSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-sync',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  '--window-size=1440,1000',
  '--hide-scrollbars',
  '--run-all-compositor-stages-before-draw',
  `--screenshot=${output}`,
  url,
], { stdio: 'inherit', windowsHide: true, timeout: 20_000 })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
