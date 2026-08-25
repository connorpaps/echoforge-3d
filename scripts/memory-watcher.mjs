#!/usr/bin/env node
/**
 * Auto-memory file watcher (zero input, local-only).
 *
 * Watches the project for file changes and appends a timestamped entry to
 * docs/activity-watch.log (gitignored). This is a raw, mechanical record of
 * every file save — useful as a fallback when no commit has been made yet.
 *
 * Usage:  node scripts/memory-watcher.mjs
 * Stop:   Ctrl+C
 */
import { watch } from 'node:fs'
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOG = join(ROOT, 'docs', 'activity-watch.log')
// Any path segment matching these is skipped (all segments are checked, so
// e.g. "MyApp.xcodeproj/project.xcworkspace/xcuserdata/..." is caught).
const IGNORED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'DerivedData', // Xcode build artifacts
  'xcuserdata', // per-user Xcode state (rewritten constantly)
  '.build', // Swift Package Manager
  'Pods', // CocoaPods
  'out',
  'release',
  '.next', // Next.js build output
  '.vite',
  'coverage',
  '.playwright-cli',
  '.audit', // EchoForge QA snapshots
  '.freebuff', // Freebuff local state
  'docs', // our own log lives here; avoid feedback loops
])
const DEBOUNCE_MS = 1500
const pending = new Map()

mkdirSync(dirname(LOG), { recursive: true })

function write(entry) {
  try {
    appendFileSync(LOG, `${entry}\n`)
  } catch (err) {
    console.error(`[memory-watcher] write failed: ${err.message}`)
  }
}

function isIgnored(rel) {
  if (!rel) return true
  if (rel.endsWith('activity-watch.log')) return true
  if (rel.endsWith('.DS_Store')) return true // macOS folder noise
  return rel.split(/[\\/]/).some((seg) => IGNORED_SEGMENTS.has(seg))
}

function handleChange(eventType, filename) {
  if (!filename) return
  const rel = relative(ROOT, filename).replaceAll('\\', '/')
  if (isIgnored(rel)) return

  // Debounce per path so burst saves collapse into one entry
  const key = rel
  if (pending.has(key)) clearTimeout(pending.get(key))
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      write(`[${new Date().toISOString()}] ${eventType}: ${rel}`)
    }, DEBOUNCE_MS),
  )
}

let watcher
try {
  watcher = watch(ROOT, { recursive: true }, handleChange)
} catch (err) {
  console.error(`[memory-watcher] recursive watch failed on this platform: ${err.message}`)
  console.error('Fallback: watch the project source dirs individually.')
  const FALLBACK_DIRS = ['src', 'backend', 'scripts', 'docs']
  const EXISTING = FALLBACK_DIRS.filter((d) => existsSync(join(ROOT, d)))
  if (EXISTING.length === 0) {
    console.error('[memory-watcher] none of the fallback dirs exist — set FALLBACK_DIRS for this project.')
    process.exit(1)
  }
  watcher = EXISTING.map((d) => watch(join(ROOT, d), { recursive: true }, handleChange))
}

console.log(`[memory-watcher] watching ${ROOT}`)
console.log(`[memory-watcher] logging to ${LOG}`)
console.log('[memory-watcher] Ctrl+C to stop')

process.on('SIGINT', () => {
  for (const p of pending.values()) clearTimeout(p)
  if (Array.isArray(watcher)) watcher.forEach((w) => w.close())
  else watcher.close()
  process.exit(0)
})
