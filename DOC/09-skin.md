# 09. 스킨

WUI 의 스킨은 CSS 변수와 `data-wui-*` 속성만으로 동작합니다. 컴포넌트 CSS 는 토큰 변수를 참조하고, `skin` 모듈이 대상 요소의 변수/속성을 바꿉니다.

## 1. 초기화

스킨을 사용하려면 대상 요소에 스킨 속성을 적용해야 합니다.

```js
import WUI from '../src/js/webui.js';

WUI.skin.init({ target: document.documentElement });
```

- 기본 대상은 `document.documentElement` 입니다.
- `createApp` 을 사용하면 앱 루트도 자동으로 대상에 추가됩니다.
- 여러 영역에 서로 다른 스킨을 적용하려면 `addTarget` 을 사용합니다.

```js
WUI.skin.init({ target: document.body, persist: false });
WUI.skin.addTarget(document.querySelector('#preview'));
```

`init` 은 저장된 스킨(localStorage `wui.skin`)을 복원합니다. `persist: false` 이면 저장/복원을 하지 않습니다.

## 2. 빠른 사용

```js
WUI.skin.setTheme('green');
WUI.skin.setShape('round');
WUI.skin.setDensity('compact');

WUI.skin.setShape({ radius: 10, borderWidth: 2, shadow: 'md', borders: false });

console.log(WUI.skin.current());
// { theme: 'green', shape: 'round', density: 'compact', overrides: {...}, borders: true, dark: false }
```

## 3. 테마 10종

| 이름 | 라벨 | 대표색 | 다크 |
| --- | --- | --- | --- |
| `blue` | 블루 | `#2f6fed` | – |
| `indigo` | 인디고 | `#4f46e5` | – |
| `green` | 그린 | `#0f9d58` | – |
| `teal` | 틸 | `#0d9488` | – |
| `purple` | 퍼플 | `#9333ea` | – |
| `orange` | 오렌지 | `#ea580c` | – |
| `red` | 레드 | `#dc2626` | – |
| `slate` | 슬레이트 | `#475569` | – |
| `dark` | 다크 | `#0f172a` | ✓ |
| `midnight` | 미드나잇 | `#312e81` | ✓ |

```js
WUI.skin.listThemes();
// [{ name, label, color, dark }, ...]
```

테마는 `--wui-primary`, `--wui-primary-hover`, `--wui-primary-fg`, `--wui-primary-weak`, `--wui-primary-weak-fg`, `--wui-accent` 를 바꿉니다. 다크 테마는 배경/표면/텍스트/테두리/그림자 변수도 함께 바꿉니다.

## 4. 모양 4종

| 이름 | 라벨 | 모서리 | 그림자 |
| --- | --- | --- | --- |
| `sharp` | 각진 | 0px | none |
| `soft` | 부드럽게 | 6px | sm |
| `round` | 둥글게 | 12px | md |
| `pill` | 캡슐 | 999px | sm |

```js
WUI.skin.setShape('round');
WUI.skin.setShape({ radius: 14 });
WUI.skin.setShape({ borderWidth: 2 });
WUI.skin.setShape({ shadow: 'lg' });
WUI.skin.setShape({ borders: false });
```

- `radius`: `--wui-radius`, `--wui-radius-sm`, `--wui-radius-lg` 를 계산해 적용합니다.
- `borderWidth`: `--wui-border-width` 를 설정합니다.
- `shadow`: `none`, `sm`, `md`, `lg` 또는 CSS 그림자 문자열.
- `borders`: `false` 면 `.wui-no-border` 클래스로 테두리를 숨깁니다.

초기화:

```js
WUI.skin.setShape({ radius: null, borderWidth: null, shadow: null });
```

## 5. 밀도 3종

| 이름 | 라벨 | 간격 | 컨트롤 높이 | 행 높이 | 글자 |
| --- | --- | --- | --- | --- | --- |
| `compact` | 좁게 | 8px | 28px | 30px | 12.5px |
| `normal` | 보통 | 12px | 34px | 36px | 13.5px |
| `comfortable` | 넓게 | 16px | 40px | 44px | 14px |

```js
WUI.skin.setDensity('comfortable');
```

밀도는 `--wui-space`, `--wui-control-h`, `--wui-row-h`, `--wui-font-size` 를 바꿉니다. 그리드는 생성 시 `--wui-row-h` 를 측정해 행 높이를 정합니다.

## 6. API

| 함수 | 설명 |
| --- | --- |
| `init(options)` | 저장값/기본값 적용, 대상 등록 |
| `addTarget(el)` / `removeTarget(el)` | 스킨 대상 추가/제거 |
| `apply(root?, options?)` | 대상에 현재 스킨 적용 또는 새 루트 초기화 |
| `setTheme(name, { target, persist })` | 테마 변경 |
| `setShape(nameOrObject, { target, persist })` | 모양 변경 |
| `setDensity(name, { target, persist })` | 밀도 변경 |
| `toggleBorders(force?)` | 테두리 토글 |
| `current()` | 현재 상태 |
| `listThemes()` / `listShapes()` / `listDensities()` | 목록 |
| `onChange(fn)` | 변경 구독, 해제 함수 반환 |
| `reset()` | 기본값으로 |
| `registerTheme(name, def)` | 사용자 테마 등록 |
| `registerShape(name, def)` | 사용자 모양 등록 |
| `createThemePicker(el)` | 테마 스와치 UI |
| `createShapePicker(el)` | 모양/모서리/테두리 UI |

```js
const off = WUI.skin.onChange((state) => {
  console.log('skin', state);
});

// 나중에
off();
```

## 7. 사용자 테마

```js
WUI.skin.registerTheme('forest', {
  label: '포레스트',
  color: '#166534',
  vars: {
    '--wui-primary': '#166534',
    '--wui-primary-hover': '#14532d',
    '--wui-primary-fg': '#ffffff',
    '--wui-primary-weak': '#dcfce7',
    '--wui-primary-weak-fg': '#166534',
    '--wui-accent': '#22c55e',
  },
});

WUI.skin.setTheme('forest');
```

`registerTheme` 은 런타임 `<style id="wui-skin-runtime">` 에 `[data-wui-theme="forest"]` 규칙을 추가합니다. 변수 키는 `--wui-` 접두사를 포함해도 되고, 포함하지 않으면 자동으로 붙습니다(단, `registerTheme` 의 vars 는 CSS 규칙으로 직접 출력되므로 `--` 접두사를 권장).

다크 테마를 만들려면 `dark: true` 와 배경/표면/텍스트 변수를 함께 지정하세요.

```js
WUI.skin.registerTheme('navy', {
  label: '네이비',
  color: '#1e3a8a',
  dark: true,
  vars: {
    '--wui-primary': '#93c5fd',
    '--wui-primary-fg': '#0b1220',
    '--wui-bg': '#0a1020',
    '--wui-surface': '#111a30',
    '--wui-surface-2': '#17223d',
    '--wui-fg': '#e8eefc',
    '--wui-muted': '#9fb0cc',
    '--wui-border': '#243453',
    '--wui-border-strong': '#34476d',
  },
});
```

## 8. 사용자 모양

```js
WUI.skin.registerShape('card', {
  label: '카드',
  vars: {
    borderRadius: '16px',
    radiusSm: '10px',
    radiusLg: '24px',
    shadow: 'lg',
  },
});
```

## 9. HTML/CSS 에서 직접 사용

스킨 대상 요소에 속성을 직접 지정할 수 있습니다.

```html
<div data-wui data-wui-theme="green" data-wui-shape="round" data-wui-density="compact">
  ...
</div>
```

```css
.my-panel {
  background: var(--wui-surface);
  color: var(--wui-fg);
  border: var(--wui-border-width) solid var(--wui-border);
  border-radius: var(--wui-radius);
  box-shadow: var(--wui-shadow);
}
```

### 주요 변수

| 변수 | 용도 |
| --- | --- |
| `--wui-primary`, `--wui-primary-hover`, `--wui-primary-fg` | 주 색상 |
| `--wui-primary-weak`, `--wui-primary-weak-fg` | 약한 배경/텍스트 |
| `--wui-accent` | 강조색 |
| `--wui-bg`, `--wui-surface`, `--wui-surface-2` | 배경/표면 |
| `--wui-fg`, `--wui-muted` | 텍스트 |
| `--wui-border`, `--wui-border-strong`, `--wui-border-width` | 테두리 |
| `--wui-radius`, `--wui-radius-sm`, `--wui-radius-lg` | 모서리 |
| `--wui-shadow` | 그림자 |
| `--wui-space`, `--wui-control-h`, `--wui-row-h`, `--wui-font-size` | 밀도 |

## 10. 피커 UI

```js
const themePicker = WUI.skin.createThemePicker('#theme-picker');
const shapePicker = WUI.skin.createShapePicker('#shape-picker');

// 정리
themePicker.destroy();
shapePicker.destroy();
```

- 테마 피커는 `wui-swatches` 컨테이너에 스와치 버튼을 렌더합니다.
- 모양 피커는 프리셋 버튼, 모서리 슬라이더, 테두리 체크박스를 렌더합니다.
- 두 피커 모두 `skin.onChange` 를 구독해 자동 갱신합니다.

## 11. 저장과 복원

`localStorage` 키 `wui.skin` 에 다음을 저장합니다.

```json
{
  "theme": "green",
  "shape": "round",
  "density": "normal",
  "overrides": { "radius": 10, "borderWidth": null, "shadow": null },
  "borders": true
}
```

`init()` 이 저장값을 복원합니다. `persist: false` 로 초기화하거나 개별 setter 에 `{ persist: false }` 를 넘기면 저장하지 않습니다.

## 12. 주의 사항

- `skin.init` 없이 setter 만 호출하면 대상이 없어 화면에 적용되지 않을 수 있습니다.
- 앱이 자체 루트에 스킨을 적용하므로, 앱 외부 요소까지 바꾸려면 `document.documentElement` 를 대상으로 초기화하세요.
- 스킨은 CSS 변수 기반이므로 컴포넌트 CSS 가 변수를 참조해야 반영됩니다. 하드코딩된 색상은 바뀌지 않습니다.
- 다크 테마는 일부 컴포넌트의 그림자/이미지 대비를 별도로 점검하는 것이 좋습니다.
