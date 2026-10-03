// A stand-in for mapbox-gl.js used only by the Playwright checks when api.mapbox.com is unreachable.
// It keeps the public API the dashboard calls, fires the same events, and paints sources onto a canvas with a
// small style expression evaluator so screenshots show the data layers. It is NOT Mapbox: no tiles, no labels.
(function () {
  const listeners = (obj) => {
    obj._l = {};
    obj.on = (ev, a, b) => { const fn = b || a; const layer = b ? a : null; (obj._l[ev] ||= []).push({ fn, layer }); return obj; };
    obj.once = (ev, a, b) => { const fn = b || a; const layer = b ? a : null; const w = (e) => { obj.off(ev, w); fn(e); }; w.__orig = fn; (obj._l[ev] ||= []).push({ fn: w, layer }); return obj; };
    obj.off = (ev, fn) => { obj._l[ev] = (obj._l[ev] || []).filter(x => x.fn !== fn && x.fn.__orig !== fn); return obj; };
    obj.fire = (ev, e = {}) => { for (const x of [...(obj._l[ev] || [])]) if (!x.layer) x.fn({ type: ev, target: obj, ...e }); return obj; };
    obj.fireLayer = (ev, layer, e = {}) => { for (const x of [...(obj._l[ev] || [])]) if (x.layer === layer) x.fn({ type: ev, target: obj, ...e }); };
  };

  // ---- expression evaluator (subset) ----
  function evalExpr(x, ctx) {
    if (!Array.isArray(x)) return x;
    const op = x[0], ev = (y) => evalExpr(y, ctx);
    switch (op) {
      case "get": return ctx.props ? ctx.props[x[1]] : undefined;
      case "feature-state": return ctx.state ? ctx.state[x[1]] : undefined;
      case "zoom": return ctx.zoom;
      case "heatmap-density": return 0.5;
      case "line-progress": return ctx.progress || 0;
      case "literal": return x[1];
      case "to-string": return String(ev(x[1]));
      case "to-number": return Number(ev(x[1]));
      case "concat": return x.slice(1).map(ev).join("");
      case "coalesce": for (const y of x.slice(1)) { const v = ev(y); if (v != null) return v; } return null;
      case "boolean": { const v = ev(x[1]); return typeof v === "boolean" ? v : !!ev(x[2]); }
      case "==": return ev(x[1]) === ev(x[2]);
      case "!=": return ev(x[1]) !== ev(x[2]);
      case ">=": return ev(x[1]) >= ev(x[2]);
      case "<=": return ev(x[1]) <= ev(x[2]);
      case ">": return ev(x[1]) > ev(x[2]);
      case "<": return ev(x[1]) < ev(x[2]);
      case "!": return !ev(x[1]);
      case "has": return ctx.props && ctx.props[x[1]] !== undefined;
      case "all": return x.slice(1).every(ev);
      case "any": return x.slice(1).some(ev);
      case "in": { const v = ev(x[1]), arr = ev(x[2]); return Array.isArray(arr) ? arr.includes(v) : String(arr).includes(v); }
      case "case": { for (let i = 1; i < x.length - 1; i += 2) if (ev(x[i])) return ev(x[i + 1]); return ev(x[x.length - 1]); }
      case "match": { const v = ev(x[1]); for (let i = 2; i < x.length - 1; i += 2) { const k = x[i]; if ((Array.isArray(k) && k.includes(v)) || k === v) return ev(x[i + 1]); } return ev(x[x.length - 1]); }
      case "step": { const v = ev(x[1]); let out = ev(x[2]); for (let i = 3; i < x.length; i += 2) { if (v >= x[i]) out = ev(x[i + 1]); else break; } return out; }
      case "interpolate": {
        const v = ev(x[2]); const stops = []; for (let i = 3; i < x.length; i += 2) stops.push([x[i], ev(x[i + 1])]);
        if (v <= stops[0][0]) return stops[0][1]; if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
        for (let i = 0; i < stops.length - 1; i++) { const [a, va] = stops[i], [b, vb] = stops[i + 1]; if (v >= a && v <= b) { const t = (v - a) / (b - a); return mix(va, vb, t); } }
        return stops[0][1];
      }
      case "*": return x.slice(1).map(ev).reduce((a, b) => a * b, 1);
      case "+": return x.slice(1).map(ev).reduce((a, b) => a + b, 0);
      case "-": return ev(x[1]) - ev(x[2]);
      case "/": return ev(x[1]) / ev(x[2]);
      case "max": return Math.max(...x.slice(1).map(ev));
      case "min": return Math.min(...x.slice(1).map(ev));
      default: return x[x.length - 1];
    }
  }
  function mix(a, b, t) { if (typeof a === "number" && typeof b === "number") return a + (b - a) * t; return t < 0.5 ? a : b; }

  class LngLat { constructor(lng, lat) { this.lng = lng; this.lat = lat; } toArray() { return [this.lng, this.lat]; } static convert(x) { return x instanceof LngLat ? x : Array.isArray(x) ? new LngLat(x[0], x[1]) : new LngLat(x.lng, x.lat); } }
  class LngLatBounds {
    constructor(sw, ne) { this._sw = sw ? LngLat.convert(sw) : null; this._ne = ne ? LngLat.convert(ne) : null; }
    extend(c) { if (Array.isArray(c) && Array.isArray(c[0])) { c.forEach(x => this.extend(x)); return this; } const p = LngLat.convert(c); if (!this._sw) { this._sw = new LngLat(p.lng, p.lat); this._ne = new LngLat(p.lng, p.lat); } else { this._sw.lng = Math.min(this._sw.lng, p.lng); this._sw.lat = Math.min(this._sw.lat, p.lat); this._ne.lng = Math.max(this._ne.lng, p.lng); this._ne.lat = Math.max(this._ne.lat, p.lat); } return this; }
    getCenter() { return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2); }
    getSouthWest() { return this._sw; } getNorthEast() { return this._ne; }
    toArray() { return [this._sw.toArray(), this._ne.toArray()]; }
    isEmpty() { return !this._sw; }
  }
  class Popup {
    constructor(opts = {}) { listeners(this); this.opts = opts; this._open = false; this.el = document.createElement("div"); this.el.className = "mapboxgl-popup mapboxgl-popup-anchor-bottom"; this.el.innerHTML = '<div class="mapboxgl-popup-tip"></div><div class="mapboxgl-popup-content"></div>'; }
    setLngLat(ll) { this._ll = LngLat.convert(ll); this._place(); return this; }
    getLngLat() { return this._ll; }
    setHTML(h) { const c = this.el.querySelector(".mapboxgl-popup-content"); c.innerHTML = h; if (this.opts.closeButton !== false) { const b = document.createElement("button"); b.className = "mapboxgl-popup-close-button"; b.type = "button"; b.setAttribute("aria-label", "Close popup"); b.textContent = "×"; b.addEventListener("click", () => this.remove()); c.prepend(b); } return this; }
    addTo(map) { this._map = map; map.getContainer().appendChild(this.el); this._open = true; this._place(); this.fire("open"); return this; }
    remove() { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); const was = this._open; this._open = false; if (was) this.fire("close"); return this; }
    isOpen() { return this._open; }
    _place() { if (!this._map || !this._ll) return; const p = this._map.project(this._ll); this.el.style.position = "absolute"; this.el.style.left = "0"; this.el.style.top = "0"; this.el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${(p.y - 10)}px)`; this.el.style.zIndex = 6; this.el.style.maxWidth = this.opts.maxWidth || "240px"; }
  }
  class Control { constructor(cls, buttons) { this.cls = cls; this.buttons = buttons; listeners(this); }
    onAdd(map) { this._map = map; const d = document.createElement("div"); d.className = `mapboxgl-ctrl mapboxgl-ctrl-group ${this.cls}`; for (const [label, cls] of this.buttons) { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.setAttribute("aria-label", label); b.title = label; b.innerHTML = '<span class="mapboxgl-ctrl-icon" aria-hidden="true"></span>'; b.addEventListener("click", () => this._click(label)); d.appendChild(b); } this._el = d; return d; }
    onRemove() { this._el.remove(); } _click() {} }
  class NavigationControl extends Control { constructor() { super("nav", [["Zoom in", "mapboxgl-ctrl-zoom-in"], ["Zoom out", "mapboxgl-ctrl-zoom-out"]]); } _click(l) { this._map.easeTo({ zoom: this._map.getZoom() + (l === "Zoom in" ? 1 : -1) }); } }
  class FullscreenControl extends Control { constructor() { super("fs", [["Enter fullscreen", "mapboxgl-ctrl-fullscreen"]]); } }
  class GeolocateControl extends Control { constructor(o) { super("geo", [["Find my location", "mapboxgl-ctrl-geolocate"]]); this.o = o; }
    _click() { this.trigger(); }
    trigger() { const pos = window.__stubGeolocation || { coords: { longitude: -97.46, latitude: 35.22, accuracy: 20 } }; this.fire("geolocate", pos); this._map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 }); return true; } }

  class Map {
    constructor(opts) {
      listeners(this);
      this.opts = opts; this._center = LngLat.convert(opts.center || [0, 0]); this._zoom = opts.zoom || 10; this._pitch = opts.pitch || 0; this._bearing = opts.bearing || 0;
      this._sources = {}; this._layers = []; this._fs = {}; this._style = null; this._styleLoaded = false; this._config = {};
      this.container = typeof opts.container === "string" ? document.getElementById(opts.container) : opts.container;
      this.container.classList.add("mapboxgl-map");
      this.canvas = document.createElement("canvas"); this.canvas.className = "mapboxgl-canvas"; this.canvas.style.position = "absolute"; this.canvas.style.inset = "0";
      const cc = document.createElement("div"); cc.className = "mapboxgl-canvas-container mapboxgl-interactive"; cc.style.position = "absolute"; cc.style.inset = "0"; cc.appendChild(this.canvas); this.container.appendChild(cc);
      for (const pos of ["top-left", "top-right", "bottom-left", "bottom-right"]) { const d = document.createElement("div"); d.className = `mapboxgl-ctrl-${pos} mapboxgl-ctrl-container-${pos}`; d.style.position = "absolute"; d.style.zIndex = 2; d.style.display = "flex"; d.style.flexDirection = "column"; d.style.gap = "10px"; d.style.padding = "10px"; if (pos.includes("top")) d.style.top = "0"; else d.style.bottom = "0"; if (pos.includes("left")) d.style.left = "0"; else d.style.right = "0"; this.container.appendChild(d); this[`_ctrl_${pos}`] = d; }
      this._resize();
      window.addEventListener("resize", () => { this._resize(); this._draw(); });
      if (typeof ResizeObserver === "function") new ResizeObserver(() => { this._resize(); this._draw(); }).observe(this.container);
      this.canvas.addEventListener("mousemove", (e) => this._pointer("mousemove", e));
      this.canvas.addEventListener("click", (e) => this._pointer("click", e));
      window.__stubMaps = (window.__stubMaps || []).concat(this);
      setTimeout(() => this.setStyle(opts.style, true), 30);
    }
    _resize() { const r = this.container.getBoundingClientRect(); this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.canvas.width = this.w; this.canvas.height = this.h; }
    getContainer() { return this.container; } getCanvas() { return this.canvas; } getCanvasContainer() { return this.canvas.parentNode; }
    addControl(c, pos = "top-right") { const el = c.onAdd(this); this[`_ctrl_${pos}`].appendChild(el); return this; }
    removeControl(c) { c.onRemove(); return this; }
    resize() { this._resize(); this._draw(); return this; }
    remove() {}
    loaded() { return this._styleLoaded; } isStyleLoaded() { return this._styleLoaded; } areTilesLoaded() { return true; }
    getZoom() { return this._zoom; } getCenter() { return this._center; } getPitch() { return this._pitch; } getBearing() { return this._bearing; }
    setStyle(url, first) {
      this._styleLoaded = false; this._layers = []; this._sources = {}; this._fs = {}; this._styleUrl = url;
      const satellite = /satellite/.test(String(url));
      this._style = { name: satellite ? "Mapbox Satellite Streets" : "Mapbox Light", imports: undefined, layers: [
        { id: "background", type: "background" }, { id: "road-primary", type: "line", "source-layer": "road" },
        { id: "poi-label", type: "symbol", "source-layer": "poi_label", layout: { visibility: "visible" } }, { id: "transit-label", type: "symbol", "source-layer": "transit_stop_label", layout: { visibility: "visible" } },
        { id: "road-label", type: "symbol", "source-layer": "road", layout: { visibility: "visible" } }, { id: "settlement-label", type: "symbol", "source-layer": "place_label", layout: { visibility: "visible" } },
        { id: "natural-point-label", type: "symbol", "source-layer": "natural_label", layout: { visibility: "visible" } }, { id: "airport-label", type: "symbol", "source-layer": "airport_label", layout: { visibility: "visible" } }] };
      this._basemap = this._style.layers.map(l => ({ ...l }));
      if (window.__stubFailStyle) { setTimeout(() => this.fire("error", { error: new Error("stub: style blocked") }), 20); return this; }
      setTimeout(() => { this._styleLoaded = true; this.fire("style.load"); this.fire("styledata"); if (first) this.fire("load"); this._draw(); setTimeout(() => this.fire("idle"), 20); }, 40);
      return this;
    }
    getStyle() { return this._style ? { ...this._style, layers: [...this._basemap, ...this._layers] } : null; }
    setConfigProperty(imp, k, v) { this._config[`${imp}.${k}`] = v; }
    addSource(id, s) { this._sources[id] = { ...s, data: s.data, setData: (d) => { this._sources[id].data = d; this._sources[id].setDataCalls = (this._sources[id].setDataCalls || 0) + 1; this._draw(); } }; return this; }
    getSource(id) { return this._sources[id]; }
    removeSource(id) { delete this._sources[id]; return this; }
    addLayer(l, before) { const i = before ? this._layers.findIndex(x => x.id === before) : -1; l = { ...l, paint: { ...(l.paint || {}) }, layout: { ...(l.layout || {}) } }; if (i >= 0) this._layers.splice(i, 0, l); else this._layers.push(l); this._draw(); return this; }
    getLayer(id) { return this._layers.find(l => l.id === id) || (this._basemap || []).find(l => l.id === id); }
    removeLayer(id) { this._layers = this._layers.filter(l => l.id !== id); this._draw(); return this; }
    moveLayer(id, before) { const l = this.getLayer(id); if (!l) return this; this._layers = this._layers.filter(x => x !== l); const i = before ? this._layers.findIndex(x => x.id === before) : -1; if (i >= 0) this._layers.splice(i, 0, l); else this._layers.push(l); return this; }
    setPaintProperty(id, k, v) { const l = this.getLayer(id); if (l) { l.paint[k] = v; if (!k.endsWith("-transition")) this._draw(); } return this; }
    getPaintProperty(id, k) { const l = this.getLayer(id); return l ? l.paint[k] : undefined; }
    setLayoutProperty(id, k, v) { const l = this.getLayer(id); if (l) { l.layout[k] = v; this._draw(); } return this; }
    getLayoutProperty(id, k) { const l = this.getLayer(id); return l ? l.layout[k] : undefined; }
    setFilter(id, f) { const l = this.getLayer(id); if (l) { l.filter = f; this._draw(); } return this; }
    getFilter(id) { const l = this.getLayer(id); return l ? l.filter : undefined; }
    setFeatureState(ref, st) { const k = `${ref.source}:${ref.id}`; this._fs[k] = { ...(this._fs[k] || {}), ...st }; this._fs.__calls = (this._fs.__calls || 0) + 1; this._draw(); }
    getFeatureState(ref) { return this._fs[`${ref.source}:${ref.id}`] || {}; }
    removeFeatureState(ref) { if (ref && ref.id != null) delete this._fs[`${ref.source}:${ref.id}`]; else for (const k of Object.keys(this._fs)) if (k.startsWith(`${ref.source}:`)) delete this._fs[k]; }
    // camera
    _scale() { return (256 * Math.pow(2, this._zoom)) / 360; }
    project(ll) { const p = LngLat.convert(ll); const s = this._scale(); const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI; const dx = (p.lng - this._center.lng) * s, dy = -(my(p.lat) - my(this._center.lat)) * s; const b = -this._bearing * Math.PI / 180; const x = dx * Math.cos(b) - dy * Math.sin(b), y = dx * Math.sin(b) + dy * Math.cos(b); return { x: this.w / 2 + x, y: this.h / 2 + y * Math.cos(this._pitch * Math.PI / 180) }; }
    unproject(pt) { const s = this._scale(); const x = pt.x - this.w / 2, y = (pt.y - this.h / 2) / Math.cos(this._pitch * Math.PI / 180); const b = this._bearing * Math.PI / 180; const dx = x * Math.cos(b) - y * Math.sin(b), dy = x * Math.sin(b) + y * Math.cos(b); const imy = (y2) => (Math.atan(Math.exp(y2 * Math.PI / 180)) * 2 - Math.PI / 2) * 180 / Math.PI; const my = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI; return new LngLat(this._center.lng + dx / s, imy(my(this._center.lat) - dy / s)); }
    cameraForBounds(b, o = {}) { const bb = b instanceof LngLatBounds ? b : new LngLatBounds(b[0], b[1]); const pad = typeof o.padding === "number" ? o.padding : 0; const c = bb.getCenter(); const dlng = Math.max(1e-6, bb._ne.lng - bb._sw.lng), dlat = Math.max(1e-6, bb._ne.lat - bb._sw.lat); const zx = Math.log2((this.w - 2 * pad) * 360 / (256 * dlng)), zy = Math.log2((this.h - 2 * pad) * 360 / (256 * dlat * 1.2)); let z = Math.min(zx, zy); if (o.maxZoom != null) z = Math.min(z, o.maxZoom); return { center: c, zoom: z, bearing: o.bearing || 0, pitch: o.pitch || 0 }; }
    fitBounds(b, o = {}) { const cam = this.cameraForBounds(b, o); return this.easeTo({ ...cam, pitch: o.pitch != null ? o.pitch : 0, bearing: o.bearing || 0, duration: o.duration }); }
    jumpTo(o) { return this.easeTo({ ...o, duration: 0 }); }
    easeTo(o) {
      this.__lastEase = { ...o }; (this.__eases ||= []).push({ ...o });
      const dur = window.__stubInstant ? 0 : (o.duration == null ? 300 : Math.min(o.duration, 300));
      this.fire("movestart"); this._moving = true;
      const from = { c: this._center, z: this._zoom, p: this._pitch, b: this._bearing };
      const to = { c: o.center ? LngLat.convert(o.center) : from.c, z: o.zoom != null ? o.zoom : from.z, p: o.pitch != null ? o.pitch : from.p, b: o.bearing != null ? o.bearing : from.b };
      const t0 = performance.now();
      const step = () => { const t = dur === 0 ? 1 : Math.min(1, (performance.now() - t0) / dur); const k = 1 - Math.pow(1 - t, 3);
        this._center = new LngLat(from.c.lng + (to.c.lng - from.c.lng) * k, from.c.lat + (to.c.lat - from.c.lat) * k); this._zoom = from.z + (to.z - from.z) * k; this._pitch = from.p + (to.p - from.p) * k; this._bearing = from.b + (to.b - from.b) * k;
        this.fire("move"); this.fire("zoom"); this._draw(); if (t < 1) requestAnimationFrame(step); else { this._moving = false; this.fire("moveend"); this.fire("zoomend"); setTimeout(() => this.fire("idle"), 10); } };
      if (dur === 0) step(); else requestAnimationFrame(step);
      return this;
    }
    flyTo(o) { return this.easeTo(o); }
    stop() { return this; }
    setPadding() { return this; }
    queryRenderedFeatures() { return []; }
    querySourceFeatures(id) { const s = this._sources[id]; return s && s.data && s.data.features ? s.data.features.map(f => ({ ...f, id: f.properties[s.promoteId] })) : []; }
    // hit testing for the interactive layers the app listens to
    _pointer(type, e) {
      const r = this.canvas.getBoundingClientRect(); const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
      const hit = this._hit(pt);
      const lngLat = this.unproject(pt);
      if (type === "mousemove") {
        for (const id of ["segments-line", "count-points"]) {
          const was = this._hover && this._hover.layer === id, now = hit && hit.layer === id;
          if (now && !was) this.fireLayer("mouseenter", id, { features: [hit.feature], lngLat, point: pt });
          if (now) this.fireLayer("mousemove", id, { features: [hit.feature], lngLat, point: pt });
          if (was && !now) this.fireLayer("mouseleave", id, { lngLat, point: pt });
        }
        this._hover = hit; this.fire("mousemove", { lngLat, point: pt });
      } else if (type === "click") { if (hit) this.fireLayer("click", hit.layer, { features: [hit.feature], lngLat, point: pt }); this.fire("click", { lngLat, point: pt, features: hit ? [hit.feature] : [] }); }
    }
    _hit(pt) {
      const seg = this._sources.segments; const lyr = this.getLayer("segments-line");
      if (seg && seg.data && lyr) for (const f of seg.data.features) { const c = f.geometry.coordinates.map(x => this.project(x)); for (let i = 0; i < c.length - 1; i++) if (distSeg(pt, c[i], c[i + 1]) < 7) return { layer: "segments-line", feature: { ...f, id: f.properties.loc_id, properties: { ...f.properties, ...this.getFeatureState({ source: "segments", id: f.properties.loc_id }) } } }; }
      const pts = this._sources.points; if (pts && pts.data && this.getLayer("count-points") && this._zoom >= 13) for (const f of pts.data.features) { const p = this.project(f.geometry.coordinates); if (Math.hypot(p.x - pt.x, p.y - pt.y) < 8) return { layer: "count-points", feature: { ...f, properties: { ...f.properties } } }; }
      return null;
    }
    // painting
    _draw() {
      if (this._drawQueued) return; this._drawQueued = true;
      requestAnimationFrame(() => { this._drawQueued = false; this._paint(); });
    }
    _paint() {
      const ctx = this.canvas.getContext("2d"); if (!ctx) return; const sat = /satellite/.test(String(this._styleUrl));
      ctx.clearRect(0, 0, this.w, this.h); ctx.fillStyle = sat ? "#2a2f2a" : "#f1efe9"; ctx.fillRect(0, 0, this.w, this.h);
      ctx.strokeStyle = sat ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"; ctx.lineWidth = 1; for (let i = 0; i < 12; i++) { const x = (this.w / 12) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke(); const y = (this.h / 12) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }
      ctx.fillStyle = sat ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)"; ctx.font = "12px sans-serif"; ctx.fillText(`stub basemap (${sat ? "satellite" : "light"}), z ${this._zoom.toFixed(2)}, pitch ${this._pitch.toFixed(0)}, bearing ${this._bearing.toFixed(0)}`, 12, this.h - 10);
      if (!this._styleLoaded) return;
      for (const l of this._layers) {
        if (l.layout && l.layout.visibility === "none") continue;
        if (l.minzoom != null && this._zoom < l.minzoom) continue; if (l.maxzoom != null && this._zoom >= l.maxzoom) continue;
        const src = this._sources[l.source]; if (!src || !src.data || !src.data.features) continue;
        for (const f of src.data.features) {
          const id = src.promoteId ? f.properties[src.promoteId] : f.id; const st = this._fs[`${l.source}:${id}`] || {};
          const c = { props: f.properties, state: st, zoom: this._zoom };
          if (l.filter && !evalExpr(l.filter, c)) continue;
          const P = (k, d) => { const v = l.paint[k]; return v === undefined ? d : evalExpr(v, c); };
          if (l.type === "line") {
            const op = P("line-opacity", 1); if (op <= 0) continue;
            let color = P("line-color", "#000"); if (l.paint["line-gradient"]) color = evalExpr(l.paint["line-gradient"], { ...c, progress: 0.5 });
            ctx.globalAlpha = op; ctx.strokeStyle = color; ctx.lineWidth = P("line-width", 1); ctx.lineCap = (l.layout && l.layout["line-cap"]) || "butt"; ctx.lineJoin = "round";
            const dash = l.paint["line-dasharray"]; ctx.setLineDash(Array.isArray(dash) && typeof dash[0] === "number" ? dash.map(x => x * ctx.lineWidth) : []);
            const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flat() : [f.geometry.coordinates];
            for (const ring of rings) { ctx.beginPath(); ring.forEach((pt, i) => { const p = this.project(pt); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); }
            ctx.setLineDash([]);
          } else if (l.type === "fill") {
            const op = P("fill-opacity", 1); if (op <= 0) continue; ctx.globalAlpha = op; ctx.fillStyle = P("fill-color", "#000");
            const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
            for (const ring of rings) { ctx.beginPath(); ring.forEach((pt, i) => { const p = this.project(pt); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.fill(); }
          } else if (l.type === "circle") {
            const op = P("circle-opacity", 1); if (op <= 0) continue; const p = this.project(f.geometry.coordinates); if (p.x < -10 || p.y < -10 || p.x > this.w + 10 || p.y > this.h + 10) continue;
            ctx.globalAlpha = op; ctx.fillStyle = P("circle-color", "#000"); ctx.beginPath(); ctx.arc(p.x, p.y, P("circle-radius", 3), 0, Math.PI * 2); ctx.fill();
            const sw = P("circle-stroke-width", 0); if (sw > 0) { ctx.lineWidth = sw; ctx.strokeStyle = P("circle-stroke-color", "#000"); ctx.globalAlpha = P("circle-stroke-opacity", op); ctx.stroke(); }
          } else if (l.type === "heatmap") {
            const op = P("heatmap-opacity", 1); if (op <= 0) continue; const p = this.project(f.geometry.coordinates); if (p.x < -10 || p.y < -10 || p.x > this.w + 10 || p.y > this.h + 10) continue;
            ctx.globalAlpha = Math.min(0.25, op * 0.25); ctx.fillStyle = "#2a78d6"; ctx.beginPath(); ctx.arc(p.x, p.y, P("heatmap-radius", 8) * 0.6, 0, Math.PI * 2); ctx.fill();
          } else if (l.type === "symbol") {
            const op = P("text-opacity", 1); if (op <= 0) continue; const txt = evalExpr(l.layout["text-field"], c); if (!txt) continue;
            const g = f.geometry.type === "Point" ? f.geometry.coordinates : f.geometry.coordinates[0][0]; const p = this.project(g);
            ctx.globalAlpha = op; ctx.font = `600 ${evalExpr(l.layout["text-size"], c) || 12}px sans-serif`; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeStyle = P("text-halo-color", "#fff"); ctx.strokeText(txt, p.x, p.y); ctx.fillStyle = P("text-color", "#000"); ctx.fillText(txt, p.x, p.y);
          }
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  function distSeg(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y; const l2 = dx * dx + dy * dy || 1; let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); }

  window.mapboxgl = { Map, Popup, LngLat, LngLatBounds, NavigationControl, FullscreenControl, GeolocateControl, accessToken: "", version: "stub", supported: () => true, __stub: true, __evalExpr: evalExpr };
})();
