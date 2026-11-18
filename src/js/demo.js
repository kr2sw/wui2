/*!
 * WUI - demo.js
 * 전체 기능 데모. index.html 에서 로드한다.
 * 서버(npm start) 없이 file:// 로 열어도 mock 데이터로 동작한다.
 */
import WUI from './webui.js';
import {
  menu, layers, dataMap, DEPARTMENT_TREE,
} from '../data/seed.js';

const { h, skin, ajax, createEditor, createGrid, createTree, createLayout, createApp } = WUI;

/* ------------------------------------------------------------------ *
 * 0. 공통
 * ------------------------------------------------------------------ */
skin.init({ target: document.documentElement });

/* 서버가 없거나 file:// 일 때 사용할 모의 API */
ajax.mock('/api/menu', () => menu, { delay: 120 });
ajax.mock('/api/layers/*', (info) => {
  const id = decodeURIComponent(info.url.split('/').pop().split('?')[0]);
  return layers[id] || { status: 404, body: { error: '레이어 없음', id } };
}, { delay: 180 });
ajax.mock('/api/data/*', (info) => {
  const id = decodeURIComponent(info.url.split('/').pop().split('?')[0]);
  return dataMap[id] || { status: 404, body: { error: '데이터 없음', id } };
}, { delay: 220 });
ajax.mock('/api/submit', ({ method }) => ({
  ok: true,
  message: `저장되었습니다. (MOCK · ${method})`,
  at: new Date().toISOString(),
}), { method: 'POST', delay: 300 });
ajax.mock('/api/action/*', () => ({ ok: true, message: '액션을 처리했습니다. (MOCK)' }), { method: 'POST', delay: 200 });

const $ = (sel, root = document) => root.querySelector(sel);

