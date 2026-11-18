# 04. 웹 에디터

`createEditor` 는 `contenteditable` 기반의 리치 텍스트 에디터입니다. 서식, 표, 이미지 첨부, HTML 소스 보기, 전체화면, 자동저장을 지원하며 입력 HTML 은 기본적으로 정화됩니다.

## 1. 기본 사용

```html
<link rel="stylesheet" href="../src/css/tokens.css">
<link rel="stylesheet" href="../src/css/base.css">
<link rel="stylesheet" href="../src/css/editor.css">

<div id="editor"></div>

<script type="module">
  import WUI from '../src/js/webui.js';

  const editor = WUI.createEditor('#editor', {
    value: '<h1>제목</h1><p>본문입니다.</p>',
    height: 360,
    toolbar: 'full',
    onChange: ({ html, text }) => console.log(text.length),
    onSave: ({ html }) => console.log('saved', html),
  });
</script>
```

`textarea` 를 마운트 대상으로 사용하면 원본 textarea 는 숨겨지고 폼 전송 값을 유지합니다.

```html
<textarea id="content" name="content">초기 HTML</textarea>
<script type="module">
  WUI.createEditor('#content', { toolbar: 'basic' });
</script>
```

## 2. 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `value` | `''` | 초기 HTML |
| `placeholder` | 안내 문구 | 빈 편집 영역에 표시 |
| `height` | `320` | 편집 영역 높이(px 또는 CSS 값) |
| `minHeight` | `180` | 최소 높이(px) |
| `toolbar` | `'full'` | `'full'`, `'basic'`, `false` |
| `stickyToolbar` | `true` | 스크롤 시 툴바 고정 |
| `readOnly` | `false` | 읽기 전용 시작 |
| `autofocus` | `false` | 시작 시 포커스 |
| `autosave` | `false` | localStorage 자동저장 |
| `autosaveKey` | 자동 생성 | 자동저장 키 |
| `autosaveDelay` | `700` | 자동저장 디바운스(ms) |
| `image.accept` | `'image/*'` | 이미지 파일 입력 accept |
| `image.maxSize` | `5MB` | 최대 이미지 크기 |
| `image.uploader` | `null` | `async (file) => url` 업로더 |
| `table.maxRows` | `20` | 표 최대 행 |
| `table.maxCols` | `10` | 표 최대 열 |
| `table.defaultRows` | `3` | 기본 행 |
| `table.defaultCols` | `3` | 기본 열 |
| `sanitize` | `true` | 입출력 HTML 정화 |
| `showStatus` | `true` | 하단 글자 수/상태 표시 |
| `onChange` | `null` | 변경 콜백 |
| `onSave` | `null` | 저장 콜백 |
| `onImage` | `null` | 이미지 삽입 콜백 |

### 툴바 구성

- `full`: 실행 취소/다시 실행, 문단, 글자 크기, 굵게/기울임/밑줄/취소선, 글자색/형광펜, 정렬, 목록/들여쓰기, 링크/이미지/표/구분선, 인용/코드/서식 지우기, HTML 소스, 전체화면, 표 도구
- `basic`: 동일한 편집 도구에서 HTML 소스 버튼만 제외
- `false`: 툴바 숨김

표 도구는 커서가 표 셀 안에 있을 때만 나타나며 행 추가/삭제, 열 추가/삭제, 표 삭제를 제공합니다.

## 3. API

```js
const editor = WUI.createEditor('#editor', options);
```

| 멤버 | 설명 |
| --- | --- |
| `el` | 루트 요소 |
| `toolbar` | 툴바 요소 |
| `area` | 편집 영역 요소 |
| `id` | 인스턴스 id |
| `getHTML({ raw })` | HTML 반환. 기본은 정화, `raw: true` 는 원본 |
| `setHTML(html, { silent })` | HTML 설정. 기본 `silent: true` |
| `getText()` | 텍스트 반환 |
| `setText(text)` | 텍스트 설정(HTML 이스케이프) |
| `getData()` | `{ html, text, empty, chars }` |
| `getValue()` / `setValue()` | `getHTML` / `setHTML` 별칭 |
| `focus()` | 편집 영역 포커스 |
| `exec(command, value)` | `document.execCommand` 실행 |
| `insertHTML(html)` | HTML 삽입(정화 옵션 적용) |
| `insertText(text)` | 텍스트 삽입 |
| `insertImage(src, { alt, width })` | URL 이미지 삽입 |
| `insertImageFile(file)` | 파일 검증 후 업로더/data URL 로 삽입 |
| `insertTable(rows, cols, header)` | 표 삽입 |
| `setFontSize(px)` | 선택 영역 글자 크기 |
| `save()` | 저장 이벤트 + 자동저장 갱신 |
| `clear()` | 내용 비우기 |
| `setReadOnly(flag)` | 읽기 전용 전환 |
| `setSourceMode(flag)` | HTML 소스 모드 전환 |
| `toggleFullscreen(force)` | 전체화면 전환 |
| `isDirty()` | 마지막 저장 이후 변경 여부 |
| `getSelectedText()` | 선택 텍스트 |
| `on(type, fn)` / `off(type, fn)` | 이벤트 구독/해제 |
| `destroy()` | 정리 |

