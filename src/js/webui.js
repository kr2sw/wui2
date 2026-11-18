/*!
 * WUI (Web UI Kit) - js/webui.js
 * 통합 진입점. 모든 기능을 전역 WUI 네임스페이스와 ES 모듈로 노출한다.
 *
 * <script type="module" src="./src/js/webui.js"></script>
 * WUI.createGrid('#grid', { columns, data });
 */
import { VERSION } from './core/util.js';
import * as util from './core/util.js';
import { Emitter } from './core/emitter.js';
import { ajax, AjaxError } from './core/ajax.js';
import * as skin from './core/skin.js';

import { createEditor, editor, sanitizeHtml } from './editor/editor.js';
import { createGrid, grid } from './grid/grid.js';
import { createTree, tree } from './tree/tree.js';
import { createLayout, layout } from './layout/layout.js';
import {
  registerControl, getControlFactory, listControls, controlRegistry,
} from './layout/controls.js';
import { createApp, app } from './app/app.js';

/* 기본 컨트롤 등록 (controls.js 로드 시 자동 등록됨) */
const WUI = {
  VERSION,
  util,
  h: util.h,
  $: util.$,
  $$: util.$$,
  on: util.on,
  Emitter,
  ajax,
  AjaxError,
  skin,
  createEditor,
  editor,
  sanitizeHtml,
  createGrid,
  grid,
  createTree,
  tree,
  createLayout,
  layout,
  registerControl,
  getControlFactory,
  listControls,
  controlRegistry,
  createApp,
  app,
};

export {
  VERSION, util, Emitter, ajax, AjaxError, skin,
  createEditor, editor, sanitizeHtml,
  createGrid, grid,
  createTree, tree,
  createLayout, layout,
  registerControl, getControlFactory, listControls, controlRegistry,
  createApp, app,
};

if (typeof window !== 'undefined') {
  window.WUI = WUI;
}

export default WUI;
