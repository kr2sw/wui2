# WUI — 바닐라 JS 웹 UI 키트

의존성 없이 동작하는 바닐라 자바스크립트 UI 키트입니다. 웹 에디터, 편집형 그리드, 트리, JSON 화면 배치, 메뉴/레이어/데이터 AJAX, 색상·모양·밀도 스킨을 하나의 `WUI` 네임스페이스로 제공합니다.

- 빌드 도구 없음 · 런타임 의존성 0개 · ES 모듈
- `file://` 로 열어도 mock 폴백으로 데모 동작
- CSS 변수 + `data-wui-*` 속성 기반 스킨
- 31종 레이아웃 컨트롤 · 12종 그리드 셀 타입 · 10종 색상 테마
- 문서 뷰어 포함 (`DOC/index.html`)

## 빠른 시작

```bash
npm start
```

- 데모: <http://localhost:4173/>
- 문서: <http://localhost:4173/DOC/>

서버 없이 `index.html` 을 브라우저로 직접 열어도 됩니다. 이 경우 `/api/*` 요청은 `src/js/demo.js` 에 등록된 mock 응답으로 대체됩니다.

```html
<link rel="stylesheet" href="./src/css/tokens.css">
<link rel="stylesheet" href="./src/css/base.css">
<link rel="stylesheet" href="./src/css/grid.css">

<div id="grid"></div>
<script type="module">
  import WUI from './src/js/webui.js';

  const grid = WUI.createGrid('#grid', {
    columns: [
      { key: 'name', title: '이름', type: 'text', frozen: 'left', required: true },
      { key: 'team', title: '팀', type: 'select', options: ['개발', '디자인', '영업'] },
      { key: 'joined', title: '입사일', type: 'date' },
    ],
    data: [{ name: '김하늘', team: '개발', joined: '2024-03-02' }],
    filterRow: true,
  });

  grid.on('change', ({ row, key, value }) => {
    console.log(key, value, row);
  });
</script>
```

## 주요 기능

| 영역 | 기능 |
| --- | --- |
| 에디터 | 서식, 문단/글자 크기, 색상, 정렬, 목록, 링크, 표 행/열 편집, 이미지 파일·붙여넣기·드래그, HTML 소스, 전체화면, 자동저장, HTML 정화 |
| 그리드 | 상단 고정, 좌/우 열 고정, 가상 스크롤, 정렬(다중), 검색, 열 필터, 12종 셀 타입, 행 추가/삭제, 선택, 검증, 변경 내역, CSV, 너비 저장 |
| 트리 | 트라이스테이트 체크, cascade, 검색/하이라이트, 키보드 탐색, 추가/수정/삭제, 지연 로딩, 사용자 렌더 |
| 레이아웃 | 12컬럼 flow, `pos` 기반 absolute, 그룹/액션, 조건부 표시·비활성, 검증, 데이터 바인딩, 에디터/그리드/트리 임베드, 컨트롤 확장 |
| 앱 셸 | 메뉴 JSON → 레이어 JSON + 데이터 JSON, 탭, 해시 라우팅, AJAX 로그, 로딩/오류/재시도, 스킨 패널, 토스트 |
| 스킨 | 10색 테마, 4가지 모양, 3단계 밀도, 모서리/테두리 미세 조정, localStorage 저장, 사용자 테마 등록 |
| 통신 | fetch 래퍼, 타임아웃/취소, JSON 자동 파싱, 요청 로그, mock 자동 폴백, URL 템플릿 |

## 폴더 구조

```text
.
├─ index.html                 # 데모 진입점 (6개 뷰)
├─ serve.mjs                  # 정적 + API 데모 서버
├─ package.json
├─ src
│  ├─ css                     # tokens → base → 컴포넌트 → app → demo
│  ├─ js
│  │  ├─ core                 # util, emitter, ajax, skin
│  │  ├─ editor               # 웹 에디터
│  │  ├─ grid                 # 편집형 그리드
│  │  ├─ tree                 # 트리
│  │  ├─ layout               # JSON 화면 배치 + 컨트롤 레지스트리
│  │  ├─ app                  # 메뉴/탭/레이어/데이터 앱 셸
│  │  ├─ webui.js             # 통합 엔트리 (전역 WUI)
│  │  └─ demo.js              # 데모 초기화 + mock 등록
│  └─ data                    # seed.js 원본 + 생성된 JSON
├─ tools
│  ├─ build-data.mjs          # seed.js → JSON
│  ├─ build-docs.mjs          # DOC/*.md → docs-data.js/json
│  ├─ check.mjs               # 모듈·데이터·문서 정적 검사
│  └─ browser-check.mjs       # Edge CDP 실제 실행 점검
└─ DOC                        # 사용 문서 + 경량 문서 뷰어
```

## npm 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm start` | 데모 서버 실행 (기본 4173, `PORT`/`HOST`/`API_DELAY` 지원) |
| `npm run build` | 데이터 JSON + 문서 데이터 동시 생성 |
| `npm run build:data` | `src/data/seed.js` 에서 `menu/layers/data/tree` JSON 재생성 |
| `npm run build:docs` | `DOC/*.md` 를 읽어 문서 뷰어 데이터 생성 |
| `npm run check` | 모듈 로딩, WUI 내보내기, 컨트롤/테마 수, 데이터·문서 JSON 검사 |

Node.js 18 이상이면 충분합니다. 브라우저 실행에는 번들러나 트랜스파일러가 필요하지 않습니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [01. 개요](DOC/01-overview.md) | 목표, 설계 원칙, 기능 범위, 시작하기 |
| [02. 데모 가이드](DOC/02-demo-guide.md) | 6개 데모 뷰, mock, 서버, 점검 방법 |
| [03. 아키텍처](DOC/03-architecture.md) | 모듈 구조, 데이터 흐름, 생명주기 |
| [04. 웹 에디터](DOC/04-editor.md) | 옵션, 툴바, API, 이벤트, 이미지 처리 |
| [05. 그리드](DOC/05-grid.md) | 컬럼/셀 타입, 고정·가상화, 검증, API |
| [06. 트리](DOC/06-tree.md) | 노드 스키마, 체크 cascade, 지연 로딩, 키보드 |
| [07. JSON 화면 배치](DOC/07-layout-json.md) | 스키마, 31개 컨트롤, 조건/검증/바인딩 |
| [08. 메뉴·레이어·AJAX](DOC/08-menu-layer-ajax.md) | JSON 계약, URL 템플릿, mock, 서버 API |
| [09. 스킨](DOC/09-skin.md) | 테마/모양/밀도, CSS 변수, 확장 |
| [10. API 레퍼런스](DOC/10-api-reference.md) | 전역 API, 팩토리별 메서드·이벤트 |
| [11. 진행 기록](DOC/11-progress.md) | 구현 이력, 수정 사항, 검증, 남은 한계 |

문서는 `DOC/index.html` 에서도 볼 수 있습니다. `DOC/*.md` 를 수정한 뒤 `npm run build:docs` 를 실행하면 뷰어에 반영됩니다.
