import { readFile } from 'node:fs/promises'
import { zstdDecompressSync } from 'node:zlib'

const [file] = process.argv.slice(2)
if (!file) throw new Error('session path required')
const compressed = await readFile(file)
const plain = zstdDecompressSync(compressed).toString('utf8')
process.stdout.write(plain)
