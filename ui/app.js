const $ = (id) => document.getElementById(id);
let data = {
  entries: [],
  computer: true,
  places: [],
  drives: [],
  breadcrumbs: [],
};
let settings = { labels: [], defaults: [] };
let platform = "";
let selection = new Set(),
  active = null,
  viewer = null,
  anchor = 0;
let mutation = Promise.resolve();
const expanded = new Set(),
  treeCache = new Map(),
  treeLoading = new Set();
let errorTimer;

function fail(error) {
  $("error").textContent = error.message || String(error);
  $("error").hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    $("error").hidden = true;
  }, 8000);
}
async function run(fn) {
  try {
    return await fn();
  } catch (error) {
    fail(error);
  }
}
function button(text, action, className = "") {
  const element = document.createElement("button");
  element.textContent = text;
  element.className = className;
  element.addEventListener("click", action);
  return element;
}
function keyPath(value) {
  const trimmed = value.replace(/[\\/]+$/, "");
  return platform === "win32" ? trimmed.toLowerCase() : trimmed;
}
function visible() {
  const query = $("search").value.toLocaleLowerCase("pt-BR");
  return data.entries.filter(
    (e) =>
      e.name.toLocaleLowerCase("pt-BR").includes(query) &&
      ($("filter").value === "all" ||
        (!e.folder && (e.rating || 0) === Number($("filter").value))),
  );
}
function labelInfo(id) {
  return settings.labels.find((label) => label.id === id);
}
function chosenFiles() {
  const ids = viewer
    ? [viewer.ids[viewer.index]].filter(Boolean)
    : [...selection];
  return ids.filter((id) => data.entries.some((e) => e.id === id && !e.folder));
}
function focusGrid() {
  $("grid").focus({ preventScroll: true });
}
function accept(next) {
  if (!next) return;
  const changed = data.folder !== next.folder;
  data = next;
  if (data.computer) {
    data.entries = [...data.drives, ...data.places].map((location) => ({
      id: "location:" + location.path,
      name: location.name,
      folder: true,
      target: location.path,
    }));
  }
  if (changed) {
    selection.clear();
    active = null;
    anchor = 0;
    $("search").value = "";
    $("filter").value = "all";
  } else
    selection = new Set(
      [...selection].filter((id) => data.entries.some((e) => e.id === id)),
    );
  $("address").value = data.computer ? "Este Computador" : data.folder;
  $("back").disabled = !data.canBack;
  $("forward").disabled = !data.canForward;
  $("up").disabled = Boolean(data.computer);
  $("refresh").disabled = false;
  $("rename").disabled = Boolean(data.computer);
  $("review").disabled = Boolean(data.computer);
  renderBreadcrumbs();
  renderPlaces();
  renderTree();
  renderGrid();
  if (viewer) drawViewer();
  if (changed && !data.computer) expandCurrentBranch(data.folder);
}
async function navigate(address) {
  accept(await bridge.navigate(address));
  focusGrid();
}
async function historyMove(direction) {
  accept(await bridge[direction]());
  focusGrid();
}
function renderBreadcrumbs() {
  $("breadcrumbs").replaceChildren(
    button("Este Computador", () => run(() => navigate("computer"))),
  );
  for (const crumb of data.breadcrumbs || []) {
    const separator = document.createElement("span");
    separator.textContent = "›";
    $("breadcrumbs").append(
      separator,
      button(crumb.name, () => run(() => navigate(crumb.path))),
    );
  }
}
function renderPlaces() {
  $("places").replaceChildren();
  for (const place of data.places || []) {
    const item = button("▸ " + place.name, () =>
      run(() => navigate(place.path)),
    );
    item.title = place.path;
    $("places").append(item);
  }
}
async function loadChildren(folder) {
  const key = keyPath(folder);
  if (treeLoading.has(key)) return;
  treeLoading.add(key);
  renderTree();
  try {
    treeCache.set(key, { children: await bridge.children(folder) });
  } catch (error) {
    treeCache.set(key, { error: "Pasta indisponível ou sem permissão." });
  } finally {
    treeLoading.delete(key);
    renderTree();
  }
}
async function expandCurrentBranch(folder) {
  const crumbs = [...data.breadcrumbs];
  for (const crumb of crumbs.slice(0, -1)) {
    if (data.folder !== folder) return;
    const key = keyPath(crumb.path);
    expanded.add(key);
    if (!treeCache.has(key)) await loadChildren(crumb.path);
  }
  renderTree();
  $("tree").querySelector(".current")?.scrollIntoView({ block: "nearest" });
}
function renderTree() {
  const target = $("tree");
  target.replaceChildren();
  function addNode(location, container, depth) {
    if (depth > 40) return;
    const key = keyPath(location.path),
      isExpanded = expanded.has(key);
    const row = document.createElement("div");
    row.className = "treeRow";
    if (!data.computer && keyPath(data.folder) === key)
      row.classList.add("current");
    const toggle = button(
      treeLoading.has(key) ? "…" : isExpanded ? "▾" : "▸",
      () => {
        if (expanded.has(key)) expanded.delete(key);
        else {
          expanded.add(key);
          if (!treeCache.has(key)) loadChildren(location.path);
        }
        renderTree();
      },
      "expand",
    );
    toggle.setAttribute("aria-label", "Expandir " + location.name);
    toggle.setAttribute("aria-expanded", String(isExpanded));
    const name = button(
      (depth ? "📁 " : "▣ ") + location.name,
      () => run(() => navigate(location.path)),
      "treeName",
    );
    name.title = location.path;
    row.append(toggle, name);
    container.append(row);
    if (isExpanded) {
      const children = document.createElement("div");
      children.className = "treeChildren";
      const cached = treeCache.get(key);
      if (cached?.error) {
        const error = document.createElement("p");
        error.className = "treeError";
        error.textContent = cached.error;
        children.append(error);
      } else
        for (const child of cached?.children || [])
          addNode(child, children, depth + 1);
      container.append(children);
    }
  }
  for (const drive of data.drives || []) addNode(drive, target, 0);
}
function renderGrid() {
  const grid = $("grid");
  grid.replaceChildren();
  const entries = visible();
  for (const [index, entry] of entries.entries()) {
    const tile = document.createElement("article");
    tile.className = "tile" + (selection.has(entry.id) ? " selected" : "");
    tile.dataset.id = entry.id;
    if (entry.photo) {
      const img = document.createElement("img");
      img.src = "photo://" + entry.id;
      img.loading = "lazy";
      img.alt = entry.name;
      tile.append(img);
    } else {
      const icon = document.createElement("div");
      icon.className = "placeholder";
      icon.textContent = entry.folder ? "📁" : "▧";
      tile.append(icon);
    }
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = entry.name;
    name.title = entry.name;
    tile.append(name);
    if (!entry.folder) {
      const rating = document.createElement("div");
      rating.className = "rating";
      rating.textContent =
        entry.rating === -1
          ? "Rejeitada"
          : "★".repeat(entry.rating || 0) || "☆☆☆☆☆";
      if (entry.label) {
        const label = labelInfo(entry.label),
          badge = document.createElement("span");
        badge.className = "label";
        badge.style.background = label?.color || "#aab1bc";
        badge.textContent = label?.name || entry.label;
        rating.append(" ", badge);
      }
      tile.append(rating);
    }
    tile.addEventListener("click", (event) => {
      if (event.shiftKey) {
        for (const item of entries.slice(
          Math.min(anchor, index),
          Math.max(anchor, index) + 1,
        ))
          selection.add(item.id);
      } else if (event.ctrlKey || event.metaKey) {
        selection.has(entry.id)
          ? selection.delete(entry.id)
          : selection.add(entry.id);
        anchor = index;
      } else {
        selection = new Set([entry.id]);
        anchor = index;
      }
      active = entry.id;
      renderSelection();
      focusGrid();
    });
    tile.addEventListener("dblclick", () => {
      if (entry.folder)
        run(async () => {
          if (entry.target) await navigate(entry.target);
          else {
            accept(await bridge.folder(entry.id));
            focusGrid();
          }
        });
      else {
        active = entry.id;
        show(false);
      }
    });
    tile.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      if (entry.folder) return;
      if (!selection.has(entry.id)) selection = new Set([entry.id]);
      active = entry.id;
      renderSelection();
      openMenu(event.clientX, event.clientY);
    });
    grid.append(tile);
  }
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = data.computer
      ? "Nenhuma unidade disponível. Digite um caminho na barra de endereço."
      : "Nenhum arquivo corresponde a esta visualização.";
    grid.append(empty);
  }
  renderSelection();
}
function renderSelection() {
  for (const tile of $("grid").querySelectorAll(".tile"))
    tile.classList.toggle("selected", selection.has(tile.dataset.id));
  const entry = data.entries.find((e) => selection.has(e.id));
  $("status").textContent =
    `${visible().length} itens • ${selection.size} selecionados`;
  $("details").textContent =
    selection.size === 1
      ? entry.name
      : `${selection.size} arquivos selecionados`;
  const values = [...selection].map(
    (id) => data.entries.find((e) => e.id === id)?.label || "",
  );
  $("label").value =
    values.length && values.every((value) => value === values[0])
      ? values[0]
      : "";
}
function applyMetadata(patch) {
  const ids = chosenFiles();
  if (!ids.length) return Promise.resolve();
  const task = mutation.then(async () => accept(await bridge.rate(ids, patch)));
  mutation = task.catch(() => {});
  return task;
}
function labelButton(label, action) {
  const item = button("", action, "labelButton");
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = label.color;
  const name = document.createElement("span");
  name.className = "labelName";
  name.textContent = label.name;
  const key = document.createElement("kbd");
  key.textContent = label.shortcut;
  item.title = `${label.name}${label.shortcut ? " · " + label.shortcut : ""}`;
  item.append(swatch, name, key);
  return item;
}
function renderLabels() {
  $("label").replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Sem rótulo";
  $("label").append(empty);
  $("labelButtons").replaceChildren();
  $("viewerLabels").replaceChildren();
  $("shortcutHelp").replaceChildren();
  for (const label of settings.labels) {
    const option = document.createElement("option");
    option.value = label.id;
    option.textContent =
      label.name + (label.shortcut ? " · " + label.shortcut : "");
    $("label").append(option);
    const action = () => run(() => applyMetadata({ label: label.id }));
    $("labelButtons").append(labelButton(label, action));
    $("viewerLabels").append(labelButton(label, action));
    const help = document.createElement("p");
    help.textContent = `${label.shortcut || "Sem tecla"} · ${label.name}`;
    $("shortcutHelp").append(help);
  }
}
function show(review) {
  let photos = visible().filter((entry) => entry.photo);
  const selectedPhotos = photos.filter((entry) => selection.has(entry.id));
  // A lone selected thumbnail is the starting point, not a one-photo review set.
  if (review && selectedPhotos.length > 1) photos = selectedPhotos;
  if (!photos.length)
    return fail(
      Error("Esta pasta não tem imagens compatíveis para visualizar."),
    );
  viewer = {
    review,
    ids: photos.map((entry) => entry.id),
    index: Math.max(
      0,
      photos.findIndex((entry) => entry.id === active),
    ),
    history: [],
  };
  $("viewer").hidden = false;
  $("viewer").focus();
  run(() => bridge.fullscreen(true));
  drawViewer();
}
function movePhoto(delta) {
  if (!viewer || !viewer.ids.length) return;
  viewer.index = (viewer.index + delta + viewer.ids.length) % viewer.ids.length;
  drawViewer();
}
function removeFromReview() {
  if (!viewer?.review || !viewer.ids.length) return;
  viewer.history.push({ id: viewer.ids[viewer.index], index: viewer.index });
  viewer.ids.splice(viewer.index, 1);
  viewer.index = Math.min(viewer.index, Math.max(0, viewer.ids.length - 1));
  drawViewer();
}
function restoreReview() {
  if (!viewer?.review || !viewer.history.length) return;
  const last = viewer.history.pop();
  viewer.ids.splice(last.index, 0, last.id);
  viewer.index = last.index;
  drawViewer();
}
function drawViewer() {
  if (!viewer) return;
  const v = viewer;
  $("mode").textContent = v.review ? "REVISÃO" : "TELA CHEIA";
  $("carousel").replaceChildren();
  function add(index, className) {
    const entry = data.entries.find((e) => e.id === v.ids[index]);
    if (!entry) return;
    const img = document.createElement("img");
    img.src = "photo://" + entry.id;
    img.alt = entry.name;
    img.className = className;
    if (className === "side")
      img.onclick = () => {
        viewer.index = index;
        drawViewer();
        $("viewer").focus();
      };
    $("carousel").append(img);
  }
  if (v.ids.length) {
    if (v.review && v.index > 0) add(v.index - 1, "side");
    add(v.index, v.review ? "center" : "");
    if (v.review && v.index < v.ids.length - 1) add(v.index + 1, "side");
    const entry = data.entries.find((e) => e.id === v.ids[v.index]);
    const label = labelInfo(entry.label);
    $("caption").textContent =
      `${v.index + 1} / ${v.ids.length} · ${entry.name} ${"★".repeat(entry.rating > 0 ? entry.rating : 0)}${label ? " · " + label.name : ""}`;
  } else
    $("caption").textContent = "Nenhuma foto na revisão. ↑ para restaurar.";
  $("previousPhoto").disabled = v.ids.length < 2;
  $("nextPhoto").disabled = v.ids.length < 2;
  $("removeReview").hidden = !v.review;
  $("restoreReview").hidden = !v.review;
  $("removeReview").disabled = !v.ids.length;
  $("restoreReview").disabled = !v.history.length;
  $("hint").textContent = v.review
    ? "← → Navegar • ↓ Tirar da seleção • ↑ Restaurar • Teclas de rótulo classificam a foto atual • Esc Voltar"
    : "← → Navegar • Teclas de rótulo classificam a foto atual • Esc Voltar";
}
function closeViewer() {
  if (viewer?.review) selection = new Set(viewer.ids);
  if (viewer?.ids.length) active = viewer.ids[viewer.index];
  viewer = null;
  run(() => bridge.fullscreen(false));
  $("viewer").hidden = true;
  renderGrid();
  focusGrid();
}
function openMenu(x, y) {
  const menu = $("fileMenu");
  menu.replaceChildren();
  for (let rating = 0; rating <= 5; rating++)
    menu.append(
      button(
        rating
          ? "★".repeat(rating) + "     Ctrl+" + rating
          : "Sem classificação     Ctrl+0",
        () => {
          menu.hidden = true;
          run(() => applyMetadata({ rating }));
        },
      ),
    );
  menu.append(document.createElement("hr"));
  menu.append(
    button("Sem rótulo", () => {
      menu.hidden = true;
      run(() => applyMetadata({ label: "" }));
    }),
  );
  for (const label of settings.labels)
    menu.append(
      labelButton(label, () => {
        menu.hidden = true;
        run(() => applyMetadata({ label: label.id }));
      }),
    );
  menu.hidden = false;
  menu.style.left =
    Math.max(0, Math.min(x, innerWidth - menu.offsetWidth - 8)) + "px";
  menu.style.top =
    Math.max(0, Math.min(y, innerHeight - menu.offsetHeight - 8)) + "px";
}
function settingsRows(labels) {
  $("settingsRows").replaceChildren();
  $("settingsError").textContent = "";
  for (const label of labels) {
    const row = document.createElement("div");
    row.className = "settingsRow";
    row.dataset.id = label.id;
    const color = document.createElement("span");
    color.className = "swatch";
    color.style.background = label.color;
    const name = document.createElement("input");
    name.value = label.name;
    name.maxLength = 60;
    name.className = "labelNameInput";
    name.setAttribute("aria-label", "Nome do rótulo " + label.id);
    const shortcut = document.createElement("input");
    shortcut.value = label.shortcut;
    shortcut.readOnly = true;
    shortcut.className = "shortcutInput";
    shortcut.placeholder = "Clique e pressione a tecla";
    shortcut.setAttribute("aria-label", "Atalho do rótulo " + label.id);
    shortcut.addEventListener("keydown", (event) => {
      if (event.key === "Tab") return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Backspace" || event.key === "Delete") {
        shortcut.value = "";
        $("settingsError").textContent = "";
        return;
      }
      const chord = shortcuts.fromEvent(event);
      if (!chord) return;
      try {
        shortcut.value = shortcuts.normalize(chord);
        $("settingsError").textContent = "";
      } catch (error) {
        $("settingsError").textContent = error.message;
      }
    });
    row.append(color, name, shortcut);
    $("settingsRows").append(row);
  }
}
$("preferences").onclick = () => {
  settingsRows(settings.labels);
  $("settingsDialog").showModal();
};
$("resetSettings").onclick = () => settingsRows(settings.defaults);
$("cancelSettings").onclick = () => {
  $("settingsDialog").close();
  focusGrid();
};
$("saveSettings").onclick = async () => {
  $("saveSettings").disabled = true;
  try {
    const labels = [...$("settingsRows").children].map((row) => ({
      id: row.dataset.id,
      name: row.querySelector(".labelNameInput").value,
      shortcut: row.querySelector(".shortcutInput").value,
    }));
    settings = await bridge.saveSettings(labels);
    renderLabels();
    renderGrid();
    $("settingsDialog").close();
    focusGrid();
  } catch (error) {
    $("settingsError").textContent = error.message;
  } finally {
    $("saveSettings").disabled = false;
  }
};
$("open").onclick = () =>
  run(async () => {
    accept(await bridge.open());
    focusGrid();
  });
