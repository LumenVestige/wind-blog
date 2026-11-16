import { afterEach, describe, expect, it } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixtures: string[] = []
const project = resolve(__dirname, '..')

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true })
})

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'wind-agent-workspace '))
  fixtures.push(root)
  const remote = join(root, 'remote.git')
  const source = join(root, 'source')
  const app = join(root, 'app')
  const clone = join(app, 'scripts/dev/AgentDevWorkSpace')
  const env = {
    ...process.env,
    AGENT_WORKSPACE_REPO: remote,
    GIT_AUTHOR_NAME: 'Workspace Test',
    GIT_AUTHOR_EMAIL: 'workspace-test@example.com',
    GIT_COMMITTER_NAME: 'Workspace Test',
    GIT_COMMITTER_EMAIL: 'workspace-test@example.com',
    npm_config_cache: join(root, 'npm-cache'),
    npm_config_update_notifier: 'false',
  }
  const git = (cwd: string, ...args: string[]) => execFileSync('git', [
    '-c', 'core.hooksPath=' + join(root, 'hooks'),
    '-c', 'commit.gpgsign=false', ...args,
  ], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  mkdirSync(source)
  mkdirSync(join(app, 'scripts/dev'), { recursive: true })
  mkdirSync(join(root, 'hooks'))
  git(root, 'init', '--bare', '--initial-branch=main', remote)
  git(source, 'init', '--initial-branch=main')
  git(source, 'remote', 'add', 'origin', remote)
  const publish = (version: string) => {
    writeFileSync(join(source, 'setup.sh'), `#!/bin/sh\nprintf '%s\\n' '${version}' >> "$1/setup-runs.txt"\n`)
    git(source, 'add', 'setup.sh')
    git(source, 'commit', '-m', version)
    git(source, 'push', 'origin', 'main')
    return git(source, 'rev-parse', 'HEAD')
  }
  const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'))
  writeFileSync(join(app, 'package.json'), JSON.stringify({
    private: true,
    scripts: { 'setup-agent-workspace': pkg.scripts['setup-agent-workspace'] },
  }))
  copyFileSync(join(project, 'scripts/dev/agent-workspace.mjs'), join(app, 'scripts/dev/agent-workspace.mjs'))
  const run = () => spawnSync('npm', ['run', 'setup-agent-workspace'], { cwd: app, env, encoding: 'utf8' })
  const runs = () => readFileSync(join(app, 'setup-runs.txt'), 'utf8')
  return { app, clone, git, publish, run, runs }
}

describe('setup-agent-workspace', () => {
  it('clones once, reruns setup, and updates the existing repository before setup', () => {
    const f = fixture()
    const first = f.publish('v1')
    expect(f.run().status).toBe(0)
    expect(f.git(f.clone, 'rev-parse', 'HEAD')).toBe(first)
    expect(f.runs()).toBe('v1\n')
    expect(f.run().status).toBe(0)
    expect(f.runs()).toBe('v1\nv1\n')

    const next = f.publish('v2')
    const result = f.run()
    expect(result.status, result.stderr).toBe(0)
    expect(f.git(f.clone, 'rev-parse', 'HEAD')).toBe(next)
    expect(f.runs()).toBe('v1\nv1\nv2\n')
  })

  it('stops before setup when an update would overwrite local changes', () => {
    const f = fixture()
    const first = f.publish('v1')
    expect(f.run().status).toBe(0)
    const local = '#!/bin/sh\nexit 42\n'
    writeFileSync(join(f.clone, 'setup.sh'), local)
    f.publish('v2')

    expect(f.run().status).not.toBe(0)
    expect(f.git(f.clone, 'rev-parse', 'HEAD')).toBe(first)
    expect(readFileSync(join(f.clone, 'setup.sh'), 'utf8')).toBe(local)
    expect(f.runs()).toBe('v1\n')
  })

  it('rejects an existing directory without a Git repository', () => {
    const f = fixture()
    mkdirSync(f.clone)
    const result = f.run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('已存在但不是 git 仓库')
  })
})
