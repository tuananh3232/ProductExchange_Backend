import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const rootDir = process.cwd()
const integrationDir = path.join(rootDir, 'tests', 'integration')
const jestBin = path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js')

const integrationFiles = fs
  .readdirSync(integrationDir)
  .filter((file) => file.endsWith('.test.js'))
  .sort((left, right) => left.localeCompare(right))

if (!integrationFiles.length) {
  console.error('No integration test files were found in tests/integration.')
  process.exit(1)
}

for (const fileName of integrationFiles) {
  const relativeTestPath = path.posix.join('tests', 'integration', fileName)
  const absoluteTestPath = path.join(integrationDir, fileName)
  console.log(`\n[serial-integration] Running ${relativeTestPath}`)

  const result = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', jestBin, '--selectProjects', 'integration', '--runInBand', '--runTestsByPath', absoluteTestPath],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    }
  )

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
