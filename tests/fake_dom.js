// A very small DOM stand-in for the node tests. Enough for innerHTML strings, classes, attributes, children and events.
export class El {
  constructor(tag = "div", id = null) {
    this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.parentNode = null; this.listeners = {}; this.attrs = {}; this.classes = new Set();
    this.dataset = {}; this.style = {}; this.value = ""; this.checked = false; this.hidden = false; this.textContent = ""; this._html = ""; this.tabIndex = -1; this.focused = false;
    this.classList = {
      add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), contains: (c) => this.classes.has(c),
      toggle: (c, on) => { const want = on === undefined ? !this.classes.has(c) : !!on; want ? this.classes.add(c) : this.classes.delete(c); return want; },
    };
  }
  set innerHTML(h) { this._html = h; this.children = []; }
  get innerHTML() { return this._html; }
  insertAdjacentHTML(_, h) { this._html += h; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  fire(ev, e = {}) { const evt = { target: this, key: e.key, preventDefault() { evt.prevented = true; }, ...e }; for (const fn of this.listeners[ev] || []) fn(evt); return evt; }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  appendChild(c) { if (c.parentNode) c.parentNode.children = c.parentNode.children.filter(x => x !== c); c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; } }
  contains(n) { return this.children.includes(n) || this.children.some(c => c.contains && c.contains(n)); }
  focus() { this.focused = true; document.activeElement = this; }
  querySelectorAll(sel) {
    if (sel === "tr") return this.children.filter(c => c.tagName === "TR");
    if (sel === "button") return this.children.filter(c => c.tagName === "BUTTON");
    return [];
  }
  querySelector(sel) {
    const m = sel.match(/^tr\[data-loc="([^"]+)"\]$/); if (m) return this.children.find(c => c.dataset.loc === m[1]) || null;
    return null;
  }
  closest(sel) { if (sel === "button" && this.tagName === "BUTTON") return this; if (sel === ".legend-toggle" && this.classes.has("legend-toggle")) return this; return null; }
  getBoundingClientRect() { return this.rect || { top: 0, left: 0, width: 0, height: 0 }; }
  scrollIntoView() { this.scrolled = true; }
}

export function installFakeDocument() {
  const els = {};
  const document = {
    activeElement: null, title: "",
    getElementById: (id) => (els[id] ||= new El("div", id)),
    querySelector: (sel) => (els[sel] ||= new El(sel === "#rank-table tbody" ? "tbody" : "div", sel)),
    createElement: (tag) => new El(tag),
    documentElement: new El("html"),
    body: new El("body"),
  };
  globalThis.document = document;
  return { document, els, el: document.getElementById, button: (box, key, value) => { const b = new El("button"); b.dataset[key] = value; box.children.push(b); b.parentNode = box; return b; } };
}
