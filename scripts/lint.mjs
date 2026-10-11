/**
 * Lightweight static checks: runs on Node >= 22, fast
 * enough for every `npm run check`.
 *
 * - Syntax gate: `node --check` on every JS/MJS file in the repo.
 * - Purity and faithfulness rules that guard contracts the tests cannot see
 *   (e.g. the t4 rule that model display names are never rewritten).
 */
import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

/** [rule id, file scope, predicate(line) -> true when violating] */
const rules = [
  ['no-inner-html', 'src/client/', (line) => line.includes('dangerouslySetInnerHTML')],
  // t4 acceptance: the selector must never rewrite "(Agent Plan)"-style names.
  ['faithful-model-names', 'src/client/', (line) => line.includes('.replace(') && line.includes('Agent Plan')],
  ['browser-purity', 'src/client/', (line) => /\bprocess\.|['"]node:/.test(line)],
  ['host-logging', 'src/host/', (line) => /\bconsole\./.test(line)],
  ['domain-logging', 'src/domain/', (line) => /\bconsole\./.test(line)],
  ['tests-offline', 'test/', (line) => /\bfetch\(|XMLHttpRequest|require\('https?'\)/.test(line)],
]
const jsFiles = []
async function collectFiles(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) await collectFiles(file)
    else if (/\.m?js$/.test(entry.name)) jsFiles.push(file)
  }
}
for (const dir of ['src', 'test', 'scripts', 'lib']) await collectFiles(dir)

for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'pipe' })
  } catch (error) {
    problems.push(`syntax: ${file} fails node --check\n${error.stderr}`)
  }
}

const matchesScope = (file, scope) =>
  Array.isArray(scope) ? scope.includes(file) : scope.endsWith('/') ? file.startsWith(scope) : file === scope

for (const file of jsFiles.filter((candidate) => !candidate.startsWith('lib/'))) {
  const content = await readFile(path.join(root, file), 'utf8')
  for (const [id, scope, violating] of rules) {
    if (!matchesScope(file, scope)) continue
    content.split('\n').forEach((line, index) => {
      if (violating(line)) problems.push(`${id}: ${file}:${index + 1} ${line.trim().slice(0, 120)}`)
    })
  }
}

if (problems.length > 0) {
  console.error(`lint: ${problems.length} problem(s)`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log(`lint: OK (${jsFiles.length} files checked)`)
