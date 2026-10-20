/* Shared by preferences validation and keyboard capture in the renderer. */
(function (root) {
  const reserved = new Set([
    "Space",
    "Escape",
    "Enter",
    "Tab",
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Ctrl+A",
    "Ctrl+B",
    "Ctrl+L",
    "Ctrl+O",
    "Ctrl+R",
    "Ctrl+W",
    "Ctrl+0",
    "Ctrl+1",
    "Ctrl+2",
    "Ctrl+3",
    "Ctrl+4",
    "Ctrl+5",
    "Alt+ArrowLeft",
    "Alt+ArrowRight",
    "Alt+ArrowUp",
    "Alt+F4",
    "Alt+Tab",
    "F5",
    "F11",
  ]);
  function normalize(value) {
    if (value === "") return "";
    if (typeof value !== "string") throw Error("Atalho inválido.");
    const parts = value.split("+").map((s) => s.trim());
    const key = parts.pop().toUpperCase();
    const mods = parts.map((s) => s.toLowerCase());
    if (
      !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(key) ||
      mods.some((s) => !["ctrl", "alt", "shift"].includes(s)) ||
      new Set(mods).size !== mods.length
    ) {
      throw Error(
        "Use uma letra, número ou F1–F12, com Ctrl, Alt ou Shift se desejar.",
      );
    }
    const chord = ["ctrl", "alt", "shift"]
      .filter((s) => mods.includes(s))
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .concat(key)
      .join("+");
    if (reserved.has(chord))
      throw Error(
        `O atalho ${chord} já é usado pelo aplicativo ou pelo Windows.`,
      );
    return chord;
  }
  function fromEvent(event) {
    if (
      event.metaKey ||
      ["Control", "Alt", "Shift", "Meta"].includes(event.key)
    )
      return null;
    let key = event.key;
    if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(-1);
    else if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(-1);
    else if (/^Numpad[0-9]$/.test(event.code)) key = event.code.slice(-1);
    if (key === " ") key = "Space";
    if (key.length === 1) key = key.toUpperCase();
    return [
      event.ctrlKey && "Ctrl",
      event.altKey && "Alt",
      event.shiftKey && "Shift",
      key,
    ]
      .filter(Boolean)
      .join("+");
  }
  const api = { normalize, fromEvent };
  if (typeof module !== "undefined") module.exports = api;
  else root.shortcuts = api;
})(globalThis);
