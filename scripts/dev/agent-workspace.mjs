/**
 * Install or update AgentDevWorkSpace (agent collaboration rules) for this repository.
 * Clones git@github.com:LumenVestige/AgentDevWorkSpace.git into scripts/dev/AgentDevWorkSpace, then runs its
 * setup.sh against the repository root. On repeat runs, an existing clone is updated with
 * git pull --ff-only before setup.sh runs. An update failure stops initialization.
 *
 *   npm run setup-agent-workspace
 *
 * The clone and local runtime configuration are ignored. Shared workspace skills and
 * project instructions are versioned in this repository.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const repo = process.env.AGENT_WORKSPACE_REPO || 'git@github.com:LumenVestige/AgentDevWorkSpace.git'
const root = path.resolve(fileURLToPath(new URL('../../', import.meta.url)))
const skillDir = path.join(root, 'scripts/dev/AgentDevWorkSpace')

const run = (file, args, options = {}) => execFileSync(file, args, { stdio: 'inherit', ...options })

if (fs.existsSync(path.join(skillDir, '.git'))) {
  console.log(`更新 AgentDevWorkSpace: ${skillDir}`)
  run('git', ['-C', skillDir, 'pull', '--ff-only'])
} else if (fs.existsSync(skillDir)) {
  console.error(`${skillDir} 已存在但不是 git 仓库，请先移除`)
  process.exit(1)
} else {
  console.log(`克隆 AgentDevWorkSpace: ${repo}`)
  run('git', ['clone', repo, skillDir])
}

console.log('执行 AgentDevWorkSpace setup.sh')
run('sh', [path.join(skillDir, 'setup.sh'), root], { cwd: root })
