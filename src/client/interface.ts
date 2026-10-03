import { element, query, rootElement } from "./dom.ts";
/* Layout, theme, and fullscreen work independently of the WebGL renderer. */
export function createUI() {
  const root = rootElement();
  const $ = element;
  const mobile = globalThis.matchMedia(
    "(max-width:760px), (max-width:1020px) and (pointer:coarse)",
  );
  const storageKey = "iron-tangle-ui-v2";
  const memory: Record<string, unknown> = {};
  let toastTimer: ReturnType<typeof setTimeout> | undefined, fullscreenBusy = false;
  function readStore(name: string, fallback: unknown): unknown {
    try {
      const raw = localStorage.getItem(storageKey + ":" + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (_) {
      return Object.prototype.hasOwnProperty.call(memory, name) ? memory[name] : fallback;
    }
  }
  function writeStore(name: string, value: unknown) {
    memory[name] = value;
    try {
      localStorage.setItem(storageKey + ":" + name, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }
  function notify(message: string) {
    clearTimeout(toastTimer);
    $("it-toast").textContent = message;
    $("it-toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("it-toast").hidden = true;
    }, 3200);
  }
  function syncOcclusion() {
    const smallBrowserOpen = mobile.matches && !$("it-browser").hidden;
    const popupOpen = !$("it-advanced").hidden || !$("it-help").hidden;
    // Overlapping panels should not leave invisible controls in the tab order.
    $("it-selection").inert = smallBrowserOpen || popupOpen;
    $("it-selection-reopen").inert = smallBrowserOpen || popupOpen;
    query(".it-viewbar").inert = smallBrowserOpen;
    query(".it-camera-tools").inert = smallBrowserOpen;
    query(".it-bottom-tools").inert = smallBrowserOpen;
  }
  function setPopup(id: "it-advanced" | "it-help", open: boolean, focus = true) {
    const panel = $(id), name = id === "it-advanced" ? "tools" : "help";
    if (open) {
      const other = id === "it-advanced" ? "it-help" : "it-advanced";
      setPopup(other, false, false);
      if (mobile.matches) setBrowser(false, false);
    }
    panel.hidden = !open;
    $("it-" + name + "-toggle").setAttribute("aria-expanded", String(open));
    syncOcclusion();
    root.dispatchEvent(new Event("iron:layout"));
    if (focus) {
      (open ? $("it-" + name + "-close") : $("it-" + name + "-toggle")).focus({
        preventScroll: true,
      });
    }
  }
  function setBrowser(open: boolean, focus = false) {
    if (open && mobile.matches) {
      setPopup("it-advanced", false, false);
      setPopup("it-help", false, false);
    }
    const containsFocus = $("it-browser").contains(document.activeElement);
    $("it-browser").hidden = !open;
    root.classList.toggle("browser-closed", !open);
    $("it-browser-toggle").setAttribute("aria-expanded", String(open));
    $("it-browser-toggle").setAttribute(
      "aria-label",
      (open ? "Close" : "Open") + " object browser",
    );
    syncOcclusion();
    root.dispatchEvent(new Event("iron:layout"));
    if (focus) (open ? $("it-search") : $("it-browser-toggle")).focus({ preventScroll: true });
    else if (!open && containsFocus) $("it-canvas").focus({ preventScroll: true });
  }
  function showSelection(open: boolean, title?: string) {
    const selected = root.__ironModel?.state.object.kind !== "overview";
    $("it-selection").hidden = !open || !selected;
    $("it-selection-reopen").hidden = open || !selected;
    if (title) {
      query("span", $("it-selection-reopen")).textContent = title;
      $("it-selection-reopen").setAttribute("aria-label", "Show details for " + title);
    }
    syncOcclusion();
    root.dispatchEvent(new Event("iron:layout"));
  }
  function setTheme(theme: "light" | "dark") {
    document.documentElement.dataset.theme = theme;
    const label = "Switch to " + (theme === "dark" ? "light" : "dark") + " theme";
    $("it-theme").setAttribute("aria-label", label);
    $("it-theme").title = label;
    query<SVGUseElement>("use", $("it-theme")).setAttribute(
      "href",
      theme === "dark" ? "#icon-sun" : "#icon-moon",
    );
    query<HTMLMetaElement>('meta[name="theme-color"]').content = theme === "dark"
      ? "#0d141e"
      : "#eef2f6";
  }
  const storedTheme = readStore("theme", "dark");
  setTheme(storedTheme === "light" ? "light" : "dark");
  $("it-theme").addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(theme);
    writeStore("theme", theme);
  });
  const fullscreenDocument = document as Document & {
    webkitFullscreenElement?: Element;
    webkitExitFullscreen?: () => void;
  };
  const fullscreenRoot = root as typeof root & { webkitRequestFullscreen?: () => void };
  const fullscreenElement = () =>
    document.fullscreenElement || fullscreenDocument.webkitFullscreenElement;
  function syncFullscreen() {
    const active = fullscreenElement() === root;
    const button = $("it-fullscreen");
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    button.title = (active ? "Exit fullscreen" : "Enter fullscreen") + " (F)";
    query("span", button).textContent = active ? "Exit fullscreen" : "Fullscreen";
    query<SVGUseElement>("use", button).setAttribute(
      "href",
      active ? "#icon-exit-fullscreen" : "#icon-fullscreen",
    );
    root.dispatchEvent(new Event("iron:layout"));
  }
  async function toggleFullscreen() {
    if (fullscreenBusy || $("it-fullscreen").disabled) return;
    fullscreenBusy = true;
    try {
      if (fullscreenElement() === root) {
        await (document.exitFullscreen || fullscreenDocument.webkitExitFullscreen)?.call(document);
      } else await (root.requestFullscreen || fullscreenRoot.webkitRequestFullscreen)?.call(root);
    } catch (_) {
      notify("Fullscreen is unavailable here. Open index.html directly in a browser to try again.");
    } finally {
      fullscreenBusy = false;
      syncFullscreen();
    }
  }
  if (
    !(root.requestFullscreen || fullscreenRoot.webkitRequestFullscreen) ||
    document.fullscreenEnabled === false
  ) {
    $("it-fullscreen").disabled = true;
    $("it-fullscreen").title = "Fullscreen is unavailable in this browser or embedded view";
    $("it-fullscreen").setAttribute(
      "aria-label",
      "Fullscreen unavailable in this browser or embedded view",
    );
  }
  $("it-fullscreen").addEventListener("click", toggleFullscreen);
  root.addEventListener("pointerdown", (event) => {
    if (!$("it-cutaway-picker").contains(event.target instanceof Node ? event.target : null)) {
      $("it-cutaway-picker").open = false;
    }
  });
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && fullscreenElement() === root) {
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen();
    }
  }, true);
  $("it-browser-toggle").addEventListener(
    "click",
    () => setBrowser(Boolean($("it-browser").hidden), true),
  );
  $("it-browser-close").addEventListener("click", () => setBrowser(false, true));
  ["tools", "help"].forEach((name) => {
    const id = name === "tools" ? "it-advanced" : "it-help";
    $("it-" + name + "-toggle").addEventListener(
      "click",
      () => setPopup(id, Boolean($(id).hidden)),
    );
    $("it-" + name + "-close").addEventListener("click", () => setPopup(id, false));
  });
  $("it-selection-close").addEventListener("click", () => {
    showSelection(false);
    $("it-selection-reopen").focus({ preventScroll: true });
  });
  $("it-selection-reopen").addEventListener("click", () => {
    if (mobile.matches) setBrowser(false);
    showSelection(true);
    $("it-selection-close").focus({ preventScroll: true });
  });
  globalThis.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    ) return;
    if (
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target instanceof Element ? event.target.tagName : "")
    ) return;
    if (event.key === "/") {
      event.preventDefault();
      setBrowser(true, true);
      $("it-search").select();
    } else if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
    } else if (event.key === "?") {
      event.preventDefault();
      setPopup("it-help", Boolean($("it-help").hidden));
    } else if (event.key === "Escape") {
      if (fullscreenElement() === root) {
        event.preventDefault();
        toggleFullscreen();
      } else if ($("it-cutaway-picker").open) {
        $("it-cutaway-picker").open = false;
        query("summary", $("it-cutaway-picker")).focus();
      } else if (!$("it-advanced").hidden) setPopup("it-advanced", false);
      else if (!$("it-help").hidden) setPopup("it-help", false);
      else if (!$("it-browser").hidden) setBrowser(false, true);
      else if (!$("it-selection").hidden) {
        showSelection(false);
        $("it-selection-reopen").focus({ preventScroll: true });
      }
    }
  });
  mobile.addEventListener("change", () => setBrowser(!mobile.matches));
  const ui = {
    mobile,
    setBrowser,
    setPopup,
    showSelection,
    notify,
    readStore,
    writeStore,
    toggleFullscreen,
  };
  root.__ironUI = ui;
  setBrowser(!mobile.matches);
  return ui;
}
export type UI = ReturnType<typeof createUI>;
