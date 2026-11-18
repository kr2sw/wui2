# 01. 개요

WUI 는 특정 프레임워크나 빌드 도구 없이 동작하는 바닐라 자바스크립트 UI 키트입니다. 업무 화면에서 반복적으로 필요한 **문서 편집**, **대량 데이터 편집**, **계층 데이터 탐색**, **JSON 기반 화면 구성**, **메뉴 기반 앱 셸**, **스킨 전환**을 각각 독립 모듈로 제공하고, 하나의 전역 객체 `WUI` 로 묶습니다.

## 1. 목표

1. **의존성 없는 실행** — 번들러, 트랜스파일러, UI 라이브러리 없이 최신 브라우저에서 바로 실행합니다.
2. **함수형 사용** — 모든 기능은 `create*` 팩토리로 생성하고, 반환된 API 객체로 제어합니다.
3. **JSON 주도 화면** — 메뉴, 레이어, 데이터, 트리, 폼 배치를 JSON 으로 정의합니다.
4. **업무 화면 수준의 기능** — 고정 열, 가상 스크롤, 검증, 변경 추적, 지연 로딩, 오류 복구를 포함합니다.
5. **한 곳에서 확장** — 컨트롤 레지스트리, 테마 등록, URL 템플릿, 이벤트 훅으로 기능을 확장합니다.
6. **문서와 데모의 일치** — 문서의 예제와 API 설명은 실제 구현을 기준으로 작성합니다.

## 2. 설계 원칙

| 원칙 | 구현 |
| --- | --- |
| 작은 코어 | `core/util.js`, `core/emitter.js`, `core/ajax.js`, `core/skin.js` 만 공통 기반으로 사용 |
| 팩토리 패턴 | `createEditor`, `createGrid`, `createTree`, `createLayout`, `createApp` |
| API 객체 | 각 팩토리는 `el`, 상태 getter, 명령 메서드, `on/off`, `destroy` 를 반환 |
| 선언적 UI | 레이아웃은 JSON 스키마, 앱은 메뉴 JSON, 데이터는 데이터 JSON |
| 이벤트 기반 | 모든 컴포넌트가 자체 `Emitter` 를 가지며 옵션 콜백과 이벤트를 함께 제공 |
| CSS 토큰 | 색상·간격·모서리·그림자를 CSS 변수로 두고 `data-wui-theme/shape/density` 로 전환 |
| 점진적 향상 | 서버가 없으면 mock 응답으로 폴백하여 데모와 문서가 항상 동작 |
| 명시적 정리 | `destroy()` 가 DOM, 이벤트, 타이머, 리스너를 정리 |

## 3. 기능 범위

### 3.1 웹 에디터

- `contenteditable` 기반 리치 텍스트 편집
- 실행 취소/다시 실행, 굵게/기울임/밑줄/취소선
- 문단 스타일, 글자 크기, 글자색, 형광펜
- 정렬, 글머리/번호 목록, 들여쓰기
- 링크, 구분선, 인용, 코드 블록, 서식 지우기
- 표 삽입과 행/열 추가·삭제, 표 삭제
- 이미지 파일 선택, 붙여넣기, 드래그 앤 드롭
- HTML 소스 모드, 전체화면, 자동저장, HTML 정화

### 3.2 편집형 그리드

- sticky 헤더, 좌/우 고정 열
- absolute 행 배치 기반 가상 스크롤
- 다중 정렬, 전체 검색, 열별 필터 행
- 12종 셀 타입과 사용자 정의 셀
- 행 추가/삭제, 범위/토글 선택, 전체 선택
- 규칙 기반 검증, 오류 셀 표시, 첫 오류로 이동
- 변경 내역 스냅샷, CSV 내보내기, 열 너비 저장
- AJAX 데이터 적재와 로딩/오류 상태

### 3.3 트리

- 트라이스테이트 체크박스와 부모/자식 cascade
- 검색, 일치 항목 하이라이트, 경로 자동 펼침
- 키보드 탐색(방향키, Home/End, Space, Enter)
- 노드 추가/수정/삭제, 전체 펼침/접힘
- 지연 로딩(`lazy.load`)과 로딩 표시
- 사용자 정의 노드 렌더

### 3.4 JSON 화면 배치

- 12컬럼 CSS Grid 기반 flow 배치
- `mode: "absolute"` 와 `pos {x,y,w,h}` 좌표 배치
- 그룹/섹션, 상단·하단 액션
- 31종 기본 컨트롤, 중첩 에디터/그리드/트리
- `visibleWhen`, `disabledWhen` 조건
- `required`, `pattern`, `min/max`, `rules` 검증
- `bind` 기반 데이터 바인딩과 값 수집/설정
- `registerControl` 사용자 컨트롤 확장

### 3.5 메뉴·레이어·데이터 앱

- 메뉴 JSON 로드와 계층 메뉴 렌더
- 메뉴 클릭 시 레이어 JSON + 데이터 JSON AJAX 로드
- 탭 열기/닫기/전환, 해시 라우팅
- 로딩/오류/재시도, AJAX 로그 패널
- 폼 제출, 액션 처리, JSON 다운로드
- 스킨 패널과 테마/모양/밀도 전환

### 3.6 스킨

- 10가지 색상 테마(라이트 8, 다크 2)
- 4가지 모양 프리셋과 모서리/테두리/그림자 조정
- 3단계 밀도
- localStorage 저장과 복원
- 사용자 테마·모양 등록

## 4. 브라우저 요구 사항

| 항목 | 요구 |
| --- | --- |
| ES 모듈 | `<script type="module">` 지원 브라우저 |
| CSS | CSS 변수, Grid, sticky, `:is()` 수준의 최신 CSS |
| API | `fetch`, `AbortController`, `URLSearchParams`, `structuredClone` 대신 자체 clone |
| 저장소 | localStorage 사용 가능(없으면 메모리 폴백) |

개발·검증 환경은 Microsoft Edge 157 헤드리스(Chromium)입니다. Node.js 는 서버와 데이터/문서 생성, 정적 검사에만 사용합니다.

## 5. 가장 작은 예제

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="./src/css/tokens.css">
  <link rel="stylesheet" href="./src/css/base.css">
  <link rel="stylesheet" href="./src/css/tree.css">
</head>
<body>
  <div id="tree"></div>
  <script type="module">
    import WUI from './src/js/webui.js';

    WUI.createTree('#tree', {
      data: [
        { id: 'root', label: '본사', children: [
          { id: 'dev', label: '개발팀' },
          { id: 'design', label: '디자인팀' },
        ]},
      ],
      checkable: true,
      cascade: true,
      onCheck: ({ checkedNodes }) => console.log(checkedNodes),
    });
  </script>
</body>
</html>
```

## 6. 문서 읽는 순서

- 처음 사용: [02. 데모 가이드](02-demo-guide.md) → [03. 아키텍처](03-architecture.md)
- 컴포넌트 사용: [04. 에디터](04-editor.md), [05. 그리드](05-grid.md), [06. 트리](06-tree.md)
- 화면 구성: [07. JSON 화면 배치](07-layout-json.md), [08. 메뉴·레이어·AJAX](08-menu-layer-ajax.md)
- 디자인: [09. 스킨](09-skin.md)
- 전체 API: [10. API 레퍼런스](10-api-reference.md)
- 구현 이력: [11. 진행 기록](11-progress.md)
