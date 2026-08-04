import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mongodPath = process.env.MONGOD_PATH || 'C:\\Program Files\\MongoDB\\Server\\8.2\\bin\\mongod.exe'
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anh-decor-mongo-'))
const port = process.env.TEST_MONGO_PORT || '27018'

const run = (command, args, env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { env, stdio: 'inherit', windowsHide: true })
  child.once('error', reject)
  child.once('exit', (code, signal) => resolve({ code: code ?? 1, signal }))
})

let mongod
try {
  mongod = spawn(mongodPath, ['--dbpath', tempDir, '--port', port, '--bind_ip', '127.0.0.1', '--noauth'], {
    stdio: 'inherit',
    windowsHide: true,
  })
  await wait(2500)
  if (mongod.exitCode !== null) throw new Error('Không thể khởi động MongoDB cục bộ cho môi trường kiểm thử.')

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_NAME: 'anhdecor_test',
    MONGODB_URI: `mongodb://127.0.0.1:${port}/anhdecor_test`,
    JWT_SECRET: process.env.JWT_SECRET || 'local-test-secret',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'local-test-refresh-secret',
  }
  const jestPath = path.join(process.cwd(), 'node_modules', 'jest', 'bin', 'jest.js')
  const result = await run(process.execPath, ['--experimental-vm-modules', jestPath, '--selectProjects', 'integration', '--runInBand'], env)
  process.exitCode = result.code
} finally {
  if (mongod && mongod.exitCode === null) mongod.kill()
  fs.rmSync(tempDir, { recursive: true, force: true })
}