$("computer").onclick = () => run(() => navigate("computer"));
$("back").onclick = () => run(() => historyMove("back"));
$("forward").onclick = () => run(() => historyMove("forward"));
$("up").onclick = () => run(() => historyMove("up"));
$("refresh").onclick = () =>
  run(async () => {
    treeCache.clear();
    accept(await bridge.refresh());
    focusGrid();
  });
$("go").onclick = () => run(() => navigate($("address").value));
$("address").onkeydown = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    run(() => navigate($("address").value));
  }
};
$("search").oninput = renderGrid;
$("filter").onchange = renderGrid;
$("review").onclick = () => show(true);
$("close").onclick = closeViewer;
$("previousPhoto").onclick = () => movePhoto(-1);
$("nextPhoto").onclick = () => movePhoto(1);
$("removeReview").onclick = removeFromReview;
$("restoreReview").onclick = restoreReview;
$("size").oninput = () => {
  $("grid").style.gridTemplateColumns =
    `repeat(auto-fill,minmax(${$("size").value}px,1fr))`;
};
for (let i = 1; i <= 5; i++)
  $("stars").append(
    button(i + "★", () => run(() => applyMetadata({ rating: i }))),
  );
$("reject").onclick = () => run(() => applyMetadata({ rating: -1 }));
$("clear").onclick = () => run(() => applyMetadata({ rating: 0 }));
$("label").onchange = () =>
  run(() => applyMetadata({ label: $("label").value }));
