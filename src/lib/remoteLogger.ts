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

const FLUSH_INTERVAL = 400

function endpoint(): string {
  if (import.meta.env?.DEV) {
    return `http://${window.location.hostname}:3001`
  }
  return '/api/log'
}

function isDev() {
  return !!(import.meta.env?.DEV)
}

function send(body: string): void {
  if (isDev()) {
    fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } else {
    fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }
}

function sendBeacon(body: string): void {
  if (isDev()) return
  navigator.sendBeacon(endpoint(), body)
}

function flush() {
  if (queue.length === 0) return
  const batch = queue.splice(0)
  send(JSON.stringify(batch))
}

function lsPush(level: string, msg: string, stack?: string) {
  try {
    const KEY = '__logs'
    const MAX = 2000
    let buf: Record<string, unknown>[] = []
    try { buf = JSON.parse(localStorage.getItem(KEY) || '[]') } catch {}
    buf.push({ t: Date.now(), l: level, m: msg.slice(0, 5000), s: stack ? stack.slice(0, 10000) : undefined, u: window.location.href })
    if (buf.length > MAX) buf = buf.slice(buf.length - MAX)
    localStorage.setItem(KEY, JSON.stringify(buf))
  } catch {}
}

function enqueue(level: LogEntry['level'], args: unknown[]) {
  if (typeof window === 'undefined') return

  const message = args
    .map((a) => {
      if (typeof a === 'object' && a !== null) {
        try {
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

  lsPush(level, message, entry.stack)
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
  if (typeof window === 'undefined') return
  if (initialized) return
  initialized = true

  // Drain early errors captured by inline script in app.html
  const early = (window as any).__earlyErrors as Array<Record<string, unknown>> | undefined
  if (early && early.length) {
    const batch = early.splice(0)
    const rows = batch.map((e) => ({
      timestamp: e.t || new Date().toISOString(),
      level: 'error',
      message: typeof e.m === 'string' ? e.m : '',
      stack: typeof e.s === 'string' ? e.s : undefined,
      url: window.location.href,
    }))
    queue.push(...(rows as LogEntry[]))
  }

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

  window.addEventListener('beforeunload', () => {
    if (queue.length === 0) return
    sendBeacon(JSON.stringify(queue.splice(0)))
  })

}
