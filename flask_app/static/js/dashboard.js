(function(){
    const API_URL = '/api/live_alerts';
    const REFRESH_MS = 30_000; // 30s
  
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
  
    function paintPills(stations){
      const wrap = el('alerts-pills');
      wrap.innerHTML = '';
      stations.forEach(s => {
        const pill = document.createElement('div');
        pill.className = 'alert-pill' + (s.alerts?.critical_alert ? ' critical' : (s.alerts?.anomaly ? ' anomaly' : ''));
        pill.textContent = `${s.station} • ${fmtProb(s.alerts?.event_probability || 0)}`;
        wrap.appendChild(pill);
      });
    }
  
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
    async function tick(){
      try{
        const data = await fetchLive();
        const stations = (data && data.alerts) ? data.alerts : [];
  
        history.push({ ts: new Date(), alerts: stations });
        if(history.length > HISTORY_LIMIT) history.shift();
  
        updateHeader(data);
        paintPills(stations);
        updateKPIs(stations);
        updateTable(stations);
  
        renderRisk3D(stations);
        renderEco3D(stations);
        renderBars3D(stations);
        renderTideSurface();
      } catch(err){
        console.error(err);
        el('system-status').classList.remove('pill-success');
        el('system-status').classList.add('pill');
        el('system-status').innerHTML = '<i data-feather=\"alert-octagon\"></i><span> Offline</span>';
        if (window.feather) feather.replace();
      }
    }
  
    window.addEventListener('load', () => {
      tick();
      setInterval(tick, REFRESH_MS);
    });
  })();
  