# 06. 트리

`createTree` 는 계층 데이터 탐색, 트라이스테이트 체크, 검색, 키보드 탐색, 지연 로딩을 지원하는 트리 컨트롤입니다.

## 1. 기본 사용

```html
<link rel="stylesheet" href="../src/css/tokens.css">
<link rel="stylesheet" href="../src/css/base.css">
<link rel="stylesheet" href="../src/css/tree.css">

<div id="tree"></div>

<script type="module">
  import WUI from '../src/js/webui.js';

  const tree = WUI.createTree('#tree', {
    data: [
      { id: 'company', label: 'WUI 주식회사', icon: '🏢', expanded: true, children: [
        { id: 'dev', label: '개발본부', icon: '⌨️', children: [
          { id: 'web', label: '웹플랫폼팀' },
          { id: 'mobile', label: '모바일팀' },
        ]},
        { id: 'design', label: '디자인센터', children: [
          { id: 'ui', label: 'UI팀', checked: true },
        ]},
      ]},
    ],
    checkable: true,
    cascade: true,
    showSearch: true,
    defaultExpandLevel: 1,
    onCheck: ({ checkedNodes }) => console.log(checkedNodes),
    onSelect: ({ node }) => console.log(node),
  });
</script>
```

## 2. 옵션

| 옵션 | 기본값 | 설명 |
| --- | --- | --- |
| `data` | `[]` | 루트 노드 배열 |
| `checkable` | `true` | 체크박스 표시 |
| `cascade` | `true` | 부모/자식 체크 전파 |
| `multiple` | `true` | 다중 선택 |
| `showIcons` | `true` | 아이콘 표시 |
| `showLines` | `true` | 연결선 표시 |
| `showSearch` | `true` | 검색 입력 표시 |
| `searchPlaceholder` | `트리 검색…` | 검색 placeholder |
| `showActions` | `true` | 전체 펼침/접힘 버튼 |
| `indent` | `18` | 레벨당 들여쓰기(px) |
| `defaultExpandLevel` | `0` | `0` 모두 접힘, `1` 루트 펼침, `-1` 모두 펼침 |
| `emptyText` | `표시할 항목이 없습니다.` | 빈 상태 문구 |
| `lazy` | `null` | `{ load: async (node) => children[] }` |
| `renderNode` | `null` | 사용자 노드 렌더 |
| `onSelect` | `null` | 선택 콜백 |
| `onCheck` | `null` | 체크 콜백 |
| `onExpand` | `null` | 펼침/접힘 콜백 |
| `onLoad` | `null` | 지연 로딩 완료 콜백 |

## 3. 노드 스키마

```js
{
  id: 'dev',                 // 문자열/숫자, 없으면 자동 생성
  label: '개발본부',          // 표시 텍스트 (text 별칭)
  icon: '⌨️',                // 아이콘 문자열/HTML
  disabled: false,
  selectable: true,
  checkable: true,
  checked: false,            // 초기 체크
  expanded: true,            // 초기 펼침
  lazy: false,               // true면 children 을 나중에 로드
  data: { ... },             // 사용자 데이터
  badge: 'NEW',              // 선택: 라벨 뒤 배지
  children: [ ... ],         // 하위 노드
}
```

문자열 배열도 허용됩니다.

```js
{ data: ['루트 1', '루트 2'] }
```

### 지연 로딩

```js
const tree = WUI.createTree('#tree', {
  data: [
    { id: 'root', label: '서버', lazy: true },
  ],
  lazy: {
    load: async (node) => {
      const res = await fetch(`/api/nodes/${node.id}/children`);
      return res.json();
    },
  },
  onLoad: (node, children) => console.log(node.id, children.length),
});
```

- `lazy: true` 노드를 처음 펼칠 때 `load(node)` 를 호출합니다.
- 로딩 중에는 스피너가 표시되고, 실패하면 `loaderror` 이벤트가 발생하며 접힌 상태로 돌아갑니다.
- 한 번 로드된 노드는 `loaded` 로 표시되어 재요청하지 않습니다.

### 사용자 렌더

```js
const tree = WUI.createTree('#tree', {
  data: nodes,
  renderNode: ({ node, level, tree }) => {
    const span = document.createElement('span');
    span.className = 'my-node';
    span.textContent = `${node.label} (${node.childrenCount})`;
    if (node.data && node.data.online) {
      const dot = document.createElement('i');
      dot.className = 'dot-online';
      span.appendChild(dot);
    }
    return span;
  },
});
```

`renderNode` 가 문자열을 반환하면 `innerHTML` 로 삽입됩니다. 신뢰할 수 없는 데이터는 직접 이스케이프하세요.

## 4. API

```js
const tree = WUI.createTree('#tree', options);
```

