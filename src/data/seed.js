/*!
 * WUI - data/seed.js
 * 데모 데이터의 단일 소스.
 * - 서버(serve.mjs)와 빌드 스크립트(tools/build-data.mjs)가 이 파일을 읽어 JSON 을 생성한다.
 * - file:// 로 index.html 을 열어도 동작하도록 demo.js 가 이 데이터를 AJAX mock 으로 등록한다.
 */

/* ------------------------------- 공통 데이터 ------------------------------- */
const PRODUCTS = [
  '27인치 모니터', '기계식 키보드', '무선 마우스', 'USB-C 허브', '노트북 거치대',
  '웹캠 프로', '블루투스 스피커', '외장 SSD 1TB', '모니터 암', '데스크 매트',
];
const CUSTOMERS = [
  '김민준', '이서연', '박도윤', '최지우', '정하준', '강수아', '조은우', '윤지호',
  '장서준', '임하은', '한예준', '오지안', '서시우', '신아윤', '권유준', '황채원',
];
const CHANNELS = [
  { value: 'web', label: '웹' },
  { value: 'mobile', label: '모바일' },
  { value: 'partner', label: '제휴' },
  { value: 'offline', label: '오프라인' },
];
const STATUS = [
  { value: 'ready', label: '준비' },
  { value: 'shipping', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'hold', label: '보류' },
];