$("rename").onclick = () => {
  if (!chosenFiles().length)
    return fail(Error("Selecione os arquivos primeiro."));
  $("plan").textContent = "Clique em Visualizar para conferir os nomes.";
  $("apply").disabled = true;
  $("batch").showModal();
};
for (const id of ["prefix", "start", "padding"])
  $(id).oninput = () => {
    $("apply").disabled = true;
  };
$("preview").onclick = () =>
  run(async () => {
    $("apply").disabled = true;
    const rows = await bridge.preview(
      data.entries
        .filter((e) => selection.has(e.id) && !e.folder)
        .map((e) => e.id),
      Number($("start").value),
      Number($("padding").value),
      $("prefix").value,
    );
    $("plan").textContent = rows
      .map((row) => row.old + "  →  " + row.name)
      .join("\n");
    $("apply").disabled = !rows.length;
  });
$("apply").onclick = () =>
  run(async () => {
    $("apply").disabled = true;
    accept(await bridge.rename());
    selection.clear();
    renderGrid();
    $("batch").close();
    focusGrid();
  });
$("cancel").onclick = () => {
  $("batch").close();
  focusGrid();
};
document.addEventListener("pointerdown", (event) => {
  if (!$("fileMenu").contains(event.target)) $("fileMenu").hidden = true;
});
function handled(event) {
  event.preventDefault();
  event.stopPropagation();
}
document.addEventListener(
  "keydown",
  (event) => {
    if ($("settingsDialog").open || $("batch").open) return;
    const chord = shortcuts.fromEvent(event);
    if (viewer) {
      // Viewer controls always win over focus left on a select/button behind the overlay.
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "ArrowDown",
          "ArrowUp",
          "Escape",
          " ",
        ].includes(event.key)
      ) {
        handled(event);
        if (event.key === "Escape" || event.key === " ") closeViewer();
        else if (event.key === "ArrowLeft") movePhoto(-1);
        else if (event.key === "ArrowRight") movePhoto(1);
        else if (event.key === "ArrowDown") removeFromReview();
        else if (event.key === "ArrowUp") restoreReview();
        return;
      }
    } else {
      const editing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName);
      if (chord === "Ctrl+L") {
        handled(event);
        $("address").focus();
        $("address").select();
        return;
      }
      if (chord === "Ctrl+B" && !/INPUT|TEXTAREA/.test(event.target.tagName)) {
        handled(event);
        show(true);
        return;
      }
      if (editing) return;
      if (event.key === "Escape") {
        $("fileMenu").hidden = true;
        return;
      }
      if (event.key === " ") {
        handled(event);
        show(false);
        return;
      }
      if (chord === "Ctrl+A") {
        handled(event);
        selection = new Set(
          visible()
            .filter((e) => !e.folder)
            .map((e) => e.id),
        );
        renderSelection();
        return;
      }
      if (["Alt+ArrowLeft", "Alt+ArrowRight", "Alt+ArrowUp"].includes(chord)) {
        handled(event);
        run(() =>
          historyMove(
            chord === "Alt+ArrowLeft"
              ? "back"
              : chord === "Alt+ArrowRight"
                ? "forward"
                : "up",
          ),
        );
        return;
      }
      if (chord === "F5" || chord === "Ctrl+R") {
        handled(event);
        $("refresh").click();
        return;
      }
      if (chord === "Ctrl+O") {
        handled(event);
        $("open").click();
        return;
      }
      if (
        !event.ctrlKey &&
        !event.altKey &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        handled(event);
        const entries = visible();
        if (!entries.length) return;
        const columns = Math.max(
          1,
          getComputedStyle($("grid")).gridTemplateColumns.split(" ").length,
        );
        const delta = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -columns,
          ArrowDown: columns,
        }[event.key];
        const index = Math.max(
          0,
          Math.min(
            entries.length - 1,
            Math.max(
              0,
              entries.findIndex((e) => e.id === active),
            ) + delta,
          ),
        );
        active = entries[index].id;
        selection = new Set([active]);
        anchor = index;
        renderSelection();
        $("grid")
          .querySelectorAll(".tile")
          [index]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (event.key === "Enter" && active) {
        const entry = data.entries.find((e) => e.id === active);
        if (entry?.folder) {
          handled(event);
          run(async () => {
            if (entry.target) await navigate(entry.target);
            else {
              accept(await bridge.folder(entry.id));
              focusGrid();
            }
          });
        } else if (entry?.photo) {
          handled(event);
          show(false);
        }
        return;
      }
    }
    const label = settings.labels.find(
      (item) => item.shortcut && item.shortcut === chord,
    );
    if (label) {
      handled(event);
      run(() => applyMetadata({ label: label.id }));
      return;
    }
    if (/^Ctrl\+[0-5]$/.test(chord || "")) {
      handled(event);
      run(() => applyMetadata({ rating: Number(chord.slice(-1)) }));
    }
  },
  true,
);
run(async () => {
  const initial = await bridge.bootstrap();
  settings = initial.settings;
  platform = initial.platform;
  renderLabels();
  accept(initial.library);
  focusGrid();
});
