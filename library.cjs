const { DEFAULT_LABELS } = require("./preferences.cjs");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
class Library {
  constructor(store) {
    this.store = store;
    this.entries = new Map();
    this.meta = {};
  }
  async init() {
    await fs.mkdir(path.dirname(this.store), { recursive: true });
    try {
      this.meta = JSON.parse(await fs.readFile(this.store, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  async open(folder) {
    this.root = await fs.realpath(folder);
    return this.list(this.root);
  }
  async list(folder) {
    const dir = await fs.realpath(folder);
    const relative = path.relative(this.root, dir);
    if (
      relative === ".." ||
      relative.startsWith(".." + path.sep) ||
      path.isAbsolute(relative)
    )
      throw Error("Pasta fora da biblioteca.");
    const items = await fs.readdir(dir, { withFileTypes: true });
    const result = [],
      entries = new Map();
    for (const d of items) {
      if (
        d.isSymbolicLink() ||
        (!d.isFile() && !d.isDirectory()) ||
        /^(thumbs\.db|desktop\.ini)$/i.test(d.name) ||
        d.name.startsWith(".bridgeimagine-")
      )
        continue;
      const p = path.join(dir, d.name);
      let stat;
      try {
        stat = await fs.stat(p);
      } catch (e) {
        if (["ENOENT", "EACCES", "EPERM", "EBUSY"].includes(e.code)) continue;
        throw e;
      }
      const id = crypto.createHash("sha256").update(p).digest("hex");
      const metadata = { ...this.meta[p] };
      const legacy = DEFAULT_LABELS.find(
        (label) => label.name === metadata.label,
      );
      if (legacy) metadata.label = legacy.id;
      const e = {
        id,
        name: d.name,
        folder: d.isDirectory(),
        size: stat.size,
        mtime: stat.mtimeMs,
        ino: stat.ino,
        dev: stat.dev,
        photo: /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(d.name),
        ...metadata,
      };
      entries.set(id, { ...e, path: p });
      result.push(e);
    }
    result.sort(
      (a, b) =>
        Number(b.folder) - Number(a.folder) ||
        a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
    );
    this.current = dir;
    this.entries = entries;
    return {
      folder: dir,
      parent: dir === this.root ? null : path.dirname(dir),
      entries: result,
    };
  }

  get(id) {
    const e = this.entries.get(id);
    if (!e) throw Error("Arquivo não está mais disponível. Atualize a pasta.");
    return e;
  }
  async rate(ids, patch) {
    if (this.busy) throw Error("Operação em andamento.");
    if (
      !patch ||
      (!Object.hasOwn(patch, "rating") && !Object.hasOwn(patch, "label")) ||
      Object.keys(patch).some((k) => !["rating", "label"].includes(k)) ||
      ("rating" in patch &&
        (!Number.isInteger(patch.rating) ||
          patch.rating < -1 ||
          patch.rating > 5)) ||
      ("label" in patch &&
        !["", ...DEFAULT_LABELS.map((l) => l.id)].includes(patch.label))
    )
      throw Error("Classificação inválida.");
    this.busy = true;
    try {
      for (const id of ids) {
        const e = this.get(id);
        if (!e.folder)
          this.meta[e.path] = {
            rating: e.rating || 0,
            label: e.label || "",
            ...patch,
          };
      }
      await fs.writeFile(this.store + ".tmp", JSON.stringify(this.meta));
      await fs.rename(this.store + ".tmp", this.store);
      return await this.list(this.current);
    } finally {
      this.busy = false;
    }
  }

  preview(ids, start, padding, prefix = "") {
    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      ![1, 2, 3, 4, 5, 6].includes(padding) ||
      /[<>:"/\\|?*\x00-\x1f]/.test(prefix)
    )
      throw Error("Nome ou sequência inválida.");
    const rows = ids.map((id, i) => {
      const e = this.get(id);
      if (e.folder) throw Error("Selecione somente arquivos.");
      const name =
        prefix +
        String(start + i).padStart(padding, "0") +
        path.extname(e.name);
      if (name.length > 240) throw Error("Nome muito longo.");
      return { id, old: e.name, name };
    });
    if (new Set(rows.map((r) => r.name.toLowerCase())).size !== rows.length)
      throw Error("Nomes duplicados.");
    return rows;
  }
  async rename(rows) {
    if (this.busy) throw Error("Operação em andamento.");
    this.busy = true;
    const stages = [],
      created = [],
      removed = [];
    let safeCleanup = true;
    const oldMeta = structuredClone(this.meta);
    const same = (a, b) =>
      a.ino === b.ino &&
      a.dev === b.dev &&
      a.size === b.size &&
      a.mtimeMs === b.mtimeMs;
    try {
      const sources = new Set(rows.map((r) => this.get(r.id).path)),
        existing = await fs.readdir(this.current),
        names = new Set();
      for (const r of rows) {
        const e = this.get(r.id),
          target = path.join(this.current, r.name),
          key = r.name.toLowerCase();
        if (
          e.folder ||
          path.basename(r.name) !== r.name ||
          /[<>:"/\\|?*\x00-\x1f]/.test(r.name) ||
          /[. ]$/.test(r.name) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(r.name) ||
          r.name.length > 240 ||
          names.has(key)
        )
          throw Error("Nome inválido ou duplicado.");
        names.add(key);
        if (
          existing.some(
            (n) =>
              n.toLowerCase() === key &&
              !sources.has(path.join(this.current, n)),
          )
        )
          throw Error("Já existe um arquivo chamado " + r.name);
        const stat = await fs.stat(e.path);
        if (
          stat.size !== e.size ||
          stat.mtimeMs !== e.mtime ||
          stat.ino !== e.ino ||
          stat.dev !== e.dev
        )
          throw Error("Arquivo alterado externamente. Atualize a pasta.");
        const temp = path.join(
          this.current,
          ".bridgeimagine-" + crypto.randomUUID(),
        );
        await fs.link(e.path, temp);
        stages.push({
          source: e.path,
          target,
          temp,
          stat,
          meta: this.meta[e.path],
        });
      }
      for (const s of stages) {
        if (!same(await fs.stat(s.source), s.stat))
          throw Error("Arquivo alterado externamente.");
        await fs.unlink(s.source);
        removed.push(s);
      }
      for (const s of stages) {
        await fs.link(s.temp, s.target);
        created.push(s);
      }
      for (const s of stages) delete this.meta[s.source];
      for (const s of stages) if (s.meta) this.meta[s.target] = s.meta;
      await fs.writeFile(this.store + ".tmp", JSON.stringify(this.meta));
      await fs.rename(this.store + ".tmp", this.store);
    } catch (e) {
      this.meta = oldMeta;
      try {
        for (const s of created) {
          const stat = await fs.stat(s.target);
          if (!same(stat, s.stat))
            throw Error("Destino modificado por outro programa.");
          await fs.unlink(s.target);
        }
        for (const s of removed) await fs.link(s.temp, s.source);
      } catch (rollback) {
        safeCleanup = false;
        throw Error(
          e.message +
            " Recuperação necessária: cópias preservadas em " +
            stages.map((s) => s.temp).join(", "),
        );
      }
      throw e;
    } finally {
      if (safeCleanup)
        for (const s of stages) await fs.unlink(s.temp).catch(() => {});
      this.busy = false;
    }
    return this.list(this.current);
  }
}
module.exports = { Library };
