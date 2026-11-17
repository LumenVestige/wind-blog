import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// 按仓库标记定位，避免需求目录层级变化使检查失效。
let root = dirname(fileURLToPath(import.meta.url))
while (!existsSync(join(root, '.git'))) {
  const parent = dirname(root)
  assert.notEqual(parent, root, 'Cannot find repository root')
  root = parent
}
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))

test('R1: removed setup command is not registered', () => {
  assert.equal(Object.hasOwn(pkg.scripts, 'setup-agent-workspace'), false)
})

test('R2: setup entry, dedicated tests and README instructions are removed', () => {
  for (const file of ['scripts/dev/agent-workspace.mjs', 'tests/agent-workspace.test.ts']) {
    assert.equal(existsSync(join(root, file)), false, file)
  }
  assert.doesNotMatch(read('README.md'), /setup-agent-workspace|agent-workspace\.mjs|AGENT_WORKSPACE_REPO|scripts\/dev\/AgentDevWorkSpace/)
})

test('R3: unrelated commands and existing workspace are retained', () => {
  const { 'setup-agent-workspace': removed, ...remaining } = pkg.scripts
  assert.deepEqual(remaining, {
    'fonts:prepare': 'node scripts/prepare-fonts.mjs',
    postinstall: 'npm run fonts:prepare',
    predev: 'npm run fonts:prepare',
    prebuild: 'npm run fonts:prepare',
    dev: 'next dev',
    build: 'next build',
    start: 'next start',
    lint: 'next lint',
    typecheck: 'tsc --noEmit',
    'db:migrate': 'node --env-file-if-exists=.env.local --import tsx src/db/migrate.ts',
    'db:seed': 'node --env-file-if-exists=.env.local --import tsx src/db/seed.ts',
    migrate: 'sh scripts/migrate.sh',
    test: 'vitest run',
    'test:watch': 'vitest',
  })
  for (const file of ['AGENTS.md', 'agent-workspace/AGENTS.md', 'agent-workspace/skills/common/sdd/SKILL.md', 'agent-workspace/tony/notes']) {
    assert.equal(existsSync(join(root, file)), true, file)
  }
})
