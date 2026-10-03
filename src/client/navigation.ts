import {
  isPrimaryStairwellStation,
  PRIMARY_STAIRWELL_STATIONS,
  stationCanonRole,
} from "./canon.ts";
import {
  isObjectAvailable,
  objectKey as key,
  objectRouteId,
  reconcileHistory,
  reconcileObjects,
} from "./objects.ts";
import { element, query, required, rootElement } from "./dom.ts";
import { LANDMARK_SPECS, SERVICE_SPECS } from "./scene_specs.ts";
import {
  catalogDefinitions,
  createObjectRegistry,
  serviceConnections,
} from "./object_definitions.ts";
/* Object discovery, saved places, recent selections, and connected stops. */
import type { Model } from "./model.ts";
import type { UI } from "./interface.ts";
import type { CatalogEntry, Group, IronObject } from "./types.ts";
export function createNavigation(initialModel: Model | undefined, ui: UI) {
  const root = rootElement();
  const $ = element;
  if (!initialModel) {
    document.querySelectorAll<HTMLButtonElement>(
      "[data-category],[data-collection],[data-view],#it-search,#it-play,#it-overview,#it-zoom-in,#it-zoom-out,#it-view,#it-line,#it-split,#it-tools-toggle",
    ).forEach((control) => {
      control.disabled = true;
    });
    $("it-result-count").textContent = "Viewer unavailable";
    return;
  }
  const model = initialModel;
  const lifecycle = { signal: model.lifecycleSignal };
  lifecycle.signal.addEventListener("abort", () => {
    $("it-results").replaceChildren();
    $("it-connections").replaceChildren();
  }, { once: true });
  const search = $("it-search"), category = $("it-category"), list = $("it-results");
  const categories = {
    stations: "Station / hub",
    trains: "Train",
    lines: "Colored line",
    yards: "Trainyard",
    bosses: "City boss",
    landmarks: "Landmark / cutaway",
  };
  const groupNames = {
    stations: "Stations & hubs",
    trains: "Trains & services",
    lines: "Colored lines",
    yards: "Trainyards",
    bosses: "Station Mimics",
    landmarks: "Landmarks & cutaways",
  };
  const groupIcons = {
    stations: "station",
    trains: "train",
    lines: "line",
    yards: "yard",
    bosses: "boss",
    landmarks: "landmark",
  };
  const groupOrder: Group[] = ["stations", "trains", "lines", "yards", "bosses", "landmarks"];
  const normalize = (s: unknown) =>
    String(s).toLowerCase().replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
      .replace(/[^a-z0-9]+/g, " ").trim();
  const matches = (text: string, tokens: string[]) => {
    const words = text.split(" ");
    return tokens.every((t) =>
      words.some((w) => /^\d+$/.test(t) || t.length === 1 ? w === t : w.startsWith(t))
    );
  };
  const catalog: CatalogEntry[] = [];
  let results: CatalogEntry[] = [],
    collection = "all",
    history: IronObject[] = [{ kind: "overview", view: "whole" }],
    historyIndex = 0,
    restoring = false;
  const own = (object: object, id: PropertyKey | undefined) =>
    id !== undefined && Object.prototype.hasOwnProperty.call(object, id);
  let registry = createObjectRegistry();
  function titleOf(o: IronObject) {
    const unmapped = objectRouteId(o)?.match(/^unmapped-(\d+)-(-?1)$/);
    return unmapped
      ? "Unmapped line " + (Number(unmapped[1]) * 2 + (unmapped[2] === "1" ? 1 : 2)) +
        (o.kind === "station" ? " " + o.n : "")
      : model.objectTitle(o);
  }
  function entry(object: IronObject, group: Group, meta = "", aliases = "", rank = 100) {
    return {
      key: key(object),
      object,
      group,
      title: titleOf(object),
      meta,
      search: normalize(titleOf(object) + " " + meta + " " + aliases),
      rank,
    };
  }
  function rebuildCatalog() {
    catalog.length = 0;
    catalogDefinitions().forEach(({ object, group, meta, aliases, rank }) => {
      if (isObjectAvailable(object, registry)) {
        catalog.push(entry(object, group, meta, aliases, rank));
      }
    });

    model.runtimeObjects.forEach((object) => {
      if (!catalog.some((candidate) => candidate.key === key(object))) {
        catalog.push(entryFor(object));
      }
    });
    catalog.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
  }

  function dynamicStation(query: string) {
    const number = query.match(/(?:^|\s)(\d{1,3})(?:$|\s)/);
    if (!number) return null;
    const n = Number(number[1]);
    if (n < 10 || n > 436) return null;
    const lineWords = query.replace(number[0], " ").trim();
    const route = lineWords
      ? model.knownRoutes.find((r) => normalize(r.name) === lineWords)
      : model.knownRoutes.find((r) => r.id === model.state.selected);
    if (!route || route.namedNodes.some((k) => k.n === n)) return null;
    const role = n === 75 && route.name === "Vermillion"
      ? "Repair / security station · Downward Dog"
      : stationCanonRole(n);
    return entry(
      { kind: "station", route: route.id, n },
      "stations",
      role,
      route.name + " " + n,
      -1,
    );
  }

  function icon(name: string) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "it-icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-" + name);
    svg.append(use);
    return svg;
  }
  function entryFor(object: IronObject) {
    const existing = catalog.find((e) => e.key === key(object));
    if (existing) return existing;
    const group = object.kind === "node" || object.kind === "station" || object.kind === "stop"
      ? "stations"
      : object.kind === "train" || object.kind === "route" && own(model.namedRoutes, object.id)
      ? "trains"
      : object.kind === "yard"
      ? "yards"
      : object.kind === "mimic"
      ? "bosses"
      : object.kind === "landmark"
      ? "landmarks"
      : "lines";
    return entry(
      object,
      group,
      object.kind === "station"
        ? "Numbered stop · position inferred"
        : object.kind === "route" && own(model.namedRoutes, object.id)
        ? "Named train route"
        : "Selected in the scene · reconstructed",
    );
  }
  rebuildCatalog();

  function restoreObjects(name: string) {
    const stored = ui.readStore(name, []);
    return Array.isArray(stored) ? reconcileObjects(stored, registry) : [];
  }
  const favorites = new Map(restoreObjects("favorites").map((o) => [key(o), o]));
  let recent = restoreObjects("recent").slice(0, 20);
  ui.writeStore("favorites", Array.from(favorites.values()));
  ui.writeStore("recent", recent);
  function routeColor(object: IronObject) {
    const route = objectRouteId(object);
    if (!route) return null;
    const known = model.knownRoutes.find((r) => r.id === route);
    if (known) return model.routeColor(known.i).toHexString();
    const spec = SERVICE_SPECS.find((spec) => spec.id === route);
    return spec ? "var(--" + spec.color + ")" : null;
  }
  function updateStepper() {
    const o = model.state.object, index = results.findIndex((e) => e.key === key(o));
    $("it-object-prev").disabled = index <= 0;
    $("it-object-next").disabled = index < 0 || index >= results.length - 1;
    $("it-object-position").textContent = index >= 0
      ? (index + 1) + " / " + results.length + " matches"
      : "Selected in scene";
  }
  function updateSaved() {
    $("it-favorite-count").textContent = String(favorites.size);
    const o = model.state.object, saved = favorites.has(key(o));
    const button = $("it-save-selection");
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", (saved ? "Unsave " : "Save ") + titleOf(o));
    button.title = saved ? "Remove from Saved" : "Save object";
    button.disabled = o.kind === "overview";
    list.querySelectorAll<HTMLButtonElement>("[data-save-key]").forEach((b) => {
      const saved = favorites.has(required(b.dataset.saveKey));
      b.setAttribute("aria-pressed", String(saved));
      b.setAttribute("aria-label", (saved ? "Unsave " : "Save ") + b.dataset.title);
      b.title = saved ? "Remove from Saved" : "Save object";
    });
  }
  function updatePressed(scroll = false) {
    const active = key(model.state.object);
    list.querySelectorAll<HTMLButtonElement>("button[data-object-key]").forEach((b) => {
      const selected = b.dataset.objectKey === active;
      b.setAttribute("aria-pressed", String(selected));
      required(b.closest("li")).classList.toggle("is-active", selected);
      if (scroll && selected) b.scrollIntoView({ block: "nearest" });
    });
    updateSaved();
    updateStepper();
  }
  function toggleFavorite(object: IronObject) {
    const objectKey = key(object), removing = favorites.has(objectKey);
    if (removing) favorites.delete(objectKey);
    else favorites.set(objectKey, { ...object });
    const persisted = ui.writeStore("favorites", Array.from(favorites.values()));
    ui.notify(
      (removing
        ? "Removed from Saved: "
        : "Saved" + (persisted ? "" : " for this session") + ": ") + titleOf(object),
    );
    if (collection === "favorites") {
      const focusKey = document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.saveKey
        : undefined;
      const previousIndex = results.findIndex((e) => e.key === focusKey),
        scroll = $("it-results-disclosure").scrollTop;
      renderResults();
      $("it-results-disclosure").scrollTop = scroll;
      if (focusKey) {
        const button = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-save-key]")).find(
          (b) => b.dataset.saveKey === focusKey,
        );
        (button ||
          list.querySelectorAll<HTMLButtonElement>(
            "[data-object-key]",
          )[Math.min(Math.max(previousIndex, 0), results.length - 1)] || $("it-reset-filters"))
          .focus({ preventScroll: true });
      }
    } else updateSaved();
  }
  function activate(object: IronObject) {
    model.selectObject(object);
    if (ui.mobile.matches) {
      ui.setBrowser(false);
      ui.setPopup("it-advanced", false, false);
      ui.setPopup("it-help", false, false);
      $("it-canvas").focus({ preventScroll: true });
    }
  }
  function renderResults(resetScroll = false) {
    const query = normalize(search.value), tokens = query.split(" ").filter(Boolean);
    const source = collection === "favorites"
      ? Array.from(favorites.values()).map(entryFor)
      : collection === "recent"
      ? recent.map(entryFor)
      : catalog;
    results = source.filter((e) =>
      (category.value === "all" || e.group === category.value) && matches(e.search, tokens)
    );
    const relevance = (e: CatalogEntry) =>
      normalize(e.title) === query ? 0 : matches(normalize(e.title), tokens) ? 1 : 2;
    if (query) {
      results.sort((a, b) =>
        relevance(a) - relevance(b) || a.rank - b.rank || a.title.localeCompare(b.title)
      );
    }
    const extra = collection === "all" ? dynamicStation(query) : null;
    if (
      extra && (category.value === "all" || category.value === "stations") &&
      !results.some((e) => e.key === extra.key)
    ) results.unshift(extra);
    // Group discovery without obscuring the best matches during a search.
    let sections: { name: string; entries: CatalogEntry[] }[] = [];
    if (!query && collection === "all" && category.value === "all") {
      const featured = results.filter((e) => e.rank < 5);
      sections = [{ name: "Start exploring", entries: featured }].concat(
        groupOrder.map((group) => ({
          name: groupNames[group],
          entries: results.filter((e) => e.group === group && e.rank >= 5),
        })),
      );
      results = sections.flatMap((section) => section.entries);
    } else sections = [{ name: "", entries: results }];
    list.replaceChildren();
    for (const section of sections) {
      if (section.name && section.entries.length) {
        const heading = document.createElement("li");
        heading.className = "it-result-group";
        heading.textContent = section.name;
        list.append(heading);
      }
      for (const e of section.entries) {
        const li = document.createElement("li"),
          button = document.createElement("button"),
          glyph = document.createElement("span"),
          copy = document.createElement("span"),
          title = document.createElement("span"),
          meta = document.createElement("span"),
          save = document.createElement("button");
        li.className = "it-result-item";
        button.type = "button";
        button.className = "it-result-button";
        button.dataset.objectKey = e.key;
        button.setAttribute("aria-label", e.title + " · " + e.meta);
        button.addEventListener("click", () => activate(e.object));
        glyph.className = "it-result-icon";
        glyph.append(icon(groupIcons[e.group]));
        const color = routeColor(e.object);
        if (color) glyph.style.setProperty("--object-color", color);
        copy.className = "it-result-copy";
        title.className = "it-result-title";
        title.textContent = e.title;
        meta.className = "it-result-meta";
        meta.textContent = e.meta;
        copy.append(title, meta);
        button.append(glyph, copy);
        save.type = "button";
        save.className = "btn it-icon-button it-quiet it-result-save";
        save.dataset.saveKey = e.key;
        save.dataset.title = e.title;
        save.append(icon("star"));
        save.addEventListener("click", () => toggleFavorite(e.object));
        li.append(button, save);
        list.append(li);
      }
    }
    $("it-search-clear").hidden = !search.value;
    $("it-search-key").hidden = Boolean(search.value);
    $("it-result-count").textContent = results.length + " " +
      (results.length === 1 ? "object" : "objects");
    $("it-results-title").textContent = query
      ? "SEARCH RESULTS"
      : collection === "favorites"
      ? "SAVED PLACES"
      : collection === "recent"
      ? "RECENTLY VISITED"
      : category.value === "all"
      ? "POINTS OF INTEREST"
      : groupNames[category.value as Group].toUpperCase();
    const emptyCollection = source.length === 0 && collection !== "all";
    $("it-empty").hidden = results.length > 0;
    $("it-empty-title").textContent = emptyCollection
      ? collection === "favorites" ? "Your saved places" : "Your recent stops"
      : "No matching objects";
    $("it-empty-copy").textContent = emptyCollection
      ? collection === "favorites"
        ? "Use the star on an object to keep it here for a quick return."
        : "Select an object to start exploring. Your last 20 stops appear here."
      : "Try another category, a station number, a line name, or a yard letter.";
    $("it-reset-filters").textContent = emptyCollection ? "Explore all objects" : "Reset filters";
    document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.category === category.value))
    );
    document.querySelectorAll<HTMLButtonElement>("[data-collection]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.collection === collection))
    );
    $("it-catalog-count").textContent = catalog.length + " cataloged";
    if (resetScroll) $("it-results-disclosure").scrollTop = 0;
    updatePressed();
  }
  function serviceStops(id: string): IronObject[] {
    return serviceConnections(id).filter((object) => isObjectAvailable(object, registry));
  }
  function connectionObjects(o: IronObject | null): IronObject[] {
    if (!o) return [];
    if (o.kind === "node") {
      const n = model.nodes[o.id],
        connections: IronObject[] = required(n).lines.map((id) => ({
          kind: "route",
          id,
        }));
      Object.keys(model.namedRoutes).forEach((id) => {
        if (serviceStops(id).some((p) => p.kind === "node" && p.id === o.id)) {
          connections.push({ kind: "route", id });
        }
      });
      return connections;
    }
    if (o.kind === "yard") {
      return SERVICE_SPECS.filter((spec) =>
        spec.stops.some((stop) =>
          stop.target.kind === "yard" && stop.target.id === o.id && stop.target.face === o.face
        )
      ).map((spec): IronObject => ({ kind: "train", id: spec.id }));
    }
    if (o.kind === "landmark") {
      const connections = LANDMARK_SPECS.find((spec) => spec.id === o.id)?.connections ?? [];
      return o.id === "logo"
        ? SERVICE_SPECS.map((spec): IronObject => ({ kind: "route", id: spec.id })).concat(
          connections,
        )
        : connections;
    }
    const id = objectRouteId(o);
    if (!id) return [];
    if (o.kind === "stop") return [{ kind: "route", id }];
    if (o.kind === "route" || o.kind === "train" || o.kind === "station") {
      if (model.namedRoutes[id]) {
        return [{ kind: o.kind === "train" ? "route" : "train", id }, ...serviceStops(id)];
      }
      const route = model.knownRoutes.find((r) => r.id === id);
      if (!route) return [];
      return [
        ...route.namedNodes.map((n): IronObject => ({
          kind: "node",
          id: required(Object.keys(model.nodes).find((k) => model.nodes[k] === n)),
        })),
        ...PRIMARY_STAIRWELL_STATIONS.map((n): IronObject => ({
          kind: "station",
          route: id,
          n,
        })),
      ];
    }
    return [];
  }
  function connectionLabel(o: IronObject) {
    if (o.kind === "route" && model.namedRoutes[o.id]) {
      return "View " + required(model.namedRoutes[o.id]).name + " route";
    }
    if (o.kind === "train") return "Locate " + model.objectTitle(o);
    if (o.kind === "station" && isPrimaryStairwellStation(o.n)) return "Stairwell " + o.n;
    if (o.kind === "stop") return o.label;
    if (o.kind === "node") {
      const n = model.nodes[o.id];
      return required(n).lines.length
        ? required(n).n + " · " +
          required(n).lines.map((id) => model.objectTitle({ kind: "route", id })).join(" / ")
        : required(n).label;
    }
    return model.objectTitle(o);
  }

  function updateSelection(object: IronObject, record = true) {
    const o: IronObject = object || { kind: "overview", view: "whole" };
    if (record && !restoring && key(history[historyIndex]) !== key(o)) {
      history = history.slice(0, historyIndex + 1);
      history.push({ ...o });
      historyIndex = history.length - 1;
    }
    if (record && o.kind !== "overview") {
      recent = [{ ...o }, ...recent.filter((p) => key(p) !== key(o))].slice(0, 20);
      ui.writeStore("recent", recent);
    }
    $("it-selected-title").textContent = titleOf(o);
    const group = o.kind === "node" || o.kind === "station" || o.kind === "stop"
      ? "stations"
      : o.kind === "train"
      ? "trains"
      : o.kind === "yard"
      ? "yards"
      : o.kind === "mimic"
      ? "bosses"
      : o.kind === "landmark"
      ? "landmarks"
      : o.kind === "route"
      ? "lines"
      : null;
    $("it-selected-kind").textContent = o.kind === "route" && model.namedRoutes[o.id]
      ? "Train route"
      : (group ? categories[group] : "Overview");
    $("it-focus").disabled = o.kind === "overview";
    ["it-back", "it-back-mobile"].forEach((id) => {
      $(id).disabled = historyIndex === 0;
    });
    ["it-forward", "it-forward-mobile"].forEach((id) => {
      $(id).disabled = historyIndex >= history.length - 1;
    });
    $("it-connections").replaceChildren();
    const connected = connectionObjects(o).filter((object) => isObjectAvailable(object, registry));
    $("it-connection-group").hidden = connected.length === 0;
    $("it-connections-label").textContent = o.kind === "node"
      ? "CONNECTED ROUTES"
      : o.kind === "route" || o.kind === "train"
      ? "STOPS & CONNECTIONS"
      : "EXPLORE CONNECTIONS";
    connected.forEach((connection) => {
      const button = document.createElement("button");
      button.className = "btn";
      button.type = "button";
      const label = connectionLabel(connection);
      button.append(
        icon(
          connection.kind === "route"
            ? "line"
            : connection.kind === "train"
            ? "train"
            : connection.kind === "yard"
            ? "yard"
            : "station",
        ),
        document.createTextNode(label),
      );
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => activate(connection));
      $("it-connections").append(button);
    });
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === model.state.currentView))
    );
    $("it-station-hint").textContent = $("it-station").disabled
      ? "Select a colored line to jump to stations 10–436."
      : "Jump to any numbered stop on the selected line (10–436).";
    ui.showSelection(o.kind !== "overview", titleOf(o));
    updatePressed(record && !ui.mobile.matches);
  }
  function revisit(delta: number) {
    const next = historyIndex + delta;
    if (next < 0 || next >= history.length) return;
    historyIndex = next;
    restoring = true;
    try {
      activate(required(history[historyIndex]));
    } finally {
      restoring = false;
    }
  }
  function stepObject(delta: number) {
    const index = results.findIndex((e) => e.key === key(model.state.object)),
      next = results[index + delta];
    if (index >= 0 && next) activate(next.object);
  }
  function resultButtons() {
    return Array.from(list.querySelectorAll<HTMLButtonElement>("[data-object-key]"));
  }
  function resetFilters() {
    search.value = "";
    category.value = "all";
    collection = "all";
    renderResults(true);
  }
  root.addEventListener(
    "iron:selection",
    (event) => updateSelection((event as CustomEvent<IronObject>).detail),
    { signal: lifecycle.signal },
  );
  function reconcileDefinitions() {
    registry = createObjectRegistry();
    const saved = reconcileObjects(Array.from(favorites.values()), registry);
    favorites.clear();
    saved.forEach((object) => favorites.set(key(object), object));
    recent = reconcileObjects(recent, registry).slice(0, 20);
    const reconciled = reconcileHistory(history, historyIndex, registry);
    history = reconciled.items;
    historyIndex = reconciled.index;
    ui.writeStore("favorites", saved);
    ui.writeStore("recent", recent);
    if (!isObjectAvailable(model.state.object, registry)) {
      model.selectObject(
        history[historyIndex] ?? { kind: "overview", view: "whole" },
        false,
        false,
      );
    }
    rebuildCatalog();
    renderResults();
    updateSelection(model.state.object, false);
  }
  root.addEventListener("iron:definitions-changed", reconcileDefinitions, {
    signal: lifecycle.signal,
  });
  root.addEventListener("iron:objects-changed", () => {
    rebuildCatalog();
    renderResults();
  }, { signal: lifecycle.signal });
  search.addEventListener("input", () => renderResults(true), { signal: lifecycle.signal });
  category.addEventListener("change", () => renderResults(true), { signal: lifecycle.signal });
  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) =>
    button.addEventListener("click", () => {
      category.value = required(button.dataset.category);
      renderResults(true);
    }, { signal: lifecycle.signal })
  );
  document.querySelectorAll<HTMLButtonElement>("[data-collection]").forEach((button) =>
    button.addEventListener("click", () => {
      collection = required(button.dataset.collection);
      renderResults(true);
    }, { signal: lifecycle.signal })
  );
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) =>
    button.addEventListener("click", () => {
      $("it-view").value = required(button.dataset.view);
      $("it-view").dispatchEvent(new Event("change"));
      const picker = $("it-cutaway-picker"), fromMenu = picker.contains(button);
      picker.open = false;
      if (fromMenu) query("summary", picker).focus({ preventScroll: true });
    }, { signal: lifecycle.signal })
  );
  $("it-search-clear").addEventListener("click", () => {
    search.value = "";
    renderResults(true);
    search.focus();
  }, { signal: lifecycle.signal });
  $("it-reset-filters").addEventListener("click", () => {
    resetFilters();
    search.focus();
  }, { signal: lifecycle.signal });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (results[0]) activate(results[0].object);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const buttons = resultButtons();
      (event.key === "ArrowDown" ? buttons[0] : buttons.at(-1))?.focus();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (search.value) {
        search.value = "";
        renderResults(true);
      } else ui.setBrowser(false, true);
    }
  }, { signal: lifecycle.signal });
  list.addEventListener("keydown", (event) => {
    const buttons = resultButtons(), index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next;
    if (event.key === "ArrowDown") next = Math.min(index + 1, buttons.length - 1);
    else if (event.key === "ArrowUp") {
      if (index === 0) {
        event.preventDefault();
        search.focus();
        return;
      }
      next = index - 1;
    } else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      required(buttons[next]).focus();
    }
  }, { signal: lifecycle.signal });
  $("it-back").addEventListener("click", () => revisit(-1), { signal: lifecycle.signal });
  $("it-forward").addEventListener("click", () => revisit(1), { signal: lifecycle.signal });
  $("it-back-mobile").addEventListener("click", () => revisit(-1), { signal: lifecycle.signal });
  $("it-forward-mobile").addEventListener("click", () => revisit(1), { signal: lifecycle.signal });
  $("it-object-prev").addEventListener("click", () => stepObject(-1), { signal: lifecycle.signal });
  $("it-object-next").addEventListener("click", () => stepObject(1), { signal: lifecycle.signal });
  $("it-focus").addEventListener("click", () => model.focusSelection(), {
    signal: lifecycle.signal,
  });
  $("it-save-selection").addEventListener("click", () => {
    if (model.state.object.kind !== "overview") toggleFavorite(model.state.object);
  }, { signal: lifecycle.signal });
  $("it-overview").addEventListener("click", () => model.showOverview(), {
    signal: lifecycle.signal,
  });
  $("it-zoom-in").addEventListener("click", () => model.zoom(.8), { signal: lifecycle.signal });
  $("it-zoom-out").addEventListener("click", () => model.zoom(1.25), { signal: lifecycle.signal });
  globalThis.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented || event.ctrlKey || event.metaKey ||
      (event.target instanceof HTMLElement && event.target.isContentEditable) ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target instanceof Element ? event.target.tagName : "")
    ) return;
    if (event.altKey) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        revisit(event.key === "ArrowLeft" ? -1 : 1);
      }
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      model.showOverview();
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      model.zoom(.8);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      model.zoom(1.25);
    }
  }, { signal: lifecycle.signal });
  renderResults();
  updateSelection(model.state.object, false);
  root.__ironNavigation = {
    catalog,
    search: (query: string) => {
      search.value = query;
      collection = "all";
      category.value = "all";
      ui.setBrowser(true);
      renderResults(true);
    },
    get results() {
      return results;
    },
    get favorites() {
      return Array.from(favorites.values());
    },
    get recent() {
      return recent;
    },
    get history() {
      return { items: history, index: historyIndex };
    },
  };
}
