import { rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { build } from 'esbuild'

const external = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-conversation/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
]

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)))
  })
}

await rm('lib', { recursive: true, force: true })
await run(process.execPath, ['node_modules/typescript/bin/tsc', '--emitDeclarationOnly'])

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: false,
  packages: 'external',
})

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome120'],
  external,
  loader: { '.css': 'text' },
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-ui-sources", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: 'return module.exports; } });',
  },
})
