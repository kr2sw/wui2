# 07. JSON 화면 배치

`createLayout` 은 JSON 스키마를 읽어 화면을 구성합니다. 12컬럼 CSS Grid 기반 flow 배치와 `pos` 좌표 기반 absolute 배치를 지원하고, 조건부 표시/비활성, 검증, 데이터 바인딩, 액션, 사용자 컨트롤 확장을 제공합니다.

## 1. 기본 사용

```html
<link rel="stylesheet" href="../src/css/tokens.css">
<link rel="stylesheet" href="../src/css/base.css">
<link rel="stylesheet" href="../src/css/layout.css">

<div id="form"></div>

<script type="module">
  import WUI from '../src/js/webui.js';

  const schema = {
    title: '주문 입력',
    description: '필수값과 형식 검증이 적용됩니다.',
    cols: 12,
    gap: 12,
    actions: [
      { label: '초기화', action: 'reset' },
      { label: '저장', action: 'submit', variant: 'primary' },
    ],
    groups: [
      {
        id: 'basic',
        title: '주문 정보',
        items: [
          { name: 'orderNo', label: '주문번호', type: 'text', span: 4, required: true },
          { name: 'orderedAt', label: '주문일', type: 'date', span: 4, required: true },
          { name: 'status', label: '상태', type: 'select', span: 4,
            options: [
              { value: 'ready', label: '준비' },
              { value: 'done', label: '완료' },
            ] },
        ],
      },
    ],
  };

  const form = WUI.createLayout('#form', schema, {
    values: { orderNo: 'ORD-2026-0001' },
    onSubmit: ({ values }) => console.log(values),
  });
</script>
```

## 2. 스키마 구조

```js
{
  title: '화면 제목',
  description: '설명',
  cols: 12,
  gap: 12,
  mode: 'flow',              // 'flow' | 'absolute'
  rowHeight: 36,             // absolute 모드 행 높이
  actions: [ ... ],
  groups: [
    {
      id: 'section-1',
      title: '섹션 제목',
      description: '섹션 설명',
      aside: '<span>HTML</span>',
      cols: 12,
      gap: 12,
      items: [ ... ],
    },
  ],
}
```

`groups` 가 없으면 `items` 를 단일 그룹으로 사용합니다.

### 아이템 공통 속성

| 속성 | 설명 |
| --- | --- |
| `type` | 컨트롤 타입. 없으면 `text`, `render` 가 있으면 `custom` |
| `name` | 값 키. 없으면 `field_<index>` |
| `label` | 라벨 텍스트. `false` 면 라벨 숨김 |
| `labelHint` | 라벨 옆 보조 텍스트 |
| `help` | 필드 아래 도움말 |
| `span` | 12컬럼 기준 너비. `'full'` 가능 |
| `spanSm` | 좁은 화면 너비 |
| `value` / `default` | 초기값 |
| `required` | 필수 규칙 추가 |
| `requiredMessage` | 필수 오류 메시지 |
| `pattern` | 정규식 규칙 추가 |
| `min` / `max` | number/range 범위 규칙 + 입력 제한 |
| `rules` | 검증 규칙 배열 |
| `hidden` | 항상 숨김 |
| `disabled` | 항상 비활성 |
| `readOnly` | 읽기 전용 |
| `visibleWhen` | 조건부 표시 |
| `disabledWhen` | 조건부 비활성 |
| `bind` | 데이터 객체 경로와 양방향 바인딩 |
| `props` | 타입별 추가 속성. 아이템 속성과 병합 |
| `group` | `true` 면 렌더에서 제외(구분용) |

`props` 는 다음처럼 병합됩니다.

```js
{
  type: 'text',
  name: 'customer',
  props: { placeholder: '고객명', autocomplete: 'name' },
  rules: [{ type: 'maxLength', value: 30 }],
}
```

`props` 는 아이템 정의에 병합되어 `placeholder`, `autocomplete`, `min`, `max`, `step` 등 컨트롤이 읽는 속성으로 전달됩니다. `maxLength` 는 현재 입력 요소에 직접 적용되지 않으므로 `rules` 의 `maxLength` 검증으로 처리하세요.