function makeOutput(host, { height = 150 } = {}) {
  const pre = h('pre.demo-out', { style: { maxHeight: `${height}px` }, 'aria-live': 'polite' }, '// 이벤트 로그가 여기에 표시됩니다.');
  host.appendChild(pre);
  let count = 0;
  return {
    el: pre,
    log(title, data) {
      count += 1;
      const time = new Date().toLocaleTimeString('ko-KR');
      const body = data === undefined ? '' : (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
      pre.textContent = `[${time}] ${title}${body ? `\n${body}` : ''}`;
      if (count === 1) pre.classList.add('has-log');
      return pre;
    },
    text(value) { count += 1; pre.textContent = value; },
  };
}

function demoButton(label, onClick, { variant = '', title = '' } = {}) {
  const b = h('button.wui-btn.wui-btn-sm', {
    type: 'button',
    class: variant ? `wui-btn-${variant}` : '',
    title,
  }, label);
  b.addEventListener('click', onClick);
  return b;
}

function demoCard(title, description, ...children) {
  return h('section.demo-card', {},
    h('header.demo-card-head', {},
      h('div', {},
        h('h3.demo-card-title', {}, title),
        description ? h('p.demo-card-desc', {}, description) : null)),
    h('div.demo-card-body', {}, children));
}

/* ------------------------------------------------------------------ *
 * 1. 통합 앱 (메뉴 JSON → 레이어 JSON + 데이터 JSON)
 * ------------------------------------------------------------------ */
let appApi = null;
function initApp(host) {
  if (appApi) return;
  const mount = host.querySelector('#app-host') || host;
  appApi = createApp(mount, {
    menuUrl: '/api/menu',
    layerUrl: '/api/layers/{layer}',
    dataUrl: '/api/data/{data}',
    submitUrl: '/api/submit',
    title: 'WUI 스튜디오',
    subtitle: '메뉴 · 레이어 · 데이터',
    logo: 'W',
    hash: false,
    tabs: true,
    skinPanel: true,
  });
}

/* ------------------------------------------------------------------ *
 * 2. 웹 에디터
 * ------------------------------------------------------------------ */
const EDITOR_SAMPLE = `
  <h1>분기 보고서</h1>
  <p>WUI 에디터는 <strong>서식</strong>, <em>표</em>, 이미지 첨부를 지원하는
  <code>contenteditable</code> 기반 편집기입니다.</p>
  <h2>핵심 지표</h2>
  <table>
    <thead><tr><th>항목</th><th>3분기</th><th>4분기</th><th>변화</th></tr></thead>
    <tbody>
      <tr><td>활성 사용자</td><td>12,400</td><td>15,820</td><td>+27.6%</td></tr>
      <tr><td>전환율</td><td>3.2%</td><td>4.1%</td><td>+0.9%p</td></tr>
      <tr><td>평균 응답</td><td>420ms</td><td>280ms</td><td>-33.3%</td></tr>
    </tbody>
  </table>
  <blockquote>표 안에서 행/열을 추가·삭제하고, 이미지를 드래그하거나 붙여넣을 수 있습니다.</blockquote>
  <h3>다음 단계</h3>
  <ul><li>스킨 토큰 확장</li><li>접근성 점검 자동화</li><li>문서 템플릿 추가</li></ul>
`;

function initEditor(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';
  const editorHost = h('div#editor-mount');
  const actions = h('div.demo-toolbar');
  const out = makeOutput(host, { height: 190 });

  const editor = createEditor(editorHost, {
    value: EDITOR_SAMPLE,
    height: 380,
    toolbar: 'full',
    showStatus: true,
    autosave: false,
    onChange: ({ html, text }) => out.log('change', { length: html.length, text: text.slice(0, 40) }),
    onImage: (info) => out.log('image', { name: info.file?.name, size: info.file?.size, srcLength: info.src?.length }),
  });

  actions.append(
    demoButton('샘플 문서', () => { editor.setHTML(EDITOR_SAMPLE); out.log('setHTML', '샘플 문서로 교체'); }),
    demoButton('3×4 표 삽입', () => { editor.insertTable(3, 4, true); out.log('insertTable', { rows: 3, cols: 4 }); }),
    demoButton('이미지 URL 삽입', () => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6fed"/><stop offset="1" stop-color="#22c55e"/></linearGradient></defs><rect width="360" height="120" fill="url(#g)"/><text x="24" y="70" font-family="sans-serif" font-size="22" fill="#fff">WUI Editor</text></svg>`;
      editor.insertImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, { alt: 'WUI 샘플 이미지' });
      out.log('insertImage', 'data URI 이미지 삽입');
    }),
    demoButton('HTML 소스', () => {
      const on = !editorHost.querySelector('.wui-editor')?.classList.contains('is-source');
      editor.setSourceMode(on);
      out.log('sourceMode', on);
    }),
    demoButton('JSON 보기', () => out.log('getData()', editor.getData())),
    demoButton('비우기', () => { if (confirm('에디터 내용을 비울까요?')) { editor.clear(); out.log('clear'); } }, { variant: 'danger' }),
  );

  host.appendChild(actions);
  host.appendChild(editorHost);
  host.appendChild(h('h3.demo-subtitle', {}, '이벤트 / API 결과'));
  host.appendChild(out.el);

  editorHost.addEventListener('click', () => {}, true);
  editor.on('save', (data) => out.log('save', data));
}

/* ------------------------------------------------------------------ *
 * 3. 편집형 그리드
 * ------------------------------------------------------------------ */
const DEMO_TEAMS = [
  { value: 'web', label: '웹' }, { value: 'mobile', label: '모바일' },
  { value: 'design', label: '디자인' }, { value: 'qa', label: 'QA' }, { value: 'ops', label: '운영' },
];
const DEMO_LEVELS = [
  { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }, { value: 'D', label: 'D' },
];
const DEMO_STATUS = [
  { value: 'active', label: '진행' }, { value: 'hold', label: '보류' }, { value: 'done', label: '완료' },
];

