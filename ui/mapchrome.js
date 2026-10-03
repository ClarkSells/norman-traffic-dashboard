// Map chrome: scale control bottom left, a north arrow that appears once the bearing leaves 0,
// and a recenter button that appears when the center leaves the city bounds. Everything hides in
// present mode (setPresenting(true) also removes the scale control; exiting restores it).
//
// ScaleControl comes from mapboxgl in the browser; tests inject the class via options. When neither
// exists (the e2e stub has no ScaleControl) the scale is skipped and the rest still works.
export function initMapChrome(map, { northEl, recenterEl, cityBounds, ScaleControl, scaleOptions } = {}) {
  let presenting = false;

  const setHidden = (el, hide) => {
    if (!el) return;
    el.hidden = !!hide;
    if (el.setAttribute && el.removeAttribute) {
      if (hide) el.setAttribute("hidden", ""); else el.removeAttribute("hidden");
    }
  };

  const insideCity = (center) => {
    if (!center || !cityBounds) return true;
    const lng = center.lng != null ? center.lng : center[0];
    const lat = center.lat != null ? center.lat : center[1];
    const [[west, south], [east, north]] = cityBounds;
    return lng >= west && lng <= east && lat >= south && lat <= north;
  };

  const refresh = () => {
    if (presenting) return;
    const bearing = map.getBearing ? map.getBearing() : 0;
    setHidden(northEl, Math.abs(bearing) <= 1);
    setHidden(recenterEl, insideCity(map.getCenter ? map.getCenter() : null));
  };

  const ScaleCtl = ScaleControl || (typeof mapboxgl !== "undefined" ? mapboxgl.ScaleControl : null);
  let scale = null;
  let scaleAdded = false;
  if (ScaleCtl && map.addControl) {
    scale = new ScaleCtl(scaleOptions || { unit: "imperial" });
    map.addControl(scale, "bottom-left");
    scaleAdded = true;
  }

  if (northEl && northEl.addEventListener) {
    northEl.addEventListener("click", () => { if (map.easeTo) map.easeTo({ bearing: 0 }); });
  }
  if (recenterEl && recenterEl.addEventListener) {
    recenterEl.addEventListener("click", () => { if (map.fitBounds && cityBounds) map.fitBounds(cityBounds); });
  }

  if (map.on) {
    map.on("rotate", refresh);
    map.on("move", refresh);
  }
  refresh();

  return {
    setPresenting(on) {
      presenting = !!on;
      if (presenting) {
        setHidden(northEl, true);
        setHidden(recenterEl, true);
        if (scale && scaleAdded && map.removeControl) {
          map.removeControl(scale);
          scaleAdded = false;
        }
      } else {
        if (scale && !scaleAdded && map.addControl) {
          map.addControl(scale, "bottom-left");
          scaleAdded = true;
        }
        refresh();
      }
    },
  };
}