## 3. 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `id` | 자동 | 인스턴스 id |
| `cols` | `12` | 기본 컬럼 수 |
| `gap` | `12` | 기본 간격(px) |
| `mode` | `'flow'` | 기본 모드. 실제 렌더는 스키마의 `mode` 를 따름 |
| `rowHeight` | `36` | absolute 모드 기본 행 높이 |
| `labelPosition` | `'top'` | 예약됨(현재 상단 라벨 고정) |
| `readOnly` | `false` | 전체 읽기 전용 |
| `values` | `null` | 이름 기준 초기값 |
| `data` | `null` | `bind` 대상 데이터 객체 |
| `onChange` | `null` | `{ name, value, values, def }` |
| `onAction` | `null` | `{ action, def, values, schema }` |
| `onSubmit` | `null` | `{ values, schema }` |
| `imageUploader` | `null` | `async (file) => url` |
| `actions` | `null` | 스키마 액션을 덮어쓰는 액션 배열 |

## 4. 컨트롤 31종

| 타입 | 설명 | 주요 속성 |
| --- | --- | --- |
| `text` | 텍스트 | `placeholder`, `maxLength`, `autocomplete` |
| `string` | `text` 별칭 | 동일 |
| `email` | 이메일 입력 | `placeholder` |
| `password` | 비밀번호 | `placeholder` |
| `number` | 숫자 | `min`, `max`, `step` |
| `date` | 날짜 | `min`, `max` |
| `time` | 시간 | `min`, `max` |
| `datetime` | 일시 | `min`, `max` |
| `color` | 색상 | 기본 `#2f6fed` |
| `textarea` | 여러 줄 | `rows`, `height`, `placeholder` |
| `hidden` | 숨김 값 | `value` |
| `select` | 선택 | `options`, `multiple`, `placeholder`, `emptyLabel`, `emptyAsNull` |
| `radio` | 라디오 | `options`, `inline` |
| `checkbox-group` | 체크박스 그룹 | `options` |
| `checkboxes` | `checkbox-group` 별칭 | `options` |
| `checkbox` | 단일 체크 | `text` |
| `switch` | 스위치 | `text` |
| `range` | 범위 | `min`, `max`, `step`, `unit` |
| `slider` | `range` 별칭 | 동일 |
| `html` | HTML 블록 | `html`/`content` |
| `heading` | 제목 | `text`, `level` |
| `divider` | 구분선 | – |
| `spacer` | 여백 | `height` |
| `static` | 고정 텍스트 | `text` |
| `button` | 액션 버튼 | `text`, `action`, `variant`, `title` |
| `file` | 파일 첨부 | `multiple`, `accept`, `readAsDataUrl`, `buttonText`, `hint` |
| `image` | 이미지 | `accept`, `uploader` |
| `editor` | 웹 에디터 | `height`, `toolbar`, `placeholder`, `autosave`, `status` |
| `grid` | 임베드 그리드 | `columns`, `data`, `dataKey`, `height`, `filterRow`, `toolbar`, `search`, `footer`, `virtual` |
| `tree` | 임베드 트리 | `data`, `dataKey`, `checkable`, `cascade`, `search`, `actions`, `expandLevel`, `lazy` |
| `custom` | 사용자 컨트롤 | `render`, `getValue`, `setValue` |

### 옵션 형식

```js
// 배열
options: ['개발', '디자인', '영업']

// { value: label }
options: { dev: '개발', design: '디자인' }

// 객체 배열
options: [
  { value: 'dev', label: '개발', disabled: false },
]

// 행/컨트롤 정의 기반 동적 옵션
options: (def) => def.dependsOn ? [...]: [...]
```

### 값이 없는 컨트롤

`html`, `heading`, `divider`, `spacer`, `button`, `static` 은 `getValues()` 결과에 포함되지 않습니다. `checkbox`/`switch`/`hidden` 은 라벨 없이 렌더되는 타입입니다.

### 임베드 예

```js
{
  type: 'grid',
  name: 'orders',
  span: 12,
  dataKey: 'orders',
  height: 360,
  filterRow: true,
  columns: [
    { key: 'orderNo', title: '주문번호', type: 'text', frozen: 'left', required: true },
    { key: 'qty', title: '수량', type: 'number' },
  ],
}
```

`dataKey` 는 `options.data.grids[dataKey]` 에서 데이터를 찾습니다. 같은 방식으로 트리는 `options.data.trees[dataKey]` 를 사용합니다.

## 5. 조건부 표시와 비활성

`visibleWhen` / `disabledWhen` 은 조건 객체, 조건 배열, 함수를 받습니다.

