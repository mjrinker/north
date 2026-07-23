// Remote logging server for development
// Receives logs from the browser and prints them to the terminal.
// Start with: npm run logger
// Then access the app from your iPhone at http://YOUR_LOCAL_IP:5173

import http from 'node:http';
import os from 'node:os';

const PORT = 3001;

// ── ANSI color helpers ──────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  log: '\x1b[38;5;244m',      // grey
  info: '\x1b[38;5;75m',      // blue
  warn: '\x1b[38;5;220m',     // yellow
  error: '\x1b[38;5;196m',    // red
  tag: '\x1b[38;5;240m',      // dim tag
  url: '\x1b[38;5;245m',      // dim url
  stack: '\x1b[38;5;242m',    // dim stack
};

function color(level) {
  return colors[level] || colors.log;
}

// ── Get local network IP (not loopback) ────────────────────────────
function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

// ── HTTP server ─────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    let entries = [];
    try {
      entries = JSON.parse(body);
      if (!Array.isArray(entries)) entries = [entries];
    } catch {
      console.error(`${colors.error}[logger] Failed to parse:${colors.reset} ${body}`);
      res.writeHead(400);
      res.end('bad request');
      return;
    }

    for (const entry of entries) {
      const time = new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false });
      const level = (entry.level || 'log').toUpperCase().padEnd(5);
      const msg = entry.message || '';
      const urlPart = entry.url ? ` ${colors.url}${entry.url}${colors.reset}` : '';

      console.log(
        `${color(entry.level)}[${time}] ${level}${colors.reset}${urlPart}\n  ${msg}`
      );

      if (entry.stack) {
        console.log(`  ${colors.stack}${entry.stack.replace(/\n/g, '\n  ')}${colors.reset}`);
      }
    }

    res.writeHead(200);
    res.end('ok');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n' + '─'.repeat(50));
  console.log('  Remote Logger');
  console.log('─'.repeat(50));
  console.log(`  Server:    http://0.0.0.0:${PORT}`);
  console.log(`  From LAN:  http://${ip}:${PORT}`);
  console.log('─'.repeat(50));
  console.log('  On your iPhone:');
  console.log(`    1. Find your local IP above (${ip})`);
  console.log(`    2. Open http://${ip}:5173 in Safari`);
  console.log(`    3. Logs appear here in real time`);
  console.log('─'.repeat(50) + '\n');
});