| 메서드 | 설명 |
| --- | --- |
| `setData(list)` | 데이터 교체 |
| `getData()` | 정리된 전체 트리 |
| `getNode(id)` | 단일 노드 복사본 |
| `updateNode(id, patch)` | `label/icon/disabled/data/checked` 수정 |
| `addNode(parentId, raw, index?)` | 부모 아래에 노드 추가. 루트는 `parentId` 에 `null` |
| `removeNode(id)` | 노드와 하위 노드 삭제 |
| `setChecked(id, checked)` | 체크 설정(cascade 적용) |
| `getChecked({ ids, parents })` | 체크 노드 배열 또는 id 배열 |
| `setCheckAll(flag)` | 전체 체크/해제 |
| `getSelected()` | 선택 노드(다수면 배열) |
| `select(id)` | 노드 선택 |
| `clearSelection()` | 선택 해제 |
| `toggle(id, force?)` | 펼침/접힘, 지연 로딩 트리거 |
| `expand(idOrIds, flag?)` | 펼침 상태 직접 설정 |
| `expandTo(id)` | 조상 노드를 펼쳐 경로 노출 |
| `expandAll()` / `collapseAll()` | 전체 펼침/접힘 |
| `filter(query)` / `setQuery(query)` | 검색 |
| `refresh()` | 다시 렌더 |
| `on/off/destroy` | 이벤트/정리 |

`getChecked` 는 기본적으로 부모 노드도 포함합니다. 리프만 필요하면 `getChecked({ parents: false })` 를 사용합니다.

```js
const ids = tree.getChecked({ ids: true });
const leaves = tree.getChecked({ ids: true, parents: false });

tree.expandAll();
tree.filter('개발');
tree.addNode('dev', { id: 'qa2', label: 'QA팀' });
tree.removeNode('qa2');
```

## 5. 이벤트

| 이벤트 | 페이로드 |
| --- | --- |
| `ready` | `api` |
| `select` | `{ node, selected }` |
| `check` | `{ node?, checked?, checkedNodes }` |
| `expand` | `{ node, expanded }` |
| `expandall` | 없음 |
| `collapseall` | 없음 |
| `load` | `{ node, children }` |
| `loaderror` | `{ node, error }` |
| `filter` | `{ query }` |

```js
tree.on('check', ({ checkedNodes }) => {
  console.log(checkedNodes.map((n) => n.id));
});

tree.on('select', ({ node, selected }) => {
  console.log(node.id, selected.length);
});
```

## 6. 체크 동작

- `cascade: true` 이면 자식 체크가 부모에 반영되고, 부모 체크가 자식에 전파됩니다.
- 자식이 일부만 체크되면 부모는 indeterminate 상태가 됩니다.
- `disabled: true` 또는 `checkable: false` 노드는 체크 대상에서 제외됩니다.
- 표시 체크 수는 리프 기준, 반환값은 기본적으로 부모 포함입니다.

## 7. 키보드 탐색

| 키 | 동작 |
| --- | --- |
| `ArrowDown` / `ArrowUp` | 표시된 행 간 이동 |
| `ArrowRight` | 접힌 노드 펼침, 펼쳐진 노드의 첫 자식으로 이동 |
| `ArrowLeft` | 펼쳐진 노드 접기, 접힌 노드의 부모로 이동 |
| `Home` / `End` | 첫/마지막 행 |
| `Space` | 체크 토글 |
| `Enter` | 선택 |

행은 `tabindex` 를 가지며 `focus` 클래스로 현재 위치를 표시합니다.

## 8. 검색

- 입력 후 180ms 디바운스로 `filterTree` 를 호출합니다.
- 라벨에 검색어가 포함된 노드와 그 조상이 표시됩니다.
- 일치 부분은 `<mark>` 로 하이라이트됩니다.
- 검색 중에는 일치 항목의 경로를 자동으로 펼칩니다.
- 결과가 없으면 검색 결과 없음 상태를 표시합니다.

## 9. 스타일

- 루트 `.wui-tree`, 본문 `.wui-tree-body`, 행 `.wui-tree-row`, 라벨 `.wui-tree-label`.
- `has-lines` 클래스로 연결선 표시.
- `--tree-depth` 변수로 들여쓰기 계산.
- 상태 클래스: `.is-selected`, `.is-checked`, `.is-indeterminate`, `.is-disabled`, `.is-focus`, `.is-loading`.

## 10. 제한 사항

- 노드 드래그 앤 드롭 이동은 제공하지 않습니다.
- 가상 스크롤은 없습니다. 노드 수가 매우 많으면 지연 로딩 사용을 권장합니다.
- 다중 선택은 `Ctrl/Cmd` 기반이며 범위 선택은 없습니다.