```js
{ field: 'urgent', op: 'truthy' }
{ field: 'status', op: 'in', value: ['ready', 'shipping'] }
[{ field: 'type', op: 'eq', value: 'corp' }, { field: 'bizNo', op: 'notEmpty' }]
(values) => values.amount > 1000000
```

지원 연산자:

| `op` | 의미 |
| --- | --- |
| `eq` / `ne` | 같음/다름(문자열 비교) |
| `in` / `nin` | 포함/미포함 |
| `gt` / `gte` / `lt` / `lte` | 숫자 비교 |
| `empty` / `isEmpty` | 빈 값 |
| `notEmpty` | 비어 있지 않음 |
| `contains` | 문자열/배열 포함 |
| `truthy` / `falsy` | 참/거짓 |

```js
{
  name: 'urgentReason',
  label: '긴급 사유',
  type: 'text',
  span: 12,
  required: true,
  visibleWhen: { field: 'urgent', op: 'truthy' },
}
```

조건이 바뀌면 `evaluateVisibility()` 가 필드의 `hidden`, `display`, `disabled` 상태를 갱신합니다. 숨겨진 필드는 검증에서 제외됩니다.

## 6. 검증

```js
{
  name: 'phone',
  label: '연락처',
  required: true,
  pattern: '^01[0-9]-?\\d{3,4}-?\\d{4}$',
  rules: [
    { type: 'pattern', value: '^01[0-9]-?\\d{3,4}-?\\d{4}$', message: '휴대폰 번호 형식이 아닙니다.' },
    { type: 'custom', validate: (v, row) => v.length <= 13 || '너무 깁니다.' },
  ],
}
```

