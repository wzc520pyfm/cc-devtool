#!/usr/bin/env node

/**
 * Build platform-specific sidecar executables for Tauri.
 *
 * Pipeline: tsc (ESM) -> esbuild (single CJS bundle) -> pkg (standalone binary)
 *
 * Usage:
 *   node scripts/build-sidecar.js              # build for current platform
 *   node scripts/build-sidecar.js --target macos-arm64
 *   node scripts/build-sidecar.js --target all  # build all platforms (CI)
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { platform, arch } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries')
const TSC_ENTRY = join(ROOT, 'dist', 'cli', 'index.js')
const BUNDLE_DIR = join(ROOT, 'dist', 'bundle')
const BUNDLE_ENTRY = join(BUNDLE_DIR, 'cli.cjs')

const TARGET_MAP = {
  'macos-arm64':   { pkg: 'node20-macos-arm64',  triple: 'aarch64-apple-darwin',        ext: '' },
  'macos-x64':     { pkg: 'node20-macos-x64',    triple: 'x86_64-apple-darwin',         ext: '' },
  'linux-x64':     { pkg: 'node20-linux-x64',    triple: 'x86_64-unknown-linux-gnu',    ext: '' },
  'linux-arm64':   { pkg: 'node20-linux-arm64',   triple: 'aarch64-unknown-linux-gnu',   ext: '' },
  'windows-x64':   { pkg: 'node20-win-x64',      triple: 'x86_64-pc-windows-msvc',      ext: '.exe' },
}

function detectCurrentTarget() {
  const os = platform()
  const cpu = arch()
  if (os === 'darwin' && cpu === 'arm64') return 'macos-arm64'
  if (os === 'darwin' && cpu === 'x64')   return 'macos-x64'
  if (os === 'linux'  && cpu === 'x64')   return 'linux-x64'
  if (os === 'linux'  && cpu === 'arm64') return 'linux-arm64'
  if (os === 'win32'  && cpu === 'x64')   return 'windows-x64'
  throw new Error(`Unsupported platform: ${os}-${cpu}`)
}

function run(cmd) {
  console.log(`  > ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
}

function bundleWithEsbuild() {
  console.log('\n  Bundling with esbuild (ESM -> single CJS file)...')
  mkdirSync(BUNDLE_DIR, { recursive: true })

  run([
    'pnpm exec esbuild',
    `"${TSC_ENTRY}"`,
    '--bundle',
    '--platform=node',
    '--format=cjs',
    '--target=node20',
    `--outfile="${BUNDLE_ENTRY}"`,
    '--external:better-sqlite3',
    '--define:import.meta.url=_importMetaUrl',
    `--banner:js="var _importMetaUrl=require('url').pathToFileURL(__filename).href;"`,
  ].join(' '))

  if (!existsSync(BUNDLE_ENTRY)) {
    throw new Error(`esbuild bundle failed: ${BUNDLE_ENTRY} not found`)
  }
  console.log(`  Bundle created: ${BUNDLE_ENTRY}`)
}

function buildForTarget(targetKey) {
  const target = TARGET_MAP[targetKey]
  if (!target) throw new Error(`Unknown target: ${targetKey}. Valid: ${Object.keys(TARGET_MAP).join(', ')}`)

  const outputName = `cc-devtool-server-${target.triple}${target.ext}`
  const outputPath = join(BINARIES_DIR, outputName)

  console.log(`\n  Building sidecar for ${targetKey} -> ${outputName}`)

  mkdirSync(BINARIES_DIR, { recursive: true })

  run(
    `pnpm exec pkg "${BUNDLE_ENTRY}" ` +
    `--target ${target.pkg} ` +
    `--output "${outputPath}" ` +
    `--compress GZip`
  )

  if (existsSync(outputPath)) {
    console.log(`  Sidecar built: ${outputPath}`)
  } else {
    throw new Error(`Build failed: ${outputPath} not found`)
  }
}

// --- Main ---

const args = process.argv.slice(2)
let targetArg = null

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target' && args[i + 1]) {
    targetArg = args[i + 1]
    break
  }
}

if (!existsSync(TSC_ENTRY)) {
  console.log('  dist/ not found, running build first...')
  run('pnpm build')
}

bundleWithEsbuild()

if (targetArg === 'all') {
  console.log('\n  Building sidecars for all platforms...')
  for (const key of Object.keys(TARGET_MAP)) {
    buildForTarget(key)
  }
} else {
  const target = targetArg || detectCurrentTarget()
  buildForTarget(target)
}

console.log('\n  Sidecar build complete.\n')
