/**
 * Install or update AgentSkill (agent collaboration rules) for this repository.
 * Clones git@github.com:LumenVestige/AgentSkill.git into scripts/dev/AgentSkill, then runs its
 * setup.sh against the repository root. Safe to re-run: an existing clone is fast-forwarded
 * (skipped when its work tree is dirty) and setup.sh is idempotent.
 *
 *   npm run setupagent
 *
 * AgentSkill is a separate repository; its setup.sh adds the clone and the AGENTS.md / CLAUDE.md
 * symlinks to .git/info/exclude, so nothing of it is committed here.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const repo = process.env.AGENT_SKILL_REPO || 'git@github.com:LumenVestige/AgentSkill.git'
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const skillDir = path.join(root, 'scripts/dev/AgentSkill')

const run = (file, args, options = {}) => execFileSync(file, args, { stdio: 'inherit', ...options })
const capture = (file, args) => execFileSync(file, args, { encoding: 'utf8' })

if (fs.existsSync(path.join(skillDir, '.git'))) {
  console.log(`更新 AgentSkill: ${skillDir}`)
  if (capture('git', ['-C', skillDir, 'status', '--porcelain']).trim()) {
    console.warn('AgentSkill 工作区有改动，跳过 git pull')
  } else {
    run('git', ['-C', skillDir, 'pull', '--ff-only'])
  }
} else if (fs.existsSync(skillDir)) {
  console.error(`${skillDir} 已存在但不是 git 仓库，请先移除`)
  process.exit(1)
} else {
  console.log(`克隆 AgentSkill: ${repo}`)
  run('git', ['clone', repo, skillDir])
}

console.log('执行 AgentSkill setup.sh')
run('sh', [path.join(skillDir, 'setup.sh'), root], { cwd: root })
