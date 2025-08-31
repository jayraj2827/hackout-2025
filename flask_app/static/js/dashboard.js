(function(){
    const API_URL = '/api/live_alerts';
    const REFRESH_MS = 15_000; // 30s
  
    const HISTORY_LIMIT = 60;
    const history = [];
  
    const el = (id) => document.getElementById(id);
  
    function fmtProb(p){ return (p*100).toFixed(1) + '%'; }
    function fmt(num, d=2){ return Number(num).toFixed(d); }
  
    async function fetchLive(){
      const res = await fetch(API_URL, { cache: 'no-store' });
      if(!res.ok) throw new Error('API error: ' + res.status);
      return res.json();
    }
  
    function updateHeader(meta){
      el('llm-summary').textContent = meta?.llm_summary || '—';
      el('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
      if (window.feather) feather.replace();
    }
    let highAlertCooldown = false;

    function paintPills(stations){
      const wrap = el('alerts-pills');
      wrap.innerHTML = '';
    
      // regular station pills
      stations.forEach(s => {
        const pill = document.createElement('div');
        pill.className = 'alert-pill' + (s.alerts?.critical_alert ? ' critical' : (s.alerts?.anomaly ? ' anomaly' : ''));
        pill.textContent = `${s.station} • ${fmtProb(s.alerts?.event_probability || 0)}`;
        wrap.appendChild(pill);
      });
    
      // add the full-width high-alert pill (uses your CSS classes)
      const criticalStations = stations.filter(s => s.alerts?.critical_alert);
      if (criticalStations.length > 0) {
        const ha = document.createElement('div');
        // keep alert-pill so existing styles remain, but add the high-alert class for custom styling
        ha.className = 'alert-pill high-alert-pill critical pulse';
        // button is type="button" (no form submit) — JS handles the POST
        ha.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px; width:100%;">
            <button type="button" class="high-alert-send" aria-label="Send high alert">
              <span class="icon">🚨</span>
              <span class="label">Send High Alert</span>
            </button>
            <div class="high-alert-meta" title="Triggered by: ${criticalStations.map(s=>s.station).join(', ')}">
              ${criticalStations[0].station}${criticalStations.length>1?` +${criticalStations.length-1}`:''}
            </div>
          </div>
        `;
        wrap.appendChild(ha);
    
        // wire the button (single instance — recreated each tick so safe to re-add)
        const btn = ha.querySelector('.high-alert-send');
        btn.addEventListener('click', async (ev) => {
          if (highAlertCooldown) {
            return alert('Alert recently sent — please wait a moment.');
          }
          const confirmMsg = `Send high alert for: ${criticalStations.map(s=>s.station).join(', ')} ?`;
          if (!confirm(confirmMsg)) return;
    
          try {
            btn.disabled = true;
            btn.classList.add('sending');
            btn.innerHTML = `<span class="icon">⏳</span><span class="label"> Sending…</span>`;
    
            // adjust endpoint as needed — this posts JSON; if your backend expects form data, change accordingly
            const res = await fetch('/send_alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stations: criticalStations.map(s=>s.station) }),
              cache: 'no-store'
            });
            if (!res.ok) throw new Error('Send failed: ' + res.status);
    
            // success UI
            btn.classList.remove('sending');
            btn.innerHTML = `<span class="icon">✅</span><span class="label"> Sent</span>`;
            highAlertCooldown = true;
    
            // cooldown and revert after 60s
            setTimeout(() => {
              highAlertCooldown = false;
              btn.disabled = false;
              btn.innerHTML = `<span class="icon">🚨</span><span class="label">Send High Alert</span>`;
            }, 60_000);
    
          } catch (err) {
            console.error(err);
            btn.classList.remove('sending');
            btn.disabled = false;
            btn.innerHTML = `<span class="icon">🚨</span><span class="label">Send High Alert</span>`;
            alert('Failed to send alert — check server logs.');
          }
        });
      }
    }
    // function paintPills(stations){
    //   const wrap = el('alerts-pills');
    //   wrap.innerHTML = '';
    //   stations.forEach(s => {
    //     const pill = document.createElement('div');
    //     pill.className = 'alert-pill' + (s.alerts?.critical_alert ? ' critical' : (s.alerts?.anomaly ? ' anomaly' : ''));
    //     pill.textContent = `${s.station} • ${fmtProb(s.alerts?.event_probability || 0)}`;
    //     wrap.appendChild(pill);
    //   });
    //   if(stations.some(s => s.alerts?.critical_alert)) {
    //     const highAlertPill = document.createElement('div');
    //     highAlertPill.className = 'alert-pill critical';
    //     highAlertPill.innerHTML = `<form action="/send_alert" method="post"><button type="submit" class="btn btn-danger btn-sm">🚨 High Alert</button></form>`;
    //     wrap.appendChild(highAlertPill);
    //   }
    // }
  
    function updateKPIs(stations){
      const total = stations.length;
      const crit = stations.filter(s => s.alerts?.critical_alert).length;
      const anomalies = stations.filter(s => s.alerts?.anomaly).length;
  
      el('kpi-stations-value').textContent = String(total);
      el('kpi-critical-count').innerHTML = `<i data-feather="alert-triangle"></i> Critical: ${crit}`;
  
      el('kpi-anomaly-value').textContent = total ? ((anomalies/total)*100).toFixed(0) + '%' : '—';
  
      const maxP = stations.reduce((m,s)=> (s.alerts?.event_probability||0) > (m.p||0) ? { p:s.alerts.event_probability, st:s.station } : m, {p:0, st:'—'});
      el('kpi-prob-value').textContent = fmtProb(maxP.p||0);
      el('kpi-prob-station').textContent = maxP.st || '—';
  
      const tideMax = stations.reduce((m,s)=> (s.tide||0) > (m.v||-1) ? { v:s.tide, st:s.station, tr:s.tide_trend } : m, {v:-1, st:'—', tr:'—'});
      el('kpi-tide-value').textContent = tideMax.v ? tideMax.v.toFixed(3) : '—';
      el('kpi-tide-station').textContent = `${tideMax.st} • ${tideMax.tr}`;
      if (window.feather) feather.replace();
    }
  
    function updateTable(stations){
      const tbody = el('alerts-tbody');
      tbody.innerHTML = '';
      stations.forEach(s => {
        const tr = document.createElement('tr');
        const bAnom = s.alerts?.anomaly; const bCrit = s.alerts?.critical_alert;
        tr.innerHTML = `
          <td>${s.station}</td>
          <td>${fmtProb(s.alerts?.event_probability || 0)}</td>
          <td><span class="badge ${bAnom?'warn':'ok'}">${bAnom?'Yes':'No'}</span></td>
          <td><span class="badge ${bCrit?'crit':'ok'}">${bCrit?'Yes':'No'}</span></td>
          <td>${fmt(s.chlorophyll)}</td>
          <td>${fmt(s.ndvi)}</td>
          <td>${fmt(s.tide, 3)}</td>
          <td>${s.tide_trend}</td>
          <td>${fmt(s.temperature)}</td>
          <td>${fmt(s.wind_speed)}</td>
          <td>${fmt(s.rainfall)}</td>
          <td>${s.timestamp}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  
    // ----- Plotly Charts -----
    function renderRisk3D(stations){
      const trace = {
        type: 'scatter3d', mode: 'markers',
        x: stations.map(s=> s.latitude),
        y: stations.map(s=> s.longitude),
        z: stations.map(s=> s.alerts?.event_probability || 0),
        text: stations.map(s=> `${s.station} — ${fmtProb(s.alerts?.event_probability||0)}`),
        marker: { size: stations.map(s=> 6 + (s.wind_speed||0)), opacity: 0.9 }
      };
      const layout = { margin: {l:0,r:0,t:0,b:0}, scene: { xaxis:{title:'Latitude'}, yaxis:{title:'Longitude'}, zaxis:{title:'Event Probability'} } };
      Plotly.react('plot-risk-3d', [trace], layout, {responsive:true});
    }
  
    function renderEco3D(stations){
      const trace = {
        type:'scatter3d', mode:'markers',
        x: stations.map(s=> s.chlorophyll),
        y: stations.map(s=> s.temperature),
        z: stations.map(s=> s.wind_speed),
        text: stations.map(s=> `${s.station}\nChl: ${fmt(s.chlorophyll)} | NDVI: ${fmt(s.ndvi)}\nTemp: ${fmt(s.temperature)} | Wind: ${fmt(s.wind_speed)}`),
        marker:{ size: stations.map(s=> 8 + (s.ndvi||0)*10), opacity:0.85 }
      };
      Plotly.react('plot-eco-3d', [trace], { margin:{l:0,r:0,t:0,b:0}, scene:{ xaxis:{title:'Chlorophyll (mg/m³)'}, yaxis:{title:'Temperature (°C)'}, zaxis:{title:'Wind Speed (m/s)'} } }, {responsive:true});
    }
  
    function renderBars3D(stations){
      // Build vertical prisms for each station using mesh3d — correct i,j,k arrays
      const meshes = stations.map((s, idx)=>{
        const baseX = idx+1;
        const w = 0.35; const h = (s.alerts?.event_probability||0);
        const xs = [baseX-w, baseX+w, baseX+w, baseX-w, baseX-w, baseX+w, baseX+w, baseX-w];
        const ys = [-w, -w,  w,  w, -w, -w,  w,  w];
        const zs = [0,0,0,0, h,h,h,h];
        // faces (triangles) defined with i,j,k arrays
        const i = [0,1,2, 0,2,3, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 2,3,7, 2,7,6, 3,0,4, 3,4,7];
        const j = [1,2,3, 2,3,0, 5,6,7, 6,7,4, 1,5,4, 5,4,0, 2,6,5, 6,5,1, 3,7,6, 7,6,2, 0,4,7, 4,7,3];
        const k = [2,3,0, 3,0,1, 6,7,4, 7,4,5, 5,4,0, 4,0,1, 6,5,1, 5,1,2, 7,6,2, 6,2,3, 4,7,3, 7,3,0];
        return {type:'mesh3d', x:xs, y:ys, z:zs, i, j, k, name:s.station, opacity:0.95};
      });
      const layout = { margin:{l:0,r:0,t:0,b:0}, scene:{ xaxis:{title:'Station #', tickmode:'array', tickvals:stations.map((_,i)=> i+1), ticktext:stations.map(s=>s.station)}, yaxis:{title:'—'}, zaxis:{title:'Event Probability'} } };
      Plotly.react('plot-bars-3d', meshes, layout, {responsive:true});
    }
  
    function renderTideSurface(){
      if (history.length < 2) {
        Plotly.react('plot-tide-3d', [], {margin:{l:0,r:0,t:0,b:0}});
        return;
      }
      const latest = history[history.length-1];
      const stations = latest.alerts.map(s=> s.station);
      const times = history.map(h=> h.ts.toLocaleTimeString());
      const Z = history.map(h => stations.map(st => {
        const row = h.alerts.find(a => a.station === st);
        return row ? (row.tide || 0) : 0;
      }));
      const data = [{ type:'surface', x: stations.map((_,i)=> i+1), y: times.map((_,i)=> i), z: Z }];
      const layout = { margin:{l:0,r:0,t:0,b:0}, scene:{ xaxis:{title:'Station', tickmode:'array', tickvals: stations.map((_,i)=> i+1), ticktext: stations}, yaxis:{title:'Time (last n ticks)'}, zaxis:{title:'Tide Level'} } };
      Plotly.react('plot-tide-3d', data, layout, {responsive:true});
    }
  
    // ----- Orchestrate -----
    // async function tick(){
    //   try{
    //     const data = await fetchLive();
    //     const stations = (data && data.alerts) ? data.alerts : [];
  
    //     history.push({ ts: new Date(), alerts: stations });
    //     if(history.length > HISTORY_LIMIT) history.shift();
  
    //     updateHeader(data);
    //     paintPills(stations);
    //     updateKPIs(stations);
    //     updateTable(stations);
  
    //     renderRisk3D(stations);
    //     renderEco3D(stations);
    //     renderBars3D(stations);
    //     renderTideSurface();
    //   } catch(err){
    //     console.error(err);
    //     el('system-status').classList.remove('pill-success');
    //     el('system-status').classList.add('pill');
    //     el('system-status').innerHTML = '<i data-feather=\"alert-octagon\"></i><span> Offline</span>';
    //     if (window.feather) feather.replace();
    //   }
    // }
    // ----- Orchestrate (updated tick) -----
async function tick(){
  try{
    const data = await fetchLive();
    const stations = (data && data.alerts) ? data.alerts : [];

    // keep short time-series history for tide surface etc.
    history.push({ ts: new Date(), alerts: stations });
    if(history.length > HISTORY_LIMIT) history.shift();

    // text/header + pills + KPIs + table
    updateHeader(data);
    paintPills(stations);
    updateKPIs(stations);
    updateTable(stations);

    // Ensure map exists then update markers (safe: initSatelliteMap is idempotent)
    try {
      if (!window.satMap) initSatelliteMap();
      updateSatelliteMarkers(stations);
    } catch (mapErr) {
      // map failures should not break the rest of the dashboard
      console.warn('Map update failed', mapErr);
    }

    // visualizations (Plotly) — kept last so heavy renders don't block UI updates
    renderRisk3D(stations);
    renderEco3D(stations);
    renderBars3D(stations);
    renderTideSurface();

  } catch(err){
    console.error('tick error', err);
    // keep the offline UI indicator consistent with your previous logic
    const statusEl = el('system-status');
    if (statusEl) {
      statusEl.classList.remove('pill-success');
      statusEl.classList.add('pill');
      statusEl.innerHTML = '<i data-feather="alert-octagon"></i><span> Offline</span>';
    }
    if (window.feather) feather.replace();
  }
}

    window.addEventListener('load', () => {
      tick();
      setInterval(tick, REFRESH_MS);
    });

    // function initSatelliteMap() {
    //     // Create map centered on India
    //     var map = L.map('satelliteMap').setView([20.5937, 78.9629], 5);
    
    //     // Base OSM layer
    //     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //         attribution: '© OpenStreetMap'
    //     }).addTo(map);
    
    //     // Fetch NDVI layer from Flask
    //     fetch('/get_satellite_layer')
    //         .then(res => res.json())
    //         .then(data => {
    //             L.tileLayer(data.tile_url, {
    //                 attribution: "Google Earth Engine"
    //             }).addTo(map);
    //         })
    //         .catch(err => {
    //             console.error("Failed to load EE layer", err);
    //         });
    // }
    // make sure these are declared in outer scope so both init and tick can access them
window.satMap = null;
window.satMarkerMap = new Map(); // key: station name -> Leaflet marker
window.satTileLayer = null;      // hold the NDVI/tile layer so we can replace it
window.satMarkerGroup = null;    // LayerGroup for convenience

function initSatelliteMap() {
  if (window.satMap) return; // init once

  // Create map centered on India
  const map = L.map('satelliteMap', { preferCanvas: true }).setView([20.5937, 78.9629], 5);
  window.satMap = map;

  // Base OSM layer (always present)
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map);

  // placeholder tile layer for NDVI (tries to fetch from server)
  fetch('/get_satellite_layer')
    .then(res => res.json())
    .then(data => {
      if (data?.tile_url) {
        // if a previous layer exists, remove it
        if (window.satTileLayer) map.removeLayer(window.satTileLayer);
        window.satTileLayer = L.tileLayer(data.tile_url, { attribution: "Google Earth Engine", maxZoom: 18 }).addTo(map);
      }
    })
    .catch(err => {
      console.warn("Failed to load EE layer", err);
    });

  // LayerGroup for markers so we can manage them together
  window.satMarkerGroup = L.layerGroup().addTo(map);

  // optional: add a legend or small control
  const legend = L.control({ position: 'topright' });
  legend.onAdd = function() {
    const div = L.DomUtil.create('div', 'pill');
    div.style.margin = '6px';
    div.innerHTML = 'Map: Live NDVI & Stations';
    return div;
  };
  legend.addTo(map);
}

// Call this on each tick to update markers from your stations array
function updateSatelliteMarkers(stations){
  if (!window.satMap) initSatelliteMap();
  const map = window.satMap;

  // helper color rule: critical -> red, high prob -> orange, low -> gold/blue
  function colorForStation(s) {
    const p = s.alerts?.event_probability || 0;
    if (s.alerts?.critical_alert) return '#ff4d4f';
    if (p >= 0.6) return '#ff8a4d';
    if (p >= 0.3) return '#ffd166';
    return '#6ee7ff';
  }

  // Build bounds to fit markers
  const bounds = [];

  stations.forEach(s => {
    if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') return;

    bounds.push([s.latitude, s.longitude]);

    const key = s.station;
    const existing = window.satMarkerMap.get(key);

    // Popup HTML
    const popupHtml = `
      <div class="station-mini">
        <b>${s.station}</b> • ${((s.alerts?.event_probability||0)*100).toFixed(1)}%
        <div class="muted">Tide: ${Number(s.tide||0).toFixed(3)} • Temp: ${Number(s.temperature||0).toFixed(1)}°C</div>
        <div class="muted">Chl: ${Number(s.chlorophyll||0).toFixed(2)} • NDVI: ${Number(s.ndvi||0).toFixed(2)}</div>
      </div>
    `;

    // If it's critical, prefer a pulsing DivIcon marker
    if (s.alerts?.critical_alert) {
      // create a divIcon with pulse elements
      const html = `<div class="pulse-ring"></div><div class="pulse-dot"></div>`;
      const icon = L.divIcon({ className: 'pulse-marker', html: html, iconSize: [24,24] });

      if (existing && existing._icon && existing.options && existing.options.pulse) {
        // update coords and popup
        existing.setLatLng([s.latitude, s.longitude]);
        existing.getPopup()?.setContent(popupHtml) || existing.bindPopup(popupHtml);
      } else {
        // remove old marker if it exists (different type) then create new
        if (existing) {
          window.satMarkerGroup.removeLayer(existing);
          window.satMarkerMap.delete(key);
        }
        const m = L.marker([s.latitude, s.longitude], { icon: icon, pulse: true }).bindPopup(popupHtml);
        m.addTo(window.satMarkerGroup);
        window.satMarkerMap.set(key, m);
      }

    } else {
      // Non-critical: use a circleMarker sized by probability
      const prob = s.alerts?.event_probability || 0;
      const radius = 6 + Math.round(prob * 18); // radius 6..24
      const color = colorForStation(s);

      if (existing && existing.setRadius) {
        // update existing circleMarker
        existing.setLatLng([s.latitude, s.longitude]);
        existing.setRadius(radius);
        existing.setStyle({ color: color, fillColor: color, fillOpacity: 0.65, weight: 1 });
        existing.getPopup()?.setContent(popupHtml) || existing.bindPopup(popupHtml);
      } else {
        // remove old marker if it exists (different type)
        if (existing) {
          window.satMarkerGroup.removeLayer(existing);
          window.satMarkerMap.delete(key);
        }
        const cm = L.circleMarker([s.latitude, s.longitude], {
          radius: radius,
          color: color,
          fillColor: color,
          fillOpacity: 0.65,
          weight: 1
        }).bindPopup(popupHtml);
        cm.addTo(window.satMarkerGroup);
        window.satMarkerMap.set(key, cm);
      }
    }

  }); // end stations.forEach

  // remove markers for stations no longer present
  const presentKeys = new Set(stations.map(s => s.station));
  for (const key of Array.from(window.satMarkerMap.keys())) {
    if (!presentKeys.has(key)) {
      const m = window.satMarkerMap.get(key);
      if (m) window.satMarkerGroup.removeLayer(m);
      window.satMarkerMap.delete(key);
    }
  }

  // Fit/center map: if >1 marker, fit bounds; if 1, center & zoom in
  if (bounds.length > 1) {
    try { map.fitBounds(bounds, { padding: [60, 60], maxZoom: 8 }); } catch(e){ /* ignore */ }
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 7);
  }
}

// IMPORTANT: call updateSatelliteMarkers(stations) from tick() after updateKPIs
// inside tick(), after updateKPIs(stations); add:
//    updateSatelliteMarkers(stations);

    document.addEventListener("DOMContentLoaded", initSatelliteMap);
    // update the "last updated" label
function setMapUpdatedTs(ts = new Date()){
  const el = document.getElementById('map-last-updated');
  if (!el) return;
  el.textContent = ts.toLocaleTimeString();
}

// re-fetch tile_url and replace NDVI layer (safe to call repeatedly)
async function refreshTileLayer(){
  if (!window.satMap) initSatelliteMap();
  try {
    const res = await fetch('/get_satellite_layer', { cache: 'no-store' });
    if (!res.ok) throw new Error('tile fetch failed');
    const data = await res.json();
    if (data?.tile_url) {
      if (window.satTileLayer) window.satMap.removeLayer(window.satTileLayer);
      window.satTileLayer = L.tileLayer(data.tile_url, { attribution: "Google Earth Engine", maxZoom: 18 }).addTo(window.satMap);
      setMapUpdatedTs(new Date());
    } else {
      console.warn('no tile_url in response');
    }
  } catch (err) {
    console.warn('refreshTileLayer error', err);
    alert('Failed to refresh tiles. Check server.');
  }
}

// toggle the NDVI/tile layer on/off
function toggleNdviLayer(){
  if (!window.satMap) initSatelliteMap();
  if (!window.satTileLayer) {
    // try to load if missing
    refreshTileLayer();
    return;
  }
  if (window.satMap.hasLayer(window.satTileLayer)) {
    window.satMap.removeLayer(window.satTileLayer);
  } else {
    window.satTileLayer.addTo(window.satMap);
  }
  setMapUpdatedTs(new Date());
}

// snapshot (download PNG) — simple approach using leaflet-image if available,
// fallback: just open current map center/zoom info in new window
async function snapshotMap(){
  if (!window.satMap) return alert('Map not ready');
  // If leaflet-image or dom-to-image is available you could generate PNG; fallback:
  const c = window.satMap.getCenter();
  const z = window.satMap.getZoom();
  const txt = `Map center: ${c.lat.toFixed(4)}, ${c.lng.toFixed(4)} (z=${z})`;
  // fallback: open small info window
  const w = window.open('', '_blank', 'width=420,height=220');
  w.document.write(`<pre style="font-family:monospace;padding:12px">${txt}</pre>`);
}

// hook control buttons (call once after DOM ready)
function hookMapControls(){
  const bRefresh = document.getElementById('btn-refresh-tiles');
  const bToggle = document.getElementById('btn-toggle-ndvi');
  const bSnap   = document.getElementById('btn-snapshot');
  if (bRefresh) bRefresh.addEventListener('click', refreshTileLayer);
  if (bToggle)  bToggle.addEventListener('click', toggleNdviLayer);
  if (bSnap)    bSnap.addEventListener('click', snapshotMap);
}

// call on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  hookMapControls();
  // show initial timestamp when map created
  setMapUpdatedTs();
});

    

  })();
  