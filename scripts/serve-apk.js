#!/usr/bin/env node
/**
 * Build the dev-flavour APK and serve it over the local Wi-Fi with a QR code.
 * Usage: node scripts/serve-apk.js <release|debug> [--no-build] [--host <ip>] [--port <n>]
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const ROOT = path.resolve(__dirname, '..');
const ANDROID_DIR = path.join(ROOT, 'android');
const DEFAULT_PORT = 8787;
const PORT_ATTEMPTS = 10;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const [type, ...rest] = argv;
  if (type !== 'release' && type !== 'debug') {
    fail('Usage: node scripts/serve-apk.js <release|debug> [--no-build] [--host <ip>] [--port <n>]');
  }
  const opts = { type, build: true, host: null, port: DEFAULT_PORT };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--no-build') {
      opts.build = false;
    } else if (arg === '--host' && rest[i + 1]) {
      opts.host = rest[(i += 1)];
    } else if (arg === '--port' && rest[i + 1]) {
      opts.port = Number(rest[(i += 1)]);
      if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
        fail(`Invalid port: ${rest[i]}`);
      }
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function build(type) {
  const task = type === 'release' ? 'assembleDevRelease' : 'assembleDevDebug';
  console.log(`> ./gradlew ${task}`);
  return new Promise(resolve => {
    const child = spawn('./gradlew', [task], { cwd: ANDROID_DIR, stdio: 'inherit' });
    child.on('error', err => {
      console.error(err.message);
      resolve(1);
    });
    child.on('close', code => resolve(code ?? 1));
  });
}

function findApk(type) {
  const dir = path.join(ANDROID_DIR, 'app', 'build', 'outputs', 'apk', 'dev', type);
  const apks = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.apk'))
        .map(name => {
          const file = path.join(dir, name);
          return { file, stat: fs.statSync(file) };
        })
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    : [];
  if (apks.length === 0) {
    fail(`No APK found in ${path.relative(ROOT, dir)}. Run without --no-build first.`);
  }
  return apks[0];
}

function readVersionName() {
  const gradle = fs.readFileSync(path.join(ANDROID_DIR, 'app', 'build.gradle'), 'utf8');
  const base = gradle.match(/versionName\s+"([^"]+)"/);
  const devFlavor = gradle.match(/\bdev\s*\{[^}]*versionNameSuffix\s+"([^"]+)"/);
  return `${base ? base[1] : 'unknown'}${devFlavor ? devFlavor[1] : ''}`;
}

function lanAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
        candidates.push({ name, address: addr.address });
      }
    }
  }
  const preferred = candidates.find(c => c.name === 'en0' || c.name.startsWith('wlan'));
  return (preferred ?? candidates[0])?.address ?? null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function page({ versionName, sizeMb, builtAt }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Irbis Dev</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:32px 20px;text-align:center;background:#F6F8FA;color:#24282E}
h1{margin:0 0 8px}p{margin:4px 0;color:#5B6672}
a.btn{display:inline-block;margin:28px 0 16px;padding:18px 36px;border-radius:14px;background:#1CB0A8;color:#fff;
font-size:20px;font-weight:600;text-decoration:none}
</style></head><body>
<h1>Irbis Dev</h1>
<p>Version ${escapeHtml(versionName)} · ${escapeHtml(sizeMb)} MB</p>
<p>Built ${escapeHtml(builtAt)}</p>
<a class="btn" href="/irbis.apk">Download APK</a>
<p>Allow installs from this source if Android asks</p>
</body></html>`;
}

function createServer({ apk, type, versionName }) {
  const meta = {
    versionName,
    sizeMb: (apk.stat.size / (1024 * 1024)).toFixed(1),
    builtAt: apk.stat.mtime.toLocaleString(),
  };
  return http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    if (url === '/') {
      const body = page(meta);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    if (url === '/irbis.apk') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="irbis-dev-${type}.apk"`,
        'Content-Length': apk.stat.size,
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      console.log(`↓ ${req.socket.remoteAddress}`);
      const stream = fs.createReadStream(apk.file);
      stream.on('error', err => {
        console.error(`Read failed: ${err.message}`);
        res.destroy(err);
      });
      stream.pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
}

function listen(server, port, attempt = 0) {
  return new Promise((resolve, reject) => {
    const onError = err => {
      server.off('listening', onListening);
      if (err.code === 'EADDRINUSE' && attempt < PORT_ATTEMPTS) {
        resolve(listen(server, port + 1, attempt + 1));
      } else {
        reject(err);
      }
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '0.0.0.0');
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const host = opts.host ?? lanAddress();
  if (!host) {
    fail('No Wi-Fi/LAN address found');
  }
  if (opts.build) {
    const code = await build(opts.type);
    if (code !== 0) {
      fail('Build failed');
    }
  }
  const apk = findApk(opts.type);
  const server = createServer({ apk, type: opts.type, versionName: readVersionName() });
  const port = await listen(server, opts.port).catch(err => fail(`Cannot start server: ${err.message}`));
  const url = `http://${host}:${port}/`;
  console.log(`\nServing ${path.relative(ROOT, apk.file)}\n${url}\n`);
  qrcode.generate(url, { small: true });
  console.log('Scan on the same Wi-Fi · Ctrl+C to stop');
}

main().catch(err => fail(err.message));
