import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localesDir = path.join(root, 'src/renderer/src/lib/i18n/locales')
const basePath = path.join(localesDir, 'en-US/translation.json')
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'))
const baseKeys = Object.keys(base).sort()

let failed = false

for (const locale of fs.readdirSync(localesDir).sort()) {
  const file = path.join(localesDir, locale, 'translation.json')
  if (!fs.existsSync(file)) continue

  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const keys = Object.keys(data).sort()
  const missing = baseKeys.filter((key) => !(key in data))
  const extra = keys.filter((key) => !(key in base))

  if (missing.length || extra.length) {
    failed = true
    console.error(`${locale}:`)
    if (missing.length) console.error(`  missing: ${missing.join(', ')}`)
    if (extra.length) console.error(`  extra: ${extra.join(', ')}`)
  }
}

if (failed) {
  process.exitCode = 1
} else {
  console.log(`i18n locale keys match ${path.relative(root, basePath)}`)
}