### 사용 예

```js
const editor = WUI.createEditor('#editor', { autosave: true });

editor.setHTML('<p>안녕하세요</p>');
editor.insertImage('/assets/logo.png', { alt: '로고', width: 240 });
editor.insertTable(4, 3, true);

editor.on('change', ({ html, text, empty, chars }) => {
  document.querySelector('#preview').innerHTML = html;
  document.querySelector('#count').textContent = `${chars}자`;
});

editor.setReadOnly(true);
console.log(editor.isDirty());
```

## 4. 이벤트

| 이벤트 | 페이로드 | 시점 |
| --- | --- | --- |
| `ready` | `api` | 생성 완료 |
| `change` | `{ html, text, empty, chars }` | 입력 디바운스 후 |
| `save` | `{ html, text, empty, chars }` | `save()` 호출 |
| `clear` | 없음 | `clear()` 호출 |
| `readonly` | `boolean` | 읽기 전용 전환 |
| `image` | `{ file, src }` | 이미지 삽입 |
| `focus` | 없음 | 편집 영역 포커스 |
| `blur` | 없음 | 편집 영역 블러 |

```js
editor.on('image', ({ file, src }) => {
  console.log(file.name, src);
});
```

## 5. 이미지 처리

우선순위:

1. `options.image.uploader(file)` 가 있으면 그 결과 URL 사용
2. 없으면 `FileReader` 로 data URL 생성

`insertImageFile(file)` 은 다음을 검사합니다.

- `file.type` 이 `image/` 로 시작해야 함
- `image.maxSize` 초과 시 거부
- 실패 시 상태 표시줄에 오류 메시지

붙여넣기와 드래그 앤 드롭도 같은 경로를 사용합니다. 서버 업로드는 포함되어 있지 않으므로 실제 서비스에서는 `uploader` 를 제공하세요.

```js
const editor = WUI.createEditor('#editor', {
  image: {
    maxSize: 10 * 1024 * 1024,
    uploader: async (file) => {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/upload', { method: 'POST', body });
      const json = await res.json();
      return json.url;
    },
  },
});
```

## 6. HTML 정화

`sanitizeHtml(html)` 은 `template` 요소로 파싱한 뒤 다음 규칙을 적용합니다.

- 허용 태그만 유지: 문단/제목/목록/표/이미지/링크/인용/코드/서식 태그 등
- 위험 태그 제거: `script`, `style`, `iframe`, `object`, `embed`, `form`, `input` 등
- `on*` 이벤트 속성, `srcdoc`, `formaction` 제거
- `javascript:`, `vbscript:`, `data:text/html` URL 제거
- `style` 의 `expression`, `javascript:`, `url(...)` 제거
- 허용 목록에 없는 속성 제거(`data-*` 허용)
- `src` 없는 이미지 제거

```js
import { sanitizeHtml } from './src/js/webui.js';

const safe = sanitizeHtml('<p onclick="alert(1)">본문</p><script>alert(2)</script>');
// '<p>본문</p>'
```

정화를 끄려면 `sanitize: false` 를 사용하지만, 신뢰할 수 없는 HTML 에는 권장하지 않습니다.

## 7. 접근성과 키보드

- 툴바 버튼은 `aria-label`/`title` 을 가집니다.
- `Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+K` 등 브라우저 기본 편집 단축키를 사용합니다.
- `.wui-editor-btn` 은 `mousedown` 기본 동작을 막아 선택 영역을 유지합니다.
- 전체화면은 `Esc` 로 종료할 수 있습니다.
- 읽기 전용일 때 `contenteditable="false"` 와 툴바 `pointer-events: none` 을 적용합니다.

## 8. 제한 사항

- `document.execCommand` 기반이므로 브라우저별 서식 결과가 조금 다를 수 있습니다.
- 표 셀 병합/분할, 이미지 리사이즈 핸들은 제공하지 않습니다.
- 서버 업로드, 협업 편집, 변경 이력 관리는 범위에 포함되지 않습니다.
- 자동저장은 localStorage 단일 키에 HTML 문자열만 저장합니다.
