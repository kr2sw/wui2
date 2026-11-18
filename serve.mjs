/*!
 * WUI - serve.mjs
 * 의존성 없는 데모/API 서버.
 *
 *   npm start            → http://localhost:4173
 *   PORT=8080 npm start  → 포트 변경
 *
 * API
 *   GET  /api/menu              → src/data/menu.json
 *   GET  /api/layers/:id        → src/data/layers/:id.json
 *   GET  /api/data/:id          → src/data/data/:id.json
 *   GET  /api/tree              → src/data/tree.json
 *   POST /api/submit            → 검증 후 저장 결과 모의 응답
 *   POST /api/action/:name      → 액션 모의 응답
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const DELAY = Number(process.env.API_DELAY || 220);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value, headers = {}) {
  send(res, status, `${JSON.stringify(value, null, 2)}\n`, {
    'Content-Type': MIME['.json'],
    ...headers,
  });
}

async function readJsonFile(relativePath) {
  const file = resolve(ROOT, relativePath);
  const text = await readFile(file, 'utf8');
  return JSON.parse(text);
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('요청 본문이 너무 큽니다.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) { resolveBody({}); return; }
      try { resolveBody(JSON.parse(raw)); }
      catch (_) { resolveBody({ raw }); }
    });
    req.on('error', reject);
  });
}

async function serveStatic(res, pathname, method) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/' || relative === '') relative = '/index.html';
  const file = resolve(ROOT, `.${relative}`);
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  try {
    const info = await stat(file);
    if (info.isDirectory()) return serveStatic(res, `${relative.replace(/\/$/, '')}/index.html`, method);
    const body = await readFile(file);
    if (method === 'HEAD') {
      send(res, 200, '', { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      return;
    }
    send(res, 200, body, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
    });
  } catch (_) {
    sendJson(res, 404, { error: 'Not Found', path: relative });
  }
}

const server = createServer(async (req, res) => {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const { pathname, searchParams } = url;
  const started = Date.now();

  res.on('finish', () => {
    console.log(`${String(res.statusCode).padEnd(3)} ${method.padEnd(4)} ${pathname}${searchParams.size ? `?${searchParams}` : ''} ${Date.now() - started}ms`);
  });

  if (method === 'OPTIONS') {
    send(res, 204, '', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return;
  }

  try {
    /* ------------------------------ API ------------------------------ */
    if (pathname === '/api/menu' && method === 'GET') {
      if (DELAY) await sleep(DELAY);
      sendJson(res, 200, await readJsonFile('src/data/menu.json'), { 'Access-Control-Allow-Origin': '*' });
      return;
    }

    if (pathname === '/api/tree' && method === 'GET') {
      if (DELAY) await sleep(DELAY);
      sendJson(res, 200, await readJsonFile('src/data/tree.json'), { 'Access-Control-Allow-Origin': '*' });
      return;
    }

    const layerMatch = /^\/api\/layers\/([\w.-]+)$/.exec(pathname);
    if (layerMatch && method === 'GET') {
      if (DELAY) await sleep(DELAY);
      try {
        const layer = await readJsonFile(`src/data/layers/${layerMatch[1]}.json`);
        sendJson(res, 200, layer, { 'Access-Control-Allow-Origin': '*' });
      } catch (_) {
        sendJson(res, 404, { error: '레이어를 찾을 수 없습니다.', id: layerMatch[1] });
      }
      return;
    }

    const dataMatch = /^\/api\/data\/([\w.-]+)$/.exec(pathname);
    if (dataMatch && method === 'GET') {
      if (DELAY) await sleep(DELAY);
      try {
        const payload = await readJsonFile(`src/data/data/${dataMatch[1]}.json`);
        sendJson(res, 200, payload, { 'Access-Control-Allow-Origin': '*' });
      } catch (_) {
        sendJson(res, 404, { error: '데이터를 찾을 수 없습니다.', id: dataMatch[1] });
      }
      return;
    }

    if ((pathname === '/api/submit' || pathname.startsWith('/api/action/')) && method === 'POST') {
      const body = await readBody(req);
      if (body && body.fail) {
        sendJson(res, 422, { ok: false, message: '검증에 실패했습니다. (fail 플래그)', errors: body.errors || [] });
        return;
      }
      if (DELAY) await sleep(Math.max(120, DELAY));
      const action = pathname.startsWith('/api/action/') ? decodeURIComponent(pathname.split('/').pop()) : 'submit';
      const values = body && body.values ? body.values : {};
      const entries = values && typeof values === 'object' ? Object.keys(values) : [];
      sendJson(res, 200, {
        ok: true,
        action,
        message: action === 'submit'
          ? `저장되었습니다. (${entries.length}개 필드, ${new Date().toLocaleTimeString('ko-KR')})`
          : `${action} 액션을 처리했습니다.`,
        menu: body && body.menu,
        fieldCount: entries,
        at: new Date().toISOString(),
      }, { 'Access-Control-Allow-Origin': '*' });
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: '알 수 없는 API 입니다.', path: pathname });
      return;
    }

    /* ------------------------------ 정적 파일 ------------------------------ */
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method Not Allowed' });
      return;
    }
    await serveStatic(res, pathname, method);
  } catch (err) {
    console.error('[serve]', err);
    sendJson(res, 500, { error: err.message || String(err) });
  }
});

server.listen(PORT, HOST, () => {
  const shown = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log('');
  console.log('  WUI 데모 서버');
  console.log(`  → http://${shown}:${PORT}/`);
  console.log(`  → http://${shown}:${PORT}/DOC/ (문서)`);
  console.log(`  정적 루트: ${ROOT}`);
  console.log(`  API 지연: ${DELAY}ms (API_DELAY 로 변경)`);
  console.log('');
});
