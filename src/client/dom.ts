import type { Model } from "./model.ts";
import type { UI } from "./interface.ts";
export interface ViewerElement extends HTMLElement {
  __ironModel?: Model;
  __ironUI?: UI;
  __ironNavigation?: unknown;
}
export function rootElement(): ViewerElement {
  return element("iron-tangle-3d");
}
export function required<T>(value: T | null | undefined, label = "required value"): T {
  if (value == null) throw new Error(`Missing ${label}`);
  return value;
}
export function context2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  return required(canvas.getContext("2d"), "2D canvas context");
}
interface Elements {
  "iron-tangle-3d": ViewerElement;
  "icon-search": HTMLElement;
  "icon-close": HTMLElement;
  "icon-panel": HTMLElement;
  "icon-left": HTMLElement;
  "icon-right": HTMLElement;
  "icon-focus": HTMLElement;
  "icon-fullscreen": HTMLElement;
  "icon-exit-fullscreen": HTMLElement;
  "icon-star": HTMLElement;
  "icon-clock": HTMLElement;
  "icon-home": HTMLElement;
  "icon-plus": HTMLElement;
  "icon-minus": HTMLElement;
  "icon-tools": HTMLElement;
  "icon-help": HTMLElement;
  "icon-sun": HTMLElement;
  "icon-moon": HTMLElement;
  "icon-station": HTMLElement;
  "icon-train": HTMLElement;
  "icon-line": HTMLElement;
  "icon-yard": HTMLElement;
  "icon-boss": HTMLElement;
  "icon-landmark": HTMLElement;
  "it-canvas": HTMLCanvasElement;
  "it-labels": HTMLCanvasElement;
  "it-loading": HTMLElement;
  "it-error": HTMLElement;
  "it-browser-toggle": HTMLButtonElement;
  "it-back": HTMLButtonElement;
  "it-forward": HTMLButtonElement;
  "it-theme": HTMLButtonElement;
  "it-fullscreen": HTMLButtonElement;
  "it-browser": HTMLElement;
  "it-browser-close": HTMLButtonElement;
  "it-search": HTMLInputElement;
  "it-search-clear": HTMLButtonElement;
  "it-search-key": HTMLElement;
  "it-search-hint": HTMLElement;
  "it-category": HTMLSelectElement;
  "it-favorite-count": HTMLElement;
  "it-results-title": HTMLElement;
  "it-result-count": HTMLElement;
  "it-results-disclosure": HTMLElement;
  "it-results": HTMLElement;
  "it-empty": HTMLElement;
  "it-empty-title": HTMLElement;
  "it-empty-copy": HTMLElement;
  "it-reset-filters": HTMLButtonElement;
  "it-catalog-count": HTMLElement;
  "it-cutaway-picker": HTMLDetailsElement;
  "it-view": HTMLSelectElement;
  "it-overview": HTMLButtonElement;
  "it-zoom-in": HTMLButtonElement;
  "it-zoom-out": HTMLButtonElement;
  "it-selection": HTMLElement;
  "it-selected-kind": HTMLElement;
  "it-selected-title": HTMLElement;
  "it-save-selection": HTMLButtonElement;
  "it-selection-close": HTMLButtonElement;
  "it-detail": HTMLElement;
  "it-connection-group": HTMLElement;
  "it-connections-label": HTMLElement;
  "it-connections": HTMLElement;
  "it-back-mobile": HTMLButtonElement;
  "it-forward-mobile": HTMLButtonElement;
  "it-object-prev": HTMLButtonElement;
  "it-object-position": HTMLElement;
  "it-object-next": HTMLButtonElement;
  "it-focus": HTMLButtonElement;
  "it-selection-reopen": HTMLButtonElement;
  "it-play": HTMLButtonElement;
  "it-tools-toggle": HTMLButtonElement;
  "it-help-toggle": HTMLButtonElement;
  "it-advanced": HTMLElement;
  "it-tools-close": HTMLButtonElement;
  "it-line": HTMLSelectElement;
  "it-colors": HTMLElement;
  "it-station-form": HTMLFormElement;
  "it-station": HTMLInputElement;
  "it-station-go": HTMLButtonElement;
  "it-station-hint": HTMLElement;
  "it-split-value": HTMLElement;
  "it-split": HTMLInputElement;
  "it-help": HTMLElement;
  "it-help-close": HTMLButtonElement;
  "it-caption": HTMLElement;
  "it-toast": HTMLElement;
  "it-color-probe": HTMLElement;
  "it-font-probe": HTMLElement;
}
export function element<K extends keyof Elements>(id: K): Elements[K];
export function element(id: string): HTMLButtonElement;
export function element(id: string): HTMLElement | SVGElement {
  return required(document.getElementById(id), `element #${id}`);
}
export function query<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  return required(root.querySelector<T>(selector), `element ${selector}`);
}
