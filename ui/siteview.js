// Site view: a 3D capture of an intersection (Aleph mesh.glb) with labels from sites/<id>/site.json, or, when no mesh
// has been captured yet, a Mapbox aerial fly in with the same labels as markers. One module, injects its own DOM and
// styles, opened from the segment popup. Three.js is imported on first open only (import map in index.html).
//
// initSiteView(map, opts) -> { ready: Promise, sitesForLoc(locId) -> [{ id, name }], open(siteId), close() }

const STYLE = `
.siteview{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:var(--surface,#fbfaf7);color:var(--ink,#16150f)}
.siteview[hidden]{display:none}
.siteview-head{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line,#d9d6cc);font-family:var(--font-mono,"IBM Plex Mono",monospace)}
.siteview-head h2{font-size:15px;margin:0;font-weight:600}
.siteview-head .meta{font-size:11.5px;color:var(--ink-muted,#6b6960);flex:1}
.siteview-stage{position:relative;flex:1;min-height:0}
.siteview-stage canvas{display:block;width:100%;height:100%}
.siteview-note{position:absolute;left:16px;bottom:12px;max-width:52ch;font-size:11.5px;line-height:1.4;padding:8px 10px;background:rgba(251,250,247,.92);border:1px solid var(--line,#d9d6cc);border-radius:6px;font-family:var(--font-mono,monospace)}
.siteview-label{font:11px/1.25 var(--font-mono,"IBM Plex Mono",monospace);padding:4px 7px;border-radius:4px;background:rgba(22,21,15,.86);color:#fbfaf7;white-space:nowrap;pointer-events:none;border-left:3px solid #ee7b2f}
.siteview-label.intersection{background:#ee7b2f;color:#16150f;border-left-color:#16150f;font-weight:600}
.siteview-label.forecast{border-left-color:#5598e7}.siteview-label.speed{border-left-color:#f59e5c}.siteview-label.crashes{border-left-color:#d45f14}.siteview-label.station{border-left-color:#86b6ef}
.siteview-strip{display:flex;gap:8px;padding:8px 16px;overflow-x:auto;border-top:1px solid var(--line,#d9d6cc);background:var(--surface-2,#f1efe8)}
.siteview-strip img{height:120px;border-radius:4px;flex:none}
.siteview-strip .empty{font-size:11.5px;color:var(--ink-muted,#6b6960);font-family:var(--font-mono,monospace);padding:6px 0}
.siteview .btn{font:inherit}
.siteview-marker{transform:translate(-50%,-100%)}
`;

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) { e.className = cls; for (const c of cls.split(/\s+/)) if (c && e.classList) e.classList.add(c); } if (text != null) e.textContent = text; return e; }
function append(parent, ...kids) { for (const k of kids) parent.appendChild(k); }
function clear(node) { if (typeof node.replaceChildren === "function") node.replaceChildren(); else for (const c of [...(node.children || [])]) c.remove(); }

