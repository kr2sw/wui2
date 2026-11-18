/*!
 * WUI - tools/build-docs.mjs
 * DOC/*.md 를 읽어 문서 뷰어용 데이터(docs-data.js / docs-data.json)를 만든다.
 * 사용: npm run build:docs
 *
 * - 파일명(확장자 제외)을 문서 id 로 사용한다. 예: 01-overview
 * - 첫 번째 "# " 제목과 첫 문단을 목록용 메타데이터로 추출한다.
 * - "#" 를 제외한 헤딩(h2~h6)에 문서 내 고유 anchor id 를 부여한다.
 * - Markdown 원문을 그대로 포함하므로 뷰어가 자체 렌더링한다.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOC_DIR = join(ROOT, 'DOC');
const JS_FILE = join(DOC_DIR, 'docs-data.js');
const JSON_FILE = join(DOC_DIR, 'docs-data.json');

const DOC_RE = /^\d{2}-[a-z0-9-]+\.md$/i;

function stripInline(text) {
  return String(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, '$2')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTitle(lines) {
  for (const line of lines) {
    const match = line.match(/^#\s+(.+?)\s*#*\s*$/);
    if (match) return stripInline(match[1]);
  }
  return '';
}

function firstSummary(lines) {
  let inCode = false;
  let titleSeen = false;
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line) || /^~~~/.test(line)) {
      inCode = !inCode;
      if (out.length) break;
      continue;
    }
    if (inCode) {
      if (out.length) break;
      continue;
    }
    if (!titleSeen) {
      if (/^#\s+/.test(line)) titleSeen = true;
      continue;
    }
    if (!line) {
      if (out.length) break;
      continue;
    }
    const isBlock = /^(#{2,6}\s|[-*+]\s|\d+[.)]\s|\||>|---|\*\*\*|___)/.test(line);
    if (isBlock) {
      if (out.length) break;
      continue;
    }
    out.push(line);
  }
  const summary = stripInline(out.join(' '));
  if (!summary) return '';
  return summary.length > 220 ? `${summary.slice(0, 219)}…` : summary;
}

function slugify(text, index) {
  const base = stripInline(text)
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return base || `section-${index}`;
}

function collectHeadings(lines) {
  const headings = [];
  const used = new Set();
  let inCode = false;
  let index = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line) || /^~~~/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = line.match(/^(#{2,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    index += 1;
    const text = stripInline(match[2]);
    let id = slugify(text, index);
    let unique = id;
    let n = 2;
    while (used.has(unique)) unique = `${id}-${n++}`;
    used.add(unique);
    headings.push({ id: unique, text, level: match[1].length });
  }
  return headings;
}

function toJson(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function toScript(data) {
  const json = JSON.stringify(data, null, 2)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `/*!\n * WUI 문서 데이터 - tools/build-docs.mjs 가 자동 생성합니다.\n * 직접 수정하지 말고 DOC/*.md 수정 후 npm run build:docs 를 실행하세요.\n */\nwindow.WUI_DOCS = ${json};\n`;
}

async function main() {
  const entries = await readdir(DOC_DIR, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && DOC_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (!files.length) {
    throw new Error('DOC 폴더에 문서(예: 01-overview.md)가 없습니다.');
  }

  const docs = [];
  for (const file of files) {
    const markdown = (await readFile(join(DOC_DIR, file), 'utf8')).replace(/\r\n/g, '\n');
    const lines = markdown.split('\n');
    const id = file.replace(/\.md$/i, '');
    const title = firstTitle(lines) || id;
    const summary = firstSummary(lines);
    const headings = collectHeadings(lines);
    docs.push({
      id,
      file,
      order: docs.length + 1,
      title,
      summary,
      headings,
      markdown,
    });
  }

  const data = {
    schema: 1,
    generator: 'tools/build-docs.mjs',
    docs,
  };

  const json = toJson(data);
  await writeFile(JSON_FILE, json, 'utf8');
  await writeFile(JS_FILE, toScript(data), 'utf8');

  console.log(`[wui:docs] ${files.length}개 문서 → DOC/docs-data.js, DOC/docs-data.json`);
  for (const doc of docs) {
    const summary = doc.summary ? '' : ' (요약 없음)';
    console.log(`  - ${doc.id} · ${doc.title} · 헤딩 ${doc.headings.length}개${summary}`);
  }
}

main().catch((err) => {
  console.error(`[wui:docs] 실패: ${err.message}`);
  process.exit(1);
});