function demoRows(count = 500) {
  const names = ['김민준', '이서연', '박도윤', '최지우', '정하준', '강수아', '조은우', '윤지호', '장서준', '임하은', '한예준', '오지안'];
  const roles = ['프론트엔드', '백엔드', '퍼블리셔', '디자이너', 'PM', 'QA'];
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    rows.push({
      name: `${names[i % names.length]}${i > 11 ? ` ${Math.floor(i / 12) + 1}` : ''}`,
      team: DEMO_TEAMS[i % DEMO_TEAMS.length].value,
      role: roles[i % roles.length],
      joined: `202${i % 5}-0${(i % 9) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
      workStart: `${String(8 + (i % 4)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
      updated: `2026-11-${String((i % 16) + 1).padStart(2, '0')}T${String(9 + (i % 9)).padStart(2, '0')}:${String((i * 11) % 60).padStart(2, '0')}`,
      overtime: (i * 3) % 9,
      score: (i * 13) % 101,
      active: i % 13 !== 0,
      level: DEMO_LEVELS[i % DEMO_LEVELS.length].value,
      memo: i % 7 === 0 ? '원격 근무' : '',
      progress: (i * 17) % 101,
      status: DEMO_STATUS[i % DEMO_STATUS.length].value,
    });
  }
  return rows;
}

const DEMO_COLUMNS = [
  { key: 'name', title: '이름', type: 'text', width: 120, frozen: 'left', required: true },
  { key: 'team', title: '팀', type: 'select', width: 104, options: DEMO_TEAMS },
  { key: 'role', title: '직무', type: 'radio', width: 176, options: ['프론트엔드', '백엔드', '퍼블리셔', '디자이너', 'PM', 'QA'] },
  { key: 'joined', title: '입사일', type: 'date', width: 120 },
  { key: 'workStart', title: '출근', type: 'time', width: 90 },
  { key: 'updated', title: '최근 갱신', type: 'datetime', width: 164 },
  { key: 'overtime', title: '야근(h)', type: 'number', width: 84, min: 0, max: 12 },
  { key: 'score', title: '평가 점수', type: 'slider', width: 168, min: 0, max: 100 },
  { key: 'active', title: '재직', type: 'checkbox', width: 66 },
  { key: 'level', title: '등급', type: 'badge', width: 74, options: DEMO_LEVELS, editable: false },
  { key: 'memo', title: '메모', type: 'textarea', width: 180 },
  {
    key: 'progress', title: '진행률', type: 'custom', width: 150,
    render: ({ value }) => h('div.demo-progress', { title: `${value}%` },
      h('div.demo-progress-track', {}, h('div.demo-progress-bar', { style: { width: `${value}%` } })),
      h('span.demo-progress-text', {}, `${value}%`)),
  },
  { key: 'status', title: '상태', type: 'select', width: 104, options: DEMO_STATUS, frozen: 'right' },
];

function initGrid(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';
  const gridHost = h('div#grid-mount');
  const actions = h('div.demo-toolbar');
  const out = makeOutput(host, { height: 170 });

  const grid = createGrid(gridHost, {
    columns: DEMO_COLUMNS,
    data: demoRows(500),
    height: 430,
    filterRow: true,
    search: true,
    footer: true,
    virtual: true,
    zebra: true,
    title: '구성원 500명 (가상 스크롤)',
    onChange: (p) => out.log('change', { key: p.key, value: p.value, row: p.row.name }),
    onSelect: ({ count }) => out.log('select', { count }),
  });

  actions.append(
    demoButton('+ 1,000행', () => {
      const rows = demoRows(1000).map((r, i) => ({ ...r, name: `추가 ${i + 1}` }));
      grid.setData([...grid.getData(), ...rows]);
      out.log('setData', { count: grid.getData().length });
    }),
    demoButton('이름순 정렬', () => { grid.setSort('name', 'asc'); out.log('setSort', { key: 'name', dir: 'asc' }); }),
    demoButton('팀 열 왼쪽 고정', () => { grid.setFrozen('team', 'left'); out.log('setFrozen', 'team → left'); }),
    demoButton('상태 열 오른쪽 고정 해제', () => { grid.setFrozen('status', null); out.log('setFrozen', 'status → none'); }),
    demoButton('검증', () => {
      const errors = grid.validate();
      out.log('validate', { errorCount: errors.length, errors: errors.slice(0, 3) });
    }),
    demoButton('변경 내역', () => out.log('getChanges', grid.getChanges())),
    demoButton('CSV', () => { grid.downloadCSV('wui-grid.csv'); out.log('downloadCSV', 'wui-grid.csv'); }),
    demoButton('100번째 행으로', () => { grid.scrollToIndex(99); out.log('scrollToIndex', 99); }),
  );

  host.appendChild(actions);
  host.appendChild(gridHost);
  host.appendChild(h('h3.demo-subtitle', {}, '이벤트 / API 결과'));
  host.appendChild(out.el);
}

/* ------------------------------------------------------------------ *
 * 4. 트리
 * ------------------------------------------------------------------ */
function initTree(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';
  const treeHost = h('div#tree-mount');
  const actions = h('div.demo-toolbar');
  const out = makeOutput(host, { height: 170 });

  const tree = createTree(treeHost, {
    data: DEPARTMENT_TREE,
    checkable: true,
    cascade: true,
    showSearch: true,
    showActions: true,
    defaultExpandLevel: 2,
    onCheck: () => out.log('check', tree.getChecked({ ids: true })),
    onSelect: (node) => out.log('select', node.label),
  });

  let added = 0;
  actions.append(
    demoButton('선택 값', () => out.log('getChecked({ids:true})', tree.getChecked({ ids: true }))),
    demoButton('모두 펼치기', () => tree.expandAll()),
    demoButton('모두 접기', () => tree.collapseAll()),
    demoButton('웹팀 체크', () => { tree.setChecked('dev-web', true); out.log('setChecked', 'dev-web'); }),
    demoButton('QA팀 추가', () => {
      added += 1;
      tree.addNode('dev', { id: `dev-extra-${added}`, label: `신규팀 ${added}`, icon: '✨' }, 0);
      tree.expand('dev', true);
      out.log('addNode', `dev/신규팀 ${added}`);
    }),
    demoButton('노드 이름 변경', () => {
      tree.updateNode('dev-web', { label: '웹플랫폼팀 (개편)' });
      out.log('updateNode', 'dev-web');
    }),
    demoButton('체크 초기화', () => { tree.setCheckAll(false); out.log('setCheckAll', false); }),
  );

  host.appendChild(actions);
  host.appendChild(treeHost);
  host.appendChild(h('h3.demo-subtitle', {}, '이벤트 / API 결과'));
  host.appendChild(out.el);
}

/* ------------------------------------------------------------------ *
 * 5. 트리 · 그리드 (레이어 JSON 예제)
 * ------------------------------------------------------------------ */
function initTreeGrid(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';
  const mount = h('div#tree-grid-mount');
  const actions = h('div.demo-toolbar');
  const out = makeOutput(host, { height: 180 });
  const layer = layers['tree-grid'];
  const data = dataMap['tree-grid'] || { values: {}, trees: {}, grids: {} };

  const form = createLayout(mount, layer, {
    values: data.values || {},
    data,
    onChange: ({ name, value }) => out.log('change', { name, value }),
    onSubmit: (payload) => out.log('submit', payload.values),
    onAction: (payload) => {
      if (payload.action === 'json') {
        WUI.util.download('tree-grid-values.json', JSON.stringify(payload.values, null, 2));
        out.log('action:json', payload.values);
      } else {
        out.log(`action:${payload.action}`, payload.values);
      }
    },
  });

  actions.append(
    demoButton('값 수집', () => out.log('getValues()', form.getValues())),
    demoButton('검증', () => out.log('validate()', form.validate())),
    demoButton('그리드 변경 내역', () => {
      const board = form.getControl('workboard');
      const grid = board && (board.grid || board);
      out.log('getChanges', grid && isFn(grid.getChanges) ? grid.getChanges() : []);
    }),
    demoButton('데이터 재적용', () => {
      form.applyData(dataMap['tree-grid'] || {});
      out.log('applyData', '완료');
    }),
  );

  host.appendChild(actions);
  host.appendChild(mount);
  host.appendChild(h('h3.demo-subtitle', {}, '이벤트 / API 결과'));
  host.appendChild(out.el);
}

/* ------------------------------------------------------------------ *
 * 6. JSON 화면 배치
 * ------------------------------------------------------------------ */
const LAYOUT_SCHEMA = {
  title: '프로젝트 등록',
  description: '이 화면은 아래 JSON 스키마만으로 렌더링됩니다. (flow 12컬럼)',
  actions: [
    { label: '값 보기', action: 'json', variant: 'ghost' },
    { label: '초기화', action: 'reset' },
    { label: '검증 후 제출', action: 'submit', variant: 'primary' },
  ],
  groups: [
    {
      id: 'base', title: '프로젝트 정보', description: '필수값 · 형식 검증 · 조건부 필드',
      items: [
        { name: 'projectName', label: '프로젝트명', type: 'text', span: 5, required: true, value: 'WUI 디자인 시스템' },
        { name: 'owner', label: '담당자', type: 'select', span: 3, options: [{ value: 'kim', label: '김민준' }, { value: 'lee', label: '이서연' }, { value: 'park', label: '박도윤' }], value: 'kim' },
        { name: 'dueDate', label: '완료 예정일', type: 'date', span: 2, value: '2026-12-20' },
        { name: 'progress', label: '진행률', type: 'range', span: 2, value: 35, unit: '%' },
        { name: 'scope', label: '적용 범위', type: 'checkbox-group', span: 12, options: [
          { value: 'editor', label: '에디터' }, { value: 'grid', label: '그리드' }, { value: 'layout', label: '레이아웃' }, { value: 'skin', label: '스킨' },
        ], value: ['grid', 'layout'] },
        { name: 'urgent', label: '긴급', type: 'switch', span: 3 },
        { name: 'urgentReason', label: '긴급 사유', type: 'text', span: 9, required: true, placeholder: '긴급으로 지정한 이유', visibleWhen: { field: 'urgent', op: 'truthy' } },
        { name: 'summary', label: '요약', type: 'textarea', span: 12, rows: 2, value: 'JSON 스키마로 화면을 구성하는 예제입니다.' },
      ],
    },
    {
      id: 'members', title: '참여 조직과 작업', description: '트리 + 그리드 컨트롤을 한 레이아웃에 배치',
      items: [
        { name: 'members', label: '참여 조직', type: 'tree', span: 5, dataKey: 'members', expandLevel: 2 },
        {
          name: 'tasks', label: '작업 목록', type: 'grid', span: 7, dataKey: 'tasks', height: 250, search: false,
          columns: [
            { key: 'task', title: '작업', width: 180, required: true },
            { key: 'owner', title: '담당', width: 90 },
            { key: 'due', title: '기한', type: 'date', width: 120 },
            { key: 'done', title: '완료', type: 'checkbox', width: 64 },
          ],
        },
      ],
    },
  ],
};

const ABSOLUTE_SCHEMA = {
  title: '절대 위치 배치 (mode: absolute)',
  description: 'pos { x, y, w, h } 로 12컬럼 × 행 그리드에 고정 배치합니다.',
  mode: 'absolute',
  rowHeight: 44,
  groups: [
    {
      id: 'abs',
      items: [
        { name: 'a1', label: '프로젝트명', type: 'text', span: 6, pos: { x: 1, y: 1, w: 6, h: 1 }, value: '절대 배치' },
        { name: 'a2', label: '담당자', type: 'select', span: 3, pos: { x: 7, y: 1, w: 3, h: 1 }, options: ['김민준', '이서연'], value: '이서연' },
        { name: 'a3', label: '상태', type: 'select', span: 3, pos: { x: 10, y: 1, w: 3, h: 1 }, options: ['준비', '진행', '완료'], value: '진행' },
        { name: 'a4', label: '설명', type: 'textarea', span: 12, pos: { x: 1, y: 2, w: 8, h: 2 }, value: 'x/y/w/h 좌표로 컨트롤을 배치합니다.' },
        { name: 'a5', label: '진행률', type: 'range', span: 4, pos: { x: 9, y: 2, w: 4, h: 1 }, value: 70, unit: '%' },
        { name: 'a6', label: '알림', type: 'switch', span: 4, pos: { x: 9, y: 3, w: 4, h: 1 }, value: true },
      ],
    },
  ],
};

function layoutData() {
  const rows = [
    { task: '공통 토큰 정리', owner: '김민준', due: '2026-11-20', done: true },
    { task: '그리드 고정 열 점검', owner: '이서연', due: '2026-11-22', done: false },
    { task: '레이아웃 JSON 문서', owner: '박도윤', due: '2026-11-25', done: false },
    { task: '스킨 갤러리 시안', owner: '최지우', due: '2026-11-27', done: false },
  ];
  return {
    values: { projectName: 'WUI 디자인 시스템', owner: 'kim', dueDate: '2026-12-20', progress: 35, scope: ['grid', 'layout'], summary: 'JSON 스키마로 화면을 구성하는 예제입니다.' },
    grids: { tasks: rows },
    trees: { members: DEPARTMENT_TREE },
  };
}

function initLayout(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';
  const mount = h('div#layout-mount');
  const actions = h('div.demo-toolbar');
  const out = makeOutput(host, { height: 190 });
  const data = layoutData();
  let absolute = false;

  const form = createLayout(mount, LAYOUT_SCHEMA, {
    values: data.values,
    data,
    onChange: ({ name, value }) => out.log('change', { name, value }),
    onSubmit: (payload) => out.log('submit', payload.values),
    onAction: (payload) => {
      if (payload.action === 'json') {
        WUI.util.download('layout-values.json', JSON.stringify(payload.values, null, 2));
        out.log('action:json', payload.values);
      } else if (payload.action === 'submit') {
        out.log('action:submit', payload.values);
      } else {
        out.log(`action:${payload.action}`, payload.values);
      }
    },
  });

  actions.append(
    demoButton('값 수집', () => out.log('getValues()', form.getValues())),
    demoButton('검증', () => out.log('validate()', form.validate())),
    demoButton('submit()', () => out.log('submit()', form.submit())),
    demoButton('절대 배치로 전환', () => {
      absolute = !absolute;
      const values = form.getValues();
      form.setSchema(absolute ? ABSOLUTE_SCHEMA : LAYOUT_SCHEMA, { values: absolute ? {} : values });
      out.log('setSchema', absolute ? 'absolute' : 'flow');
    }),
    demoButton('데이터 다시 적용', () => { form.applyData(layoutData()); out.log('applyData', '완료'); }),
    demoButton('스키마 JSON', () => out.log('schema', form.getSchema())),
  );

  host.appendChild(actions);
  host.appendChild(mount);
  host.appendChild(h('h3.demo-subtitle', {}, '이벤트 / API 결과'));
  host.appendChild(out.el);
}

/* ------------------------------------------------------------------ *
 * 7. 스킨
 * ------------------------------------------------------------------ */
function initSkin(host) {
  if (host.dataset.ready) return;
  host.dataset.ready = '1';

  const themeGrid = h('div.demo-themegrid');
  const shapeRow = h('div.demo-toolbar');
  const densityRow = h('div.demo-toolbar');
  const stateOut = makeOutput(host, { height: 170 });
  const preview = h('div.demo-preview', {});

  const themeButtons = new Map();
  for (const theme of skin.listThemes()) {
    const b = h('button.demo-themecard', { type: 'button', 'data-theme': theme.name },
      h('span.demo-themedot', { style: { background: theme.color } }),
      h('span', {}, theme.label),
      theme.dark ? h('span.wui-badge.wui-badge-muted', {}, 'dark') : null);
    b.addEventListener('click', () => {
      skin.setTheme(theme.name);
      stateOut.log('setTheme', theme.name);
    });
    themeButtons.set(theme.name, b);
    themeGrid.appendChild(b);
  }

  const shapeButtons = new Map();
  for (const shape of skin.listShapes()) {
    const b = demoButton(shape.label, () => {
      skin.setShape(shape.name);
      stateOut.log('setShape', shape.name);
    });
    shapeButtons.set(shape.name, b);
    shapeRow.appendChild(b);
  }
  const radius = h('input', { type: 'range', min: 0, max: 24, step: 1, value: 6, 'aria-label': '모서리 반경' });
  radius.addEventListener('input', () => {
    skin.setShape({ radius: Number(radius.value) });
    stateOut.log('setShape({radius})', Number(radius.value));
  });
  shapeRow.appendChild(h('label.demo-inline', {}, h('span', {}, '모서리'), radius));
  const borderCheck = h('input', { type: 'checkbox', checked: true });
  borderCheck.addEventListener('change', () => {
    skin.toggleBorders(borderCheck.checked);
    stateOut.log('toggleBorders', borderCheck.checked);
  });
  shapeRow.appendChild(h('label.demo-inline', {}, borderCheck, h('span', {}, '테두리')));

  const densityButtons = new Map();
  for (const density of skin.listDensities()) {
    const b = demoButton(density.label, () => {
      skin.setDensity(density.name);
      stateOut.log('setDensity', density.name);
    });
    densityButtons.set(density.name, b);
    densityRow.appendChild(b);
  }
  densityRow.appendChild(demoButton('기본값으로', () => {
    skin.reset();
    stateOut.log('reset', skin.current());
  }, { variant: 'ghost' }));

  /* 미리보기 */
  preview.append(
    h('h4', {}, '미리보기'),
    h('div.wui-flex', {},
      h('button.wui-btn', { type: 'button' }, '버튼'),
      h('button.wui-btn.wui-btn-primary', { type: 'button' }, '주요 버튼'),
      h('button.wui-btn.wui-btn-danger', { type: 'button' }, '삭제')),
    h('div.demo-preview-row', {},
      h('input.wui-input', { placeholder: '텍스트 입력' }),
      h('select.wui-select', {}, h('option', {}, '선택 1'), h('option', {}, '선택 2'))),
    h('div.demo-preview-row', {},
      h('label.wui-check', {}, h('input', { type: 'checkbox', checked: true }), '체크박스'),
      h('label.wui-radio', {}, h('input', { type: 'radio', checked: true }), '라디오'),
      h('label.wui-switch', {}, h('input', { type: 'checkbox', checked: true }), '스위치'),
      h('span.wui-badge', {}, '배지'),
      h('span.wui-badge.wui-badge-success', {}, '성공')),
    h('div.wui-alert.wui-alert-info', {}, '스킨은 CSS 변수 · data 속성으로 적용됩니다.'),
    h('table.demo-table', {},
      h('thead', {}, h('tr', {}, h('th', {}, '이름'), h('th', {}, '상태'), h('th', {}, '금액'))),
      h('tbody', {},
        h('tr', {}, h('td', {}, '김민준'), h('td', {}, h('span.wui-badge.wui-badge-success', {}, '완료')), h('td', { class: 'is-right' }, '₩120,000')),
        h('tr', {}, h('td', {}, '이서연'), h('td', {}, h('span.wui-badge.wui-badge-warn', {}, '진행')), h('td', { class: 'is-right' }, '₩88,000')))),
  );

  function sync() {
    const cur = skin.current();
    themeButtons.forEach((b, name) => b.classList.toggle('is-active', cur.theme === name));
    shapeButtons.forEach((b, name) => b.classList.toggle('is-active', cur.shape === name));
    densityButtons.forEach((b, name) => b.classList.toggle('is-active', cur.density === name));
    borderCheck.checked = cur.borders;
    radius.value = cur.overrides.radius ?? 6;
  }
  skin.onChange(sync);
  sync();

  host.appendChild(demoCard('색상 테마', '10가지 테마. 다크 테마는 배경/표면 색상까지 전환됩니다.', themeGrid));
  host.appendChild(demoCard('모양', '모서리 반경과 테두리 두께를 즉시 조정합니다.', shapeRow));
  host.appendChild(demoCard('밀도', '컨트롤 높이 · 행 높이 · 글자 크기 프리셋.', densityRow));
  host.appendChild(demoCard('적용 결과', '버튼/입력/배지/알림/표에 스킨이 반영됩니다.', preview));
  host.appendChild(h('h3.demo-subtitle', {}, '스킨 API 결과'));
  host.appendChild(stateOut.el);
  stateOut.log('skin.current()', skin.current());
}

/* ------------------------------------------------------------------ *
 * 7. 뷰 전환 / 초기화
 * ------------------------------------------------------------------ */
const VIEWS = {
  app: initApp,
  editor: initEditor,
  grid: initGrid,
  tree: initTree,
  'tree-grid': initTreeGrid,
  layout: initLayout,
  skin: initSkin,
};

const initialized = new Set();

function showView(name, { updateHash = true } = {}) {
  const view = VIEWS[name] ? name : 'app';
  document.querySelectorAll('.demo-view').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.view === view);
  });
  document.querySelectorAll('.demo-navbtn').forEach((el) => {
    const on = el.dataset.view === view;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', String(on));
  });
  if (!initialized.has(view)) {
    initialized.add(view);
    try { VIEWS[view](document.querySelector(`.demo-view[data-view="${view}"]`)); }
    catch (err) {
      console.error('[demo]', view, err);
      const host = document.querySelector(`.demo-view[data-view="${view}"]`);
      if (host) host.prepend(h('div.wui-alert.wui-alert-danger', {}, `초기화 실패: ${err.message}`));
    }
  }
  if (updateHash && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  document.querySelector('.demo-main')?.scrollTo(0, 0);
}

document.querySelectorAll('.demo-navbtn').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});
window.addEventListener('hashchange', () => showView((location.hash || '#app').slice(1), { updateHash: false }));

const resetSkin = $('#demo-skin-reset');
if (resetSkin) resetSkin.addEventListener('click', () => skin.reset());

showView((location.hash || '#app').slice(1));

/* 문서 링크가 DOC/ 로 이동하므로 현재 페이지 유지 */
console.info('[WUI demo]', WUI.VERSION, 'mock:', ajax.listMocks().length, '개');