export function makeOrders(count = 80) {
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const qty = (i * 7) % 9 + 1;
    const unitPrice = 12000 + ((i * 3700) % 28) * 5000;
    const day = (i % 15) + 1;
    const hour = 8 + (i % 10);
    const minute = (i * 13) % 60;
    rows.push({
      orderNo: `ORD-2026-${String(1040 + i).padStart(4, '0')}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      channel: CHANNELS[i % CHANNELS.length].value,
      product: PRODUCTS[i % PRODUCTS.length],
      qty,
      unitPrice,
      amount: qty * unitPrice,
      orderedAt: `2026-11-${String(day).padStart(2, '0')}`,
      shipTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      urgent: i % 11 === 0,
      status: STATUS[i % STATUS.length].value,
      memo: i % 5 === 0 ? '오전 중 배송 요청' : '',
    });
  }
  return rows;
}

export const ORDERS_COLUMNS = [
  { key: 'orderNo', title: '주문번호', type: 'text', width: 126, frozen: 'left', required: true },
  { key: 'customer', title: '고객명', type: 'text', width: 92 },
  { key: 'channel', title: '채널', type: 'select', width: 96, options: CHANNELS },
  { key: 'product', title: '상품', type: 'text', width: 168 },
  { key: 'qty', title: '수량', type: 'number', width: 70, min: 1, max: 99 },
  { key: 'unitPrice', title: '단가', type: 'number', width: 100 },
  { key: 'amount', title: '금액', type: 'number', width: 116, editable: false },
  { key: 'orderedAt', title: '주문일', type: 'date', width: 112 },
  { key: 'shipTime', title: '출고시간', type: 'time', width: 92 },
  { key: 'urgent', title: '긴급', type: 'checkbox', width: 66 },
  { key: 'status', title: '상태', type: 'badge', width: 84, options: STATUS, editable: false, frozen: 'right' },
  { key: 'memo', title: '메모', type: 'text', width: 200 },
];

export const DEPARTMENT_TREE = [
  {
    id: 'company', label: 'WUI 주식회사', icon: '🏢', expanded: true, children: [
      {
        id: 'dev', label: '개발본부', icon: '⌨️', children: [
          { id: 'dev-web', label: '웹플랫폼팀', icon: '🌐' },
          { id: 'dev-mobile', label: '모바일팀', icon: '📱' },
          { id: 'dev-qa', label: '품질관리팀', icon: '🧪' },
        ],
      },
      {
        id: 'design', label: '디자인센터', icon: '🎨', children: [
          { id: 'design-ui', label: 'UI팀', icon: '✏️' },
          { id: 'design-brand', label: '브랜드팀', icon: '🖌️' },
        ],
      },
      {
        id: 'business', label: '사업본부', icon: '📈', children: [
          { id: 'biz-sales', label: '영업1팀', icon: '🤝' },
          { id: 'biz-cs', label: '고객지원팀', icon: '🎧' },
        ],
      },
    ],
  },
];

/* ------------------------------- 메뉴 ------------------------------- */
export const menu = {
  title: 'WUI 스튜디오',
  subtitle: '바닐라 JS 웹 UI 키트',
  items: [
    { id: 'dashboard', label: '대시보드', icon: '▦', badge: 'Grid' },
    { id: 'tree-grid', label: '트리·그리드', icon: '⊞', badge: 'New' },
    { id: 'order-form', label: '주문 입력', icon: '✎' },
    { id: 'approval', label: '결재 문서', icon: '◫', badge: 'Editor' },
    { id: 'org', label: '조직도', icon: '⌘', data: false, badge: 'Tree' },
    {
      id: 'settings', label: '설정', icon: '⚙', children: [
        { id: 'settings-general', label: '일반 설정', icon: '·' },
        { id: 'settings-skin', label: '스킨 갤러리', icon: '◐' },
      ],
    },
  ],
};

/* ------------------------------- 레이어 ------------------------------- */
const dashboardLayer = {
  title: '운영 대시보드',
  description: '그리드/트리 컨트롤이 JSON 레이어 안에서 어떻게 조합되는지 보여줍니다.',
  actions: [
    { label: '입력값 JSON', action: 'json', variant: 'ghost' },
    { label: '새로고침', action: 'reload' },
  ],
  groups: [
    {
      id: 'kpi',
      items: [
        {
          type: 'html',
          span: 12,
          html: `
            <div class="wui-kpis">
              <div class="wui-kpi"><span class="wui-kpi-label">오늘 주문</span><strong>1,284</strong><span class="wui-kpi-diff is-up">▲ 12.4%</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">매출</span><strong>₩48.2M</strong><span class="wui-kpi-diff is-up">▲ 8.1%</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">배송 대기</span><strong>37</strong><span class="wui-kpi-diff is-down">▼ 4.2%</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">긴급 건</span><strong>6</strong><span class="wui-kpi-diff">오전 처리</span></div>
            </div>`,
        },
      ],
    },
    {
      id: 'orders',
      title: '주문 목록',
      description: '왼쪽 주문번호·오른쪽 상태 열 고정, 가상 스크롤, 정렬, 필터 행, 인라인 편집.',
      aside: '데이터: /api/data/dashboard',
      items: [
        {
          type: 'grid',
          name: 'orders',
          span: 12,
          height: 380,
          dataKey: 'orders',
          filterRow: true,
          search: true,
          title: '주문',
          columns: ORDERS_COLUMNS,
        },
      ],
    },
    {
      id: 'org',
      title: '담당 조직',
      description: '트라이스테이트 체크 + 검색 + 지연 로딩 없이 JSON 트리 렌더.',
      items: [
        { type: 'tree', name: 'departments', span: 5, dataKey: 'departments', checkable: true, cascade: true, expandLevel: 2 },
        {
          type: 'html',
          span: 7,
          html: `<div class="wui-note">
            <strong>트리 선택 값</strong>
            <p>체크한 조직 ID 배열이 폼 값 <code>departments</code> 로 수집됩니다. 왼쪽 그리드와 같은 데이터 JSON 안에서 <code>trees.departments</code> 로 전달됩니다.</p>
            <pre class="wui-pre">"departments": ["dev-web", "design-ui"]</pre>
          </div>`,
        },
      ],
    },
  ],
};

const orderFormLayer = {
  title: '주문 입력',
  description: '12컬럼 flow 배치, 조건부 표시, 검증, 액션 버튼.',
  actions: [
    { label: '임시 저장(JSON)', action: 'json', variant: 'ghost' },
    { label: '초기화', action: 'reset' },
    { label: '저장', action: 'submit', variant: 'primary' },
  ],
  groups: [
    {
      id: 'basic',
      title: '주문 정보',
      description: '필수값과 형식 검증이 적용됩니다.',
      items: [
        { name: 'orderNo', label: '주문번호', type: 'text', span: 4, required: true, placeholder: 'ORD-2026-0000' },
        { name: 'orderedAt', label: '주문일', type: 'date', span: 4, required: true },
        { name: 'status', label: '상태', type: 'select', span: 4, options: STATUS, placeholder: '선택하세요' },
        { name: 'customer', label: '고객명', type: 'text', span: 4, required: true },
        { name: 'phone', label: '연락처', type: 'text', span: 4, placeholder: '010-0000-0000', rules: [{ type: 'pattern', value: '^01[0-9]-?\\d{3,4}-?\\d{4}$', message: '휴대폰 번호 형식이 아닙니다.' }] },
        { name: 'email', label: '이메일', type: 'email', span: 4, rules: ['email'] },
        { name: 'channel', label: '유입 채널', type: 'radio', span: 4, options: CHANNELS, value: 'web' },
        { name: 'urgent', label: '긴급 주문', type: 'switch', span: 4, help: '켜면 긴급 사유를 입력해야 합니다.' },
        { name: 'priority', label: '우선순위', type: 'range', span: 4, min: 0, max: 10, value: 5, unit: '점' },
        { name: 'urgentReason', label: '긴급 사유', type: 'text', span: 12, placeholder: '예: 고객 요청으로 당일 출고', required: true, visibleWhen: { field: 'urgent', op: 'truthy' } },
      ],
    },
    {
      id: 'shipping',
      title: '배송 정보',
      items: [
        { name: 'address', label: '주소', type: 'text', span: 8, required: true },
        { name: 'postcode', label: '우편번호', type: 'text', span: 4, rules: [{ type: 'pattern', value: '^\\d{5}$', message: '5자리 우편번호를 입력하세요.' }] },
        { name: 'memo', label: '요청사항', type: 'textarea', span: 12, rows: 3, placeholder: '배송 요청사항' },
        { name: 'options', label: '부가 옵션', type: 'checkbox-group', span: 12, options: [
          { value: 'gift', label: '선물 포장' },
          { value: 'invoice', label: '세금계산서' },
          { value: 'insurance', label: '배송 보험' },
        ] },
      ],
    },
  ],
};

const approvalLayer = {
  title: '결재 문서 작성',
  description: '웹 에디터(서식·표·이미지) + 첨부 파일 + 결재선 트리.',
  actions: [
    { label: '미리보기', action: 'preview', variant: 'ghost' },
    { label: '상신', action: 'submit', variant: 'primary' },
  ],
  groups: [
    {
      id: 'doc',
      title: '문서',
      items: [
        { name: 'title', label: '제목', type: 'text', span: 8, required: true, placeholder: '문서 제목' },
        { name: 'docType', label: '문서 종류', type: 'select', span: 4, options: [
          { value: 'report', label: '보고서' }, { value: 'request', label: '요청서' }, { value: 'plan', label: '계획서' },
        ] },
        { name: 'content', label: '본문', type: 'editor', span: 12, height: 320, placeholder: '표·이미지·서식을 사용해 문서를 작성하세요.' },
        { name: 'attach', label: '첨부 파일', type: 'file', span: 6, multiple: true, hint: '파일을 선택하면 목록에 표시됩니다.' },
        { name: 'cover', label: '대표 이미지', type: 'image', span: 6 },
        { name: 'approvers', label: '결재선', type: 'tree', span: 6, dataKey: 'approvers', expandLevel: 1 },
        { name: 'keep', label: '보관 기간', type: 'select', span: 6, options: ['1년', '3년', '5년', '영구'], value: '3년' },
      ],
    },
  ],
};

const orgLayer = {
  title: '조직도',
  description: '이 메뉴는 menu.data=false 로 데이터 AJAX 요청을 생략합니다. 트리 데이터는 레이어 안에 포함됩니다.',
  groups: [
    {
      id: 'org',
      title: '전체 조직',
      items: [
        {
          type: 'tree',
          name: 'org',
          span: 7,
          checkable: true,
          cascade: true,
          expandLevel: -1,
          data: DEPARTMENT_TREE,
        },
        {
          type: 'html',
          span: 5,
          html: `<div class="wui-note">
            <strong>레이어에 포함된 데이터</strong>
            <p><code>menu.data === false</code> 이면 <code>/api/data/org</code> 요청을 보내지 않습니다. 레이어 JSON 안의 <code>items[].data</code> 만으로 트리를 구성합니다.</p>
            <p>AJAX 로그에서 이 메뉴를 열면 레이어 요청 1건만 기록됩니다.</p>
          </div>`,
        },
      ],
    },
  ],
};

const settingsGeneralLayer = {
  title: '일반 설정',
  description: '세부 입력 컨트롤 모음 (날짜/시간/숫자/체크박스/사용자 정의).',
  submitUrl: '/api/submit',
  actions: [{ label: '기본값', action: 'reset' }, { label: '저장', action: 'submit', variant: 'primary' }],
  groups: [
    {
      id: 'general',
      title: '사이트',
      items: [
        { name: 'siteName', label: '사이트 이름', type: 'text', span: 6, required: true },
        { name: 'timezone', label: '시간대', type: 'select', span: 3, options: ['Asia/Seoul', 'UTC', 'Asia/Tokyo'], value: 'Asia/Seoul' },
        { name: 'locale', label: '언어', type: 'select', span: 3, options: [
          { value: 'ko', label: '한국어' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' },
        ], value: 'ko' },
        { name: 'openAt', label: '오픈 일시', type: 'datetime', span: 4 },
        { name: 'dailyAt', label: '일일 점검 시간', type: 'time', span: 4, value: '03:30' },
        { name: 'maxRows', label: '최대 행 수', type: 'number', span: 4, min: 10, max: 10000, value: 500 },
        { name: 'notify', label: '알림 사용', type: 'checkbox', span: 3, value: true },
        { name: 'maintenance', label: '점검 모드', type: 'switch', span: 3 },
        { name: 'themeColor', label: '대표 색상', type: 'color', span: 3, value: '#2f6fed' },
        { name: 'retention', label: '보관 기간', type: 'select', span: 3, options: ['30일', '90일', '1년'], value: '90일' },
        { name: 'memo', label: '운영 메모', type: 'textarea', span: 12, rows: 3, value: '매주 월요일 오전에 점검합니다.' },
      ],
    },
    {
      id: 'actions-demo',
      title: '버튼 액션',
      description: 'type:"button" 은 폼 값을 유지한 채 action 이벤트만 발생시킵니다.',
      items: [
        { type: 'button', name: 'btn-json', span: 3, text: '값 JSON 내려받기', action: 'json' },
        { type: 'button', name: 'btn-log', span: 3, text: 'AJAX 로그 열기', action: 'log' },
        { type: 'spacer', span: 6 },
      ],
    },
  ],
};

const themeButtons = [
  ['blue', '블루'], ['indigo', '인디고'], ['green', '그린'], ['teal', '틸'], ['purple', '퍼플'],
  ['orange', '오렌지'], ['red', '레드'], ['slate', '슬레이트'], ['dark', '다크'], ['midnight', '미드나잇'],
];

const treeGridLayer = {
  title: '조직·업무 트리 그리드',
  description: '좌측 조직 트리와 우측 편집형 그리드를 한 화면에 배치한 예제입니다. 그리드의 수정/추가 상태(statusColumn)와 트리 체크 값을 함께 수집합니다.',
  actions: [
    { label: '값 JSON', action: 'json', variant: 'ghost' },
    { label: '초기화', action: 'reset' },
    { label: '저장', action: 'submit', variant: 'primary' },
  ],
  groups: [
    {
      id: 'intro',
      items: [
        {
          type: 'html',
          span: 12,
          html: `
            <div class="wui-kpis">
              <div class="wui-kpi"><span class="wui-kpi-label">담당 조직</span><strong>3개 팀</strong><span class="wui-kpi-diff is-up">트리 체크 연동</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">진행 업무</span><strong>8건</strong><span class="wui-kpi-diff">그리드 편집</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">수정 표시</span><strong>ON</strong><span class="wui-kpi-diff is-up">추가/수정 배지</span></div>
              <div class="wui-kpi"><span class="wui-kpi-label">저장 형식</span><strong>JSON</strong><span class="wui-kpi-diff">{ tree, grid }</span></div>
            </div>`,
        },
      ],
    },
    {
      id: 'board',
      title: '업무 배정 보드',
      description: '왼쪽에서 조직을 선택(체크)하고, 오른쪽 그리드에서 업무를 편집하세요. 행을 수정하거나 추가하면 상태 열에 표시됩니다.',
      aside: '레이어: /api/layers/tree-grid · 데이터: /api/data/tree-grid',
      items: [
        {
          type: 'tree-grid',
          name: 'workboard',
          span: 12,
          treeKey: 'departments',
          gridKey: 'tasks',
          treeWidth: 300,
          height: 360,
          gridTitle: '업무 목록',
          filterRow: true,
          statusColumn: true,
          search: true,
          columns: [
            { key: 'task', title: '업무명', type: 'text', width: 220, required: true, frozen: 'left' },
            { key: 'owner', title: '담당자', type: 'text', width: 110 },
            { key: 'dept', title: '조직', type: 'select', width: 120, options: [
              { value: 'dev-web', label: '웹플랫폼팀' },
              { value: 'dev-mobile', label: '모바일팀' },
              { value: 'dev-qa', label: '품질관리팀' },
              { value: 'design-ui', label: 'UI팀' },
              { value: 'design-brand', label: '브랜드팀' },
              { value: 'biz-sales', label: '영업1팀' },
              { value: 'biz-cs', label: '고객지원팀' },
            ] },
            { key: 'due', title: '마감일', type: 'date', width: 120 },
            { key: 'priority', title: '우선순위', type: 'select', width: 100, options: [
              { value: 'high', label: '높음' },
              { value: 'normal', label: '보통' },
              { value: 'low', label: '낮음' },
            ] },
            { key: 'progress', title: '진행률', type: 'slider', width: 160, min: 0, max: 100 },
            { key: 'done', title: '완료', type: 'checkbox', width: 70 },
            { key: 'note', title: '비고', type: 'text', width: 220 },
          ],
        },
      ],
    },
    {
      id: 'guide',
      title: '화면 구성 안내',
      items: [
        {
          type: 'html',
          span: 6,
          html: `<div class="wui-note">
            <strong>레이어 JSON 구성 (type: "tree-grid")</strong>
            <p>트리와 그리드를 하나의 컨트롤로 배치합니다. 데이터는 <code>data.trees[treeKey]</code>, <code>data.grids[gridKey]</code>에서 로드합니다.</p>
            <pre class="wui-pre">{
  "type": "tree-grid",
  "name": "workboard",
  "treeKey": "departments",
  "gridKey": "tasks",
  "statusColumn": true,
  "columns": [ ... ]
}</pre>
          </div>`,
        },
        {
          type: 'html',
          span: 6,
          html: `<div class="wui-note">
            <strong>수집 값 / 수정 여부</strong>
            <p>폼 값은 <code>{ tree: [체크된 노드 id], grid: [행 데이터] }</code> 형태로 수집됩니다. <code>statusColumn: true</code>이면 행 편집 시 <em>수정</em>, 추가 시 <em>추가</em> 상태가 표시되고 저장 후 기준 스냅샷이 갱신됩니다.</p>
            <pre class="wui-pre">"workboard": {
  "tree": ["dev-web", "design-ui"],
  "grid": [{ "task": "...", "owner": "..." }]
}</pre>
          </div>`,
        },
      ],
    },
  ],
};

const settingsSkinLayer = {
  title: '스킨 갤러리',
  description: '색상 테마 · 모양(모서리/테두리) · 밀도를 즉시 바꿉니다. 선택값은 localStorage 에 저장됩니다.',
  groups: [
    {
      id: 'colors',
      title: '색상 테마',
      items: themeButtons.map(([name, label]) => ({
        type: 'button', name: `theme-${name}`, span: 2, text: label, action: 'theme', theme: name,
        variant: name === 'blue' ? 'primary' : undefined,
      })),
    },
    {
      id: 'shapes',
      title: '모양',
      items: [
        { type: 'button', name: 'shape-sharp', span: 2, text: '각진', action: 'shape', shape: 'sharp' },
        { type: 'button', name: 'shape-soft', span: 2, text: '부드럽게', action: 'shape', shape: 'soft' },
        { type: 'button', name: 'shape-round', span: 2, text: '둥글게', action: 'shape', shape: 'round' },
        { type: 'button', name: 'shape-pill', span: 2, text: '캡슐', action: 'shape', shape: 'pill' },
        { type: 'button', name: 'border-toggle', span: 2, text: '테두리 토글', action: 'borders' },
        { type: 'button', name: 'skin-reset', span: 2, text: '기본값', action: 'skin-reset', variant: 'ghost' },
      ],
    },
    {
      id: 'density',
      title: '밀도',
      items: [
        { type: 'button', name: 'density-compact', span: 2, text: '좁게', action: 'density', density: 'compact' },
        { type: 'button', name: 'density-normal', span: 2, text: '보통', action: 'density', density: 'normal' },
        { type: 'button', name: 'density-comfortable', span: 2, text: '넓게', action: 'density', density: 'comfortable' },
      ],
    },
    {
      id: 'summary',
      title: '현재 스킨',
      items: [
        {
          type: 'html', span: 12, html: `<div class="wui-note">
            <p>버튼 액션은 <code>handleAction</code> 에서 <code>theme</code>, <code>shape</code>, <code>density</code>, <code>borders</code>, <code>skin-reset</code> 로 처리됩니다.</p>
            <pre class="wui-pre">WUI.skin.setTheme('green');
WUI.skin.setShape({ radius: 10, borders: false });
WUI.skin.setDensity('compact');</pre>
          </div>`,
        },
      ],
    },
  ],
};

export const layers = {
  dashboard: dashboardLayer,
  'order-form': orderFormLayer,
  approval: approvalLayer,
  org: orgLayer,
  'tree-grid': treeGridLayer,
  'settings-general': settingsGeneralLayer,
  'settings-skin': settingsSkinLayer,
};

/* ------------------------------- 데이터 ------------------------------- */
export const dataMap = {
  dashboard: {
    values: {},
    grids: { orders: makeOrders(80) },
    trees: { departments: DEPARTMENT_TREE },
  },
  'order-form': {
    values: {
      orderNo: 'ORD-2026-1042',
      orderedAt: '2026-11-16',
      status: 'shipping',
      customer: '김민준',
      phone: '010-2345-6789',
      email: 'minjun@example.com',
      channel: 'web',
      urgent: false,
      priority: 6,
      address: '서울시 강남구 테헤란로 123',
      postcode: '06234',
      memo: '오전 중 배송 요청',
      options: ['gift'],
    },
  },
  approval: {
    values: {
      title: '2026년 4분기 UI 개선 보고',
      docType: 'report',
      content: `<h2>4분기 UI 개선 보고</h2>
        <p>WUI 키트 도입 이후 화면 개발 리드타임이 <strong>38%</strong> 단축되었습니다.</p>
        <table>
          <thead><tr><th>항목</th><th>도입 전</th><th>도입 후</th></tr></thead>
          <tbody>
            <tr><td>화면 1개 개발</td><td>3.5일</td><td>2.1일</td></tr>
            <tr><td>공통 컴포넌트</td><td>12개</td><td>34개</td></tr>
            <tr><td>QA 결함</td><td>21건</td><td>9건</td></tr>
          </tbody>
        </table>
        <p>다음 분기에는 스킨 토큰과 접근성 검사를 확대할 예정입니다.</p>`,
      attach: [],
      cover: '',
      approvers: ['dev-web', 'design-ui'],
      keep: '3년',
    },
    trees: { approvers: DEPARTMENT_TREE },
  },
  'settings-general': {
    values: {
      siteName: 'WUI 스튜디오',
      timezone: 'Asia/Seoul',
      locale: 'ko',
      openAt: '2026-12-01T09:00',
      dailyAt: '03:30',
      maxRows: 500,
      notify: true,
      maintenance: false,
      themeColor: '#2f6fed',
      retention: '90일',
      memo: '매주 월요일 오전에 점검합니다.',
    },
  },
  'tree-grid': {
    values: {
      workboard: {
        tree: ['dev-web', 'design-ui'],
        grid: [],
      },
    },
    grids: {
      tasks: [
        { task: '디자인 시스템 토큰 정리', owner: '김민준', dept: 'dev-web', due: '2026-11-20', priority: 'high', progress: 80, done: false, note: '공통 컬러/간격 반영' },
        { task: '대시보드 차트 접근성 점검', owner: '이서연', dept: 'dev-web', due: '2026-11-22', priority: 'normal', progress: 45, done: false, note: 'ARIA 라벨 보강' },
        { task: '모바일 헤더 반응형 개선', owner: '박도윤', dept: 'dev-mobile', due: '2026-11-23', priority: 'high', progress: 30, done: false, note: '' },
        { task: '푸시 알림 설정 화면 QA', owner: '정하준', dept: 'dev-qa', due: '2026-11-21', priority: 'normal', progress: 60, done: false, note: '회귀 테스트 포함' },
        { task: '컴포넌트 스펙 문서화', owner: '최지우', dept: 'design-ui', due: '2026-11-24', priority: 'normal', progress: 50, done: false, note: 'Figma 링크 정리' },
        { task: '브랜드 아이콘 세트 업데이트', owner: '강수아', dept: 'design-brand', due: '2026-11-26', priority: 'low', progress: 20, done: false, note: '' },
        { task: '파트너 제안서 템플릿 작성', owner: '윤지호', dept: 'biz-sales', due: '2026-11-25', priority: 'high', progress: 10, done: false, note: '신규 거래처용' },
        { task: '고객 문의 FAQ 정비', owner: '임하은', dept: 'biz-cs', due: '2026-11-19', priority: 'normal', progress: 100, done: true, note: '배포 완료' },
      ],
    },
    trees: { departments: DEPARTMENT_TREE },
  },
  'settings-skin': { values: {} },
};

export const seed = { menu, layers, dataMap, tree: DEPARTMENT_TREE };
export const tree = DEPARTMENT_TREE;
export default seed;
