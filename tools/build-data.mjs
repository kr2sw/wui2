/*!
 * WUI - tools/build-data.mjs
 * src/data/seed.js 의 객체를 JSON 파일로 내보낸다.
 * - src/data/menu.json
 * - src/data/layers/{id}.json
 * - src/data/data/{id}.json
 * - src/data/tree.json
 *
 * 사용: npm run build:data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { menu, layers, dataMap, tree } from '../src/data/seed.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'src/data');

async function writeJson(relativePath, value) {
  const target = resolve(DATA_DIR, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const count = Array.isArray(value) ? `${value.length} rows` : 'object';
  console.log(`  ✓ ${relativePath} (${count})`);
}

console.log('[wui] JSON 데이터 생성');
await writeJson('menu.json', menu);
await writeJson('tree.json', tree);
for (const [id, layer] of Object.entries(layers)) await writeJson(`layers/${id}.json`, layer);
for (const [id, data] of Object.entries(dataMap)) await writeJson(`data/${id}.json`, data);
console.log('[wui] 완료');
