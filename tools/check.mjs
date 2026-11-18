/*!
 * WUI - tools/check.mjs
 * 빌드 도구 없이 문법/모듈 로딩/데이터 JSON 유효성을 검사한다.
 * 사용: npm run check
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function ok(message) { console.log(`  ✓ ${message}`); }
function fail(message, err) {
  failures += 1;
  console.error(`  ✗ ${message}`);
  if (err) console.error(`    ${err.message}`);
}

console.log('[wui] 모듈 로딩');
const modules = [
  'src/js/core/util.js', 'src/js/core/emitter.js', 'src/js/core/ajax.js', 'src/js/core/skin.js',
  'src/js/editor/editor.js', 'src/js/grid/grid.js', 'src/js/tree/tree.js',
  'src/js/layout/controls.js', 'src/js/layout/layout.js', 'src/js/app/app.js',
  'src/js/webui.js',
];
for (const file of modules) {
  try {
    await import(new URL(`../${file}`, import.meta.url));
    ok(file);
  } catch (err) { fail(file, err); }
}

console.log('[wui] 전역 내보내기');
try {
  const mod = await import(new URL('../src/js/webui.js', import.meta.url));
  const WUI = mod.default;
  const expected = ['createEditor', 'createGrid', 'createTree', 'createLayout', 'createApp', 'ajax', 'skin', 'util', 'registerControl'];
  const missing = expected.filter((key) => !WUI[key]);
  if (missing.length) throw new Error(`누락: ${missing.join(', ')}`);
  if (WUI.VERSION !== mod.VERSION) throw new Error('VERSION 불일치');
  const controls = WUI.listControls();
  if (controls.length < 20) throw new Error(`컨트롤 ${controls.length}개 (20개 미만)`);
  ok(`WUI ${WUI.VERSION} · 컨트롤 ${controls.length}종 · 테마 ${WUI.skin.listThemes().length}종`);
} catch (err) { fail('webui.js export', err); }

console.log('[wui] 데모 데이터');
try {
  const seed = await import(new URL('../src/data/seed.js', import.meta.url));
  if (!seed.menu.items.length) throw new Error('menu.items 가 비었습니다.');
  const menuIds = [];
  const walk = (items) => items.forEach((item) => {
    if (item.children) walk(item.children);
    else menuIds.push(item.id);
  });
  walk(seed.menu.items);
  for (const id of menuIds) {
    if (!seed.layers[id]) fail(`레이어 누락: ${id}`);
    else ok(`layer: ${id}`);
    if (!seed.dataMap[id] && !seed.layers[id]) fail(`데이터 누락: ${id}`);
  }
  ok(`메뉴 ${menuIds.length}개 · 레이어 ${Object.keys(seed.layers).length}개 · 데이터 ${Object.keys(seed.dataMap).length}개`);
} catch (err) { fail('seed.js', err); }

console.log('[wui] JSON 파일');
try {
  const menu = JSON.parse(await readFile(join(ROOT, 'src/data/menu.json'), 'utf8'));
  ok(`menu.json · ${menu.items.length} top-level items`);
  const layerFiles = await readdir(join(ROOT, 'src/data/layers'));
  for (const file of layerFiles) JSON.parse(await readFile(join(ROOT, 'src/data/layers', file), 'utf8'));
  ok(`layers/*.json · ${layerFiles.length} files`);
  const dataFiles = await readdir(join(ROOT, 'src/data/data'));
  for (const file of dataFiles) JSON.parse(await readFile(join(ROOT, 'src/data/data', file), 'utf8'));
  ok(`data/*.json · ${dataFiles.length} files`);
} catch (err) { fail('JSON parse', err); }

console.log('[wui] 문서 데이터');
try {
  const docDir = join(ROOT, 'DOC');
  const entries = await readdir(docDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((entry) => entry.isFile() && /^\d{2}-.+\.md$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (!mdFiles.length) throw new Error('DOC/*.md 문서가 없습니다.');

  let data;
  try {
    data = JSON.parse(await readFile(join(docDir, 'docs-data.json'), 'utf8'));
  } catch (err) {
    throw new Error('DOC/docs-data.json 이 없거나 올바르지 않습니다. npm run build:docs 를 실행하세요.');
  }
  if (!Array.isArray(data.docs)) throw new Error('docs-data.json 의 docs 배열이 없습니다.');
  if (data.docs.length !== mdFiles.length) {
    fail(`문서 수 불일치: Markdown ${mdFiles.length}개, docs-data ${data.docs.length}개`);
  }

  const byFile = new Map(data.docs.map((doc) => [doc.file, doc]));
  const ids = new Set();
  for (const file of mdFiles) {
    const doc = byFile.get(file);
    if (!doc) { fail(`docs-data 누락: ${file}`); continue; }
    if (!doc.title) fail(`문서 제목 없음: ${file}`);
    if (ids.has(doc.id)) fail(`문서 id 중복: ${doc.id}`);
    ids.add(doc.id);

    const markdown = (await readFile(join(docDir, file), 'utf8')).replace(/\r\n/g, '\n');
    if (doc.markdown !== markdown) fail(`Markdown 동기화 필요: ${file} (npm run build:docs)`);

    const headingIds = new Set();
    for (const heading of doc.headings || []) {
      if (headingIds.has(heading.id)) fail(`헤딩 id 중복: ${file} · ${heading.id}`);
      headingIds.add(heading.id);
    }

    const linkRe = /\]\(([^)\s]+\.md(?:#[^)\s]*)?)\)/g;
    let match;
    while ((match = linkRe.exec(markdown))) {
      const href = match[1];
      if (/^[a-z]+:/i.test(href)) continue;
      const target = href.split('#')[0].replace(/^\.\//, '');
      if (!mdFiles.includes(target)) fail(`문서 링크 대상 없음: ${file} → ${target}`);
    }
  }

  const jsRaw = await readFile(join(docDir, 'docs-data.js'), 'utf8');
  const jsMatch = jsRaw.match(/window\.WUI_DOCS\s*=\s*([\s\S]*);\s*$/);
  if (!jsMatch) fail('docs-data.js 형식 오류');
  else if (JSON.stringify(JSON.parse(jsMatch[1])) !== JSON.stringify(data)) fail('docs-data.js 와 docs-data.json 불일치');

  const indexHtml = await readFile(join(docDir, 'index.html'), 'utf8');
  for (const asset of ['docs-data.js', 'doc.css', 'doc.js']) {
    if (!indexHtml.includes(asset)) fail(`DOC/index.html 에서 ${asset} 참조 없음`);
  }

  ok(`DOC 문서 ${mdFiles.length}개 · 동기화/헤딩/링크/뷰어 참조`);
} catch (err) { fail('DOC 검사', err); }

if (failures) {
  console.error(`\n[wui] 실패 ${failures}건`);
  process.exit(1);
}
console.log('\n[wui] 검사 통과');