- `required` 는 `{ type: 'required' }` 규칙으로 변환됩니다.
- `pattern` 은 `pattern` 규칙으로 변환됩니다.
- `min`/`max` 는 `number`/`range` 에서 규칙으로 추가됩니다.
- 지원 규칙은 그리드와 동일합니다(`required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `email`, `number`, `custom`, 함수).

API:

```js
const errors = form.validate();        // [{ name, message, def }]
form.setErrors({ email: '이미 사용 중입니다.' });
form.getErrors();                      // { email: '...' }
const result = form.submit();          // { valid, values, errors }
```

검증 실패 시 첫 오류 필드로 스크롤하고 `invalid` 이벤트를 발생시킵니다. `submit()` 은 `submitinvalid` 또는 `submit` 이벤트를 발생시킵니다.

## 7. 값과 바인딩

### 초기값 우선순위

1. `options.values[name]`
2. `options.data` 의 `bind` 경로
3. `item.value`
4. `item.default` (함수 가능)
5. 타입별 기본값(`checkbox` false, `number` null, 그룹 배열, range min, 그 외 `''`)

### bind

```js
const data = { customer: { name: '김하늘', email: 'haneul@example.com' } };

const form = WUI.createLayout('#form', {
  items: [
    { name: 'customerName', label: '고객명', bind: 'customer.name' },
    { name: 'customerEmail', label: '이메일', type: 'email', bind: 'customer.email' },
  ],
}, { data });

form.setValues({ customerName: '이서준' });
console.log(data.customer.name);  // '이서준'
```

- `getPath`/`setPath` 로 중첩 경로를 읽고 씁니다.
- `applyData(data)` 는 모든 `bind` 필드를 갱신합니다.
- `getValues({ visibleOnly: true })` 는 숨겨진 필드를 제외합니다.

### 값 API

| 메서드 | 설명 |
| --- | --- |
| `getValues(opts?)` | 현재 값 수집 |
| `setValues(values, { silent })` | 값 설정 + 조건/오류 갱신 |
| `applyData(data)` | `bind` 필드에 데이터 적용 |
| `reset()` | 초기값으로 되돌림 |
| `getControl(name)` / `getField(name)` | 컨트롤/메타 접근 |
| `focus(name)` | 필드로 스크롤 + 포커스 |
| `refresh()` / `refreshVisibility()` | 오류/조건 재평가 |

## 8. 액션

```js
actions: [
  { label: 'JSON 보기', action: 'json', variant: 'ghost', position: 'top' },
  { label: '초기화', action: 'reset' },
  { label: '저장', action: 'submit', variant: 'primary' },
]
```

- `position` 은 `top` 또는 `bottom`(기본)입니다.
- `submit`/`reset` 은 레이아웃 내장 동작입니다.
- 나머지는 `action` 이벤트와 `onAction` 콜백으로 전달됩니다.
- `button` 타입 아이템도 `wui-action` 이벤트를 발생시켜 같은 경로로 처리됩니다.
- 앱(`createApp`)은 `theme`, `shape`, `density`, `borders`, `skin-reset`, `reload`, `close`, `log`, `json` 액션을 내장 처리합니다.

```js
const form = WUI.createLayout('#form', schema, {
  onAction: ({ action, def, values }) => {
    if (action === 'preview') {
      console.log(JSON.stringify(values, null, 2));
    }
  },
});
```

## 9. absolute 배치

```js
{
  mode: 'absolute',
  rowHeight: 40,
  groups: [{
    cols: 12,
    items: [
      { type: 'text', name: 'name', label: '이름', pos: { x: 1, y: 1, w: 4, h: 1 } },
      { type: 'date', name: 'date', label: '날짜', pos: { x: 5, y: 1, w: 3, h: 1 } },
      { type: 'textarea', name: 'memo', label: '메모', pos: { x: 1, y: 2, w: 7, h: 3 } },
    ],
  }],
}
```

`pos` 는 CSS `grid-area: y / x / span h / span w` 로 변환됩니다. 섹션 그리드는 `grid-auto-rows: rowHeight` 를 사용합니다. `pos` 가 없으면 flow 규칙(`span`)을 따릅니다.

## 10. 사용자 컨트롤

```js
WUI.registerControl('rating', (ctx) => {
  const wrap = document.createElement('div');
  wrap.className = 'my-rating';
  let current = Number(ctx.value) || 0;

  const paint = (value) => {
    current = Math.max(0, Math.min(5, Number(value) || 0));
    [...wrap.children].forEach((el, i) => {
      el.textContent = i < current ? '★' : '☆';
      el.setAttribute('aria-pressed', String(i < current));
    });
  };

  const buttons = [1, 2, 3, 4, 5].map((n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', () => {
      paint(n);
      ctx.onChange(current);
    });
    wrap.appendChild(b);
    return b;
  });
  paint(current);

  return {
    el: wrap,
    getValue: () => current,
    setValue: (v) => paint(v),
    focus: () => buttons[0].focus(),
    setDisabled: (flag) => buttons.forEach((b) => { b.disabled = !!flag; }),
    destroy: () => wrap.remove(),
  };
}, { label: '평점' });
```

스키마에서 `{ type: 'rating', name: 'score', label: '평점' }` 으로 사용합니다. 컨트롤 팩토리는 다음 형태를 반환해야 합니다.

```js
{
  el,
  getValue?,
  setValue?,
  focus?,
  setDisabled?,
  destroy?,
}
```

`ctx` 필드: `def`, `name`, `value`, `label`, `disabled`, `readOnly`, `options`(레이아웃 옵션), `onChange(value, { input })`.

`custom` 타입은 `render(ctx)` 가 반환한 Node/문자열을 표시하고 `getValue`/`setValue`로 값을 제어합니다.

## 11. 이벤트

| 이벤트 | 페이로드 |
| --- | --- |
| `ready` | `api` |
| `change` | `{ name, value, values, def }` |
| `values` | 전체 값 객체 |
| `error` | `{ name, message }` |
| `validate` | 오류 배열 |
| `invalid` | 오류 배열(첫 오류 포커스) |
| `submit` | `{ values, schema }` |
| `submitinvalid` | `{ errors, values }` |
| `reset` | 값 객체 |
| `action` | `{ action, def, values, schema }` |

## 12. 스타일

- 루트 `.wui-layout`, 헤드 `.wui-layout-head`, 본문 `.wui-layout-body`.
- 섹션 `.wui-layout-section`, 그리드 `.wui-layout-grid`, 필드 `.wui-field`.
- 필드 상태: `.is-invalid`, `.is-hidden`, `.is-disabled`, `.is-bare`, `.is-inline-control`.
- `--wui-span`, `--wui-span-sm`, `--wui-cols`, `--wui-gap-custom` 변수로 배치를 제어합니다.

## 13. 제한 사항

- 중첩 그룹(그룹 안의 그룹)은 지원하지 않습니다.
- `labelPosition` 은 현재 예약 옵션이며 상단 라벨로 렌더됩니다.
- `options.mode` 가 아니라 스키마의 `mode` 가 실제 배치에 사용됩니다.
- 레이아웃 자체는 서버 통신을 하지 않습니다. 제출/액션은 앱 또는 사용자 콜백에서 처리합니다.