export function initSiteView(map, { base = "sites/", fetchJson = (u) => fetch(u).then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${u}`))),
                                    threeBase = "https://cdn.jsdelivr.net/npm/three@0.160.0", doc = document } = {}) {
  let index = {};
  const ready = fetchJson(base + "index.json").then(j => { index = j || {}; }).catch(() => { index = {}; });
  let root = null, head = null, stage = null, note = null, strip = null, title = null, meta = null;
  let three = null, cleanup = null, markers = [];

  function build() {
    if (root) return;
    const style = el("style"); style.textContent = STYLE; doc.head.appendChild(style);
    root = el("section", "siteview"); root.hidden = true; root.setAttribute("aria-label", "Site view"); root.tabIndex = -1;
    head = el("div", "siteview-head");
    title = el("h2"); meta = el("div", "meta");
    const close = el("button", "btn", "Close"); close.type = "button"; close.addEventListener("click", () => api.close());
    append(head, title, meta, close);
    stage = el("div", "siteview-stage"); note = el("div", "siteview-note"); stage.appendChild(note);
    strip = el("div", "siteview-strip");
    append(root, head, stage, strip);
    doc.body.appendChild(root);
    doc.addEventListener("keydown", (e) => { if (e.key === "Escape" && !root.hidden) api.close(); });
  }

  function sitesForLoc(locId) {
    return Object.entries(index).filter(([, s]) => (s.loc_ids || []).includes(locId)).map(([id, s]) => ({ id, name: s.name, hasMesh: !!s.has_mesh }));
  }

  async function loadThree() {
    if (three) return three;
    const [T, { GLTFLoader }, { OrbitControls }, { CSS2DRenderer, CSS2DObject }] = await Promise.all([
      import(`${threeBase}/build/three.module.js`),
      import(`${threeBase}/examples/jsm/loaders/GLTFLoader.js`),
      import(`${threeBase}/examples/jsm/controls/OrbitControls.js`),
      import(`${threeBase}/examples/jsm/renderers/CSS2DRenderer.js`),
    ]);
    three = { T, GLTFLoader, OrbitControls, CSS2DRenderer, CSS2DObject };
    return three;
  }

  function labelEl(l) { const d = el("div", `siteview-label ${l.kind || ""}`, l.text); return d; }

  async function renderMesh(site, siteId) {
    const { T, GLTFLoader, OrbitControls, CSS2DRenderer, CSS2DObject } = await loadThree();
    const w = stage.clientWidth || 800, h = stage.clientHeight || 500;
    const renderer = new T.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h);
    renderer.outputColorSpace = T.SRGBColorSpace;
    const labels = new CSS2DRenderer(); labels.setSize(w, h);
    Object.assign(labels.domElement.style, { position: "absolute", top: "0", left: "0", pointerEvents: "none" });
    stage.insertBefore(labels.domElement, stage.firstChild); stage.insertBefore(renderer.domElement, stage.firstChild);
    const scene = new T.Scene(); scene.background = new T.Color(0xeeece4);
    const camera = new T.PerspectiveCamera(50, w / h, 0.5, 4000);
    const half = (site.size_m || 160) / 2;
    camera.position.set(half * 0.9, half * 1.1, half * 1.4);
    const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 4, 0); controls.maxPolarAngle = Math.PI * 0.49; controls.update();
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8a7a, 1.1));
    const sun = new T.DirectionalLight(0xffffff, 1.4); sun.position.set(120, 200, 80); scene.add(sun);
    const loader = new GLTFLoader();
    const gltf = await new Promise((res, rej) => loader.load(`${base}${siteId}/${site.mesh || "mesh.glb"}`, res, undefined, rej));
    scene.add(gltf.scene);
    for (const l of site.labels || []) {
      const o = new CSS2DObject(labelEl(l)); o.position.set(l.x, l.y, l.z); scene.add(o);
    }
    let raf = 0;
    const tick = () => { controls.update(); renderer.render(scene, camera); labels.render(scene, camera); raf = requestAnimationFrame(tick); };
    tick();
    const onResize = () => { const W = stage.clientWidth, H = stage.clientHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); labels.setSize(W, H); };
    window.addEventListener("resize", onResize);
    cleanup = () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); controls.dispose(); renderer.dispose(); renderer.domElement.remove(); labels.domElement.remove(); };
    note.textContent = `3D capture via Aleph (Google imagery through undocumented endpoints; see the method notes). Drag to orbit, scroll to zoom. Labels are placed from the pipeline's site.json.`;
  }

  function renderFallback(site) {
    // No mesh yet: the map itself is the stage. Hide the overlay stage, fly the map, pin the labels as markers.
    root.style.background = "transparent"; root.style.pointerEvents = "none";
    head.style.pointerEvents = "auto"; strip.style.pointerEvents = "auto";
    stage.style.pointerEvents = "none"; note.style.pointerEvents = "auto";
    note.textContent = `No 3D capture yet for this site. Run the pipeline's data/sites/${site.site_id}/capture.cmd with Aleph, copy mesh.glb into sites/${site.site_id}/, and this view switches to the mesh. Showing the aerial camera with the same labels.`;
    if (map && typeof map.flyTo === "function") {
      map.flyTo({ center: [site.center.lon, site.center.lat], zoom: 17.6, pitch: 60, bearing: -20, duration: 1400 });
      for (const l of site.labels || []) {
        if (typeof mapboxgl === "undefined") break;
        const d = labelEl(l); d.classList.add("siteview-marker");
        const m = new mapboxgl.Marker({ element: d, anchor: "bottom" }).setLngLat([l.lon, l.lat]).addTo(map);
        markers.push(m);
      }
    }
    cleanup = () => { markers.forEach(m => m.remove()); markers = []; root.style.background = ""; root.style.pointerEvents = ""; stage.style.pointerEvents = ""; };
  }

  const api = {
    ready, sitesForLoc,
    async open(siteId) {
      build(); await ready;
      const entry = index[siteId];
      if (!entry) return false;
      let site;
      try { site = await fetchJson(`${base}${siteId}/site.json`); } catch { return false; }
      api.close();
      root.hidden = false;
      title.textContent = site.name;
      meta.textContent = `${site.size_m} m square · ${(site.loc_ids || []).length} counted segment${(site.loc_ids || []).length === 1 ? "" : "s"} · ${site.labels ? site.labels.length : 0} labels`;
      clear(strip);
      const imgs = entry.streetview || [];
      if (imgs.length) for (const f of imgs) { const im = el("img"); im.src = `${base}${siteId}/streetview/${f}`; im.alt = `Street View, ${f}`; im.loading = "lazy"; strip.appendChild(im); }
      else strip.appendChild(el("div", "empty", "No Street View images captured yet for this site."));
      if (entry.has_mesh) {
        try { await renderMesh(site, siteId); } catch (e) { note.textContent = `Mesh failed to load (${e && e.message ? e.message : e}). Showing the aerial camera instead.`; renderFallback(site); }
      } else renderFallback(site);
      root.focus();
      return true;
    },
    close() { if (!root) return; if (cleanup) { cleanup(); cleanup = null; } root.hidden = true; },
    _index: () => index,
  };
  return api;
}
