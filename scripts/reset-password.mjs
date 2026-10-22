import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { hashSync } from 'bcryptjs'
async function secret(prompt) {
  if (!process.stdin.isTTY) throw new Error('请使用交互终端运行（docker exec -it）')
  process.stdout.write(prompt)
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8')
  return new Promise((resolve, reject) => {
    let value = ''
    function done() { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n') }
    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') { done(); reject(new Error('已取消')); return }
        if (char === '\r' || char === '\n') { done(); resolve(value); return }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else if (char >= ' ') value += char
      }
    }
    process.stdin.on('data', onData)
  })
}
try {
  const password = await secret('新站长密码（至少 12 位，输入不回显）：')
  if (password.length < 12) throw new Error('密码至少 12 位')
  if (password !== await secret('再次输入：')) throw new Error('两次密码不一致')
  const db = new DatabaseSync(process.env.DB_PATH || './data/wind-blog.db')
  const owner = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get()
  if (!owner) throw new Error('站点尚未初始化，请先访问 /setup')
  db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hashSync(createHash('sha256').update(password).digest('hex'), 12), owner.id)
  db.close(); console.log('站长密码已重置，已有会话已失效。')
} catch (error) { console.error(error.message); process.exitCode = 1 }
