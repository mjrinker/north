// Remote logger — forwards browser console output to the dev logging server
// Only activates in `vite dev` (import.meta.env.DEV).
// To remove later: delete this file, remove the import in +layout.svelte.

/** Single log entry sent to the server */
interface LogEntry {
  timestamp: string
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  stack?: string
  url?: string
}

// ── Buffer ──────────────────────────────────────────────────────────
const queue: LogEntry[] = []
let timer: ReturnType<typeof setTimeout> | null = null

const FLUSH_INTERVAL = 400        // ms between flushes
const LOG_PORT = 3001

// Auto-detect server host from the page (works on LAN with iPhone)
function serverUrl(): string {
  return `http://${window.location.hostname}:${LOG_PORT}`
}

/** Send queued entries to the logging server (fire-and-forget). */
function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0)
  const body = JSON.stringify(batch)
  try {
    fetch(serverUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      // keepalive lets the request complete even if the page unloads
      keepalive: true,
    }).catch(() => {
      // server not running — silently drop
    })
  } catch {
    // defensive: ignore
  }
}

/** Enqueue a log entry and schedule a flush. */
function enqueue(level: LogEntry['level'], args: unknown[]) {
  if (typeof window === 'undefined') return   // SSR guard

  const message = args
    .map((a) => {
      if (typeof a === 'object' && a !== null) {
        try {
          // avoid crashing the logger on circular references
          const seen = new WeakSet()
          return JSON.stringify(a, (_, v) => {
            if (typeof v === 'object' && v !== null) {
              if (seen.has(v)) return '[Circular]'
              seen.add(v)
            }
            return v
          }, 2)
        } catch {
          return String(a)
        }
      }
      return String(a)
    })
    .join(' ')

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    stack: level === 'error' ? new Error().stack : undefined,
    url: window.location.href,
  }

  queue.push(entry)

  if (!timer) {
    timer = setTimeout(() => {
      timer = null
      flush()
    }, FLUSH_INTERVAL)
  }
}

// ── Init ────────────────────────────────────────────────────────────
let initialized = false

export function initRemoteLogger(): void {
  // Only activate in Vite dev mode
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return
  if (typeof window === 'undefined') return   // SSR
  if (initialized) return
  initialized = true

  // ── Patch console methods ────────────────────────────────────────
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  }

  console.log = (...args: unknown[]) => {
    orig.log(...args)
    enqueue('log', args)
  }

  console.info = (...args: unknown[]) => {
    orig.info(...args)
    enqueue('info', args)
  }

  console.warn = (...args: unknown[]) => {
    orig.warn(...args)
    enqueue('warn', args)
  }

  console.error = (...args: unknown[]) => {
    orig.error(...args)
    enqueue('error', args)
  }

  // ── Global error handlers ────────────────────────────────────────
  window.addEventListener('error', (e) => {
    const msg = e.error?.message || e.message || 'Unknown error'
    const stack = e.error?.stack
    enqueue('error', [msg])
    if (stack) {
      const stash = queue
      const saved = stash.splice(0)
      stash.push({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: stack,
        url: window.location.href,
      })
      stash.push(...saved)
    }
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const msg = reason?.message || String(reason || 'Unknown rejection')
    enqueue('error', [`Unhandled rejection: ${msg}`])
  })

  // ── Flush on page unload ─────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    flush()
  })

  // Initial log to confirm logger is active
  orig.log('[remote-logger] active')
}
