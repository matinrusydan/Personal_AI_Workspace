import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = import.meta.dirname || fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(__dirname, '..');

const entry = process.argv[2] || 'dist/main.js';
const isWindows = process.platform === 'win32';
const tscCmd = isWindows ? 'tsc.cmd' : 'tsc';

// Locate local or root tsc executable
const localTsc = resolve('node_modules', '.bin', tscCmd);
const rootTsc = resolve(repoRoot, 'node_modules', '.bin', tscCmd);
const tscBin = existsSync(localTsc) ? localTsc : existsSync(rootTsc) ? rootTsc : 'tsc';

console.log(`\n======================================================`);
console.log(`[WatchRunner] 🚀 Starting Hot-Reload Dev Mode for ${entry}`);
console.log(`[WatchRunner] Changes in src/ will auto-compile & reload!`);
console.log(`======================================================\n`);

// 1. Initial compilation to ensure dist/ is fresh
try {
  console.log('[WatchRunner] Compiling TypeScript...');
  execSync(`"${tscBin}"`, { stdio: 'inherit' });
  console.log('[WatchRunner] Compilation complete. Starting server and file watchers...\n');
} catch {
  console.warn('[WatchRunner] Warning: Initial build had diagnostics, starting watchers anyway...\n');
}

// 2. Start tsc in watch mode (incremental compile on save)
const tsc = spawn(`"${tscBin}"`, ['-w', '--preserveWatchOutput'], {
  stdio: 'inherit',
  shell: true,
});

// 3. Start node with native --watch on compiled entrypoint
const server = spawn('node', ['--watch', entry], {
  stdio: 'inherit',
  shell: true,
});

function cleanup() {
  try {
    tsc.kill();
  } catch {}
  try {
    server.kill();
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
