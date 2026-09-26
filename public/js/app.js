import { API } from './api.js';
import { CAT_META, ITEMS, ITEM_NOTES, RESOURCES } from './data.js';

// ── State ──
let activeFilter = 'all', searchTerm = '';
let selectedCats = new Set();
let myCoords = null;

// ── Helpers ──
function severityColor(avg) {
  if (avg <= 1.5) return 'var(--moss)';
  if (avg <= 3) return 'var(--sun)';
  return 'var(--rust)';
}
function dayKey(ts) { return new Date(ts).toISOString().slice(0, 10); }

function escapeHtml(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function resizeImage(file, maxDim = 600, quality = 0.7) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = height * maxDim / width; width = maxDim; }
        else if (height > maxDim) { width = width * maxDim / height; height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Guide tab ──
function renderItems() {
  const el = document.getElementById('itemGroups');
  const f = searchTerm.trim().toLowerCase();
  const groupsOrder = activeFilter === 'all' ? ['recycle', 'compost', 'trash', 'hazard'] : [activeFilter];
  let html = '';
  groupsOrder.forEach(cat => {
    const rows = ITEMS.filter(([name, c]) => c === cat && name.toLowerCase().includes(f));
    if (!rows.length) return;
    const meta = CAT_META[cat];
    html += `<div class="group-title" style="--mc:${meta.color}">${meta.label}<span class="group-count">${rows.length}</span></div>`;
    html += `<div class="card" style="padding:2px 0;">`;
    html += rows.map(([name]) =>
      `<div class="item-row" style="--mc:${meta.color}"><span class="name">${name}${ITEM_NOTES[name] ? `<br><span class="note">${ITEM_NOTES[name]}</span>` : ''}</span></div>`
    ).join('');
    html += `</div>`;
  });
  el.innerHTML = html || `<div class="card empty">No matches — try a different word.</div>`;
}

// ── Areas tab ──
function renderMap(reports) {
  const el = document.getElementById('mapCard');
  const pts = reports.filter(r => r.coords);
  if (pts.length < 2) { el.innerHTML = `<div class="card empty">Schematic map appears once at least 2 located reports come in.</div>`; return; }
  const lats = pts.map(p => p.coords.lat), lngs = pts.map(p => p.coords.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 280, H = 160, pad = 16;
  const dots = pts.map(p => {
    const x = maxLng > minLng ? pad + (p.coords.lng - minLng) / (maxLng - minLng) * (W - 2 * pad) : W / 2;
    const y = maxLat > minLat ? H - pad - (p.coords.lat - minLat) / (maxLat - minLat) * (H - 2 * pad) : H / 2;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${severityColor(Number(p.severity))}" opacity="0.85"><title>${escapeHtml(p.area)}</title></circle>`;
  }).join('');
  el.innerHTML = `<div class="card"><h3 class="card-title">Reported locations (schematic)</h3>
    <p class="muted" style="font-size:.78rem;margin-bottom:8px;">Relative positions only — not a street map.</p>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:var(--bg);border-radius:8px;">${dots}</svg></div>`;
}

function renderTrending(reports) {
  const el = document.getElementById('trendingCard');
  const weekAgo = Date.now() - 7 * 86400000;
  const byArea = {};
  reports.forEach(r => { const k = (r.area || 'Unnamed area').trim(); (byArea[k] = byArea[k] || []).push(r); });
  const trending = Object.entries(byArea)
    .map(([area, list]) => ({ area, recent: list.filter(r => new Date(r.createdAt).getTime() >= weekAgo).length }))
    .filter(a => a.recent >= 2).sort((a, b) => b.recent - a.recent).slice(0, 3);
  if (!trending.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="card"><h3 class="card-title">Trending this week</h3>
    ${trending.map(t => `<div class="item-row" style="--mc:var(--rust)"><span class="name">${escapeHtml(t.area)}<br><span class="note">${t.recent} reports in the last 7 days</span></span></div>`).join('')}</div>`;
}

function renderAreaSummaries(reports) {
  const el = document.getElementById('areaSummaries');
  const visible = reports.filter(r => (r.flagCount || 0) < 2);
  if (!visible.length) { el.innerHTML = `<div class="card empty">No reports yet. Be the first to log your area.</div>`; return; }
  const byArea = {};
  visible.forEach(r => { const key = (r.area || 'Unnamed area').trim(); (byArea[key] = byArea[key] || []).push(r); });

  const cards = Object.entries(byArea).sort((a, b) => b[1].length - a[1].length).map(([area, list]) => {
    const sorted = [...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const avg = sorted.reduce((s, r) => s + Number(r.severity || 3), 0) / sorted.length;
    const score = Math.max(0, Math.round(100 - avg * 18));

    let trendHtml = `<span class="trend flat">steady</span>`;
    if (sorted.length >= 4) {
      const mid = Math.floor(sorted.length / 2);
      const olderAvg = sorted.slice(0, mid).reduce((s, r) => s + Number(r.severity || 3), 0) / mid;
      const recentAvg = sorted.slice(mid).reduce((s, r) => s + Number(r.severity || 3), 0) / (sorted.length - mid);
      if (recentAvg < olderAvg - 0.3) trendHtml = `<span class="trend up">improving</span>`;
      else if (recentAvg > olderAvg + 0.3) trendHtml = `<span class="trend down">worsening</span>`;
    }

    let divertible = 0, total = 0;
    sorted.forEach(r => { (r.categories || []).forEach(c => { total++; if (c === 'recycle' || c === 'compost') divertible++; }); });
    const divertPct = total ? Math.round((divertible / total) * 100) : null;

    const lines = sorted.slice(-4).reverse().map(r => {
      return `<div class="report-line">
        <span class="sev" style="background:${severityColor(Number(r.severity))}"></span>${escapeHtml(r.description) || '(no details)'} — severity ${r.severity}${r.coords ? ' · 📍' : ''}${r.resolved ? ' · ✅ cleaned' : ''}
        ${r.photoUrl ? `<br><img src="${r.photoUrl}" class="report-photo" alt="Reported litter photo">` : ''}
        <div style="margin-top:4px;">
          ${!r.resolved ? `<button class="btn-ghost" style="margin-top:4px;padding:6px;font-size:.75rem;" data-resolve="${r.id}">Mark as cleaned</button>` : ''}
          <button class="btn-ghost" style="margin-top:4px;padding:6px;font-size:.75rem;color:var(--rust);border-color:var(--rust);" data-flag="${r.id}">Flag as spam</button>
        </div>
      </div>`;
    }).join('');

    return `<div class="card area-card">
      <h3>${escapeHtml(area)} <span>${trendHtml}</span></h3>
      <div class="sub">${list.length} report${list.length > 1 ? 's' : ''} · cleanliness score
        <span class="score-ring" style="color:${severityColor(avg)}"> ${score}</span>/100
      </div>
      ${divertPct !== null ? `<div style="font-size:.85rem;margin-bottom:6px;">${divertPct}% of tagged litter here was recyclable or compostable material that missed a bin
        <div class="bar-track"><div class="bar-fill" style="width:${divertPct}%"></div></div></div>` : ''}
      ${lines}
      <button class="btn-ghost" data-adopt="${escapeHtml(area)}">Adopt this area</button>
    </div>`;
  }).join('');
  el.innerHTML = cards;

  el.querySelectorAll('[data-adopt]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await API.adoptArea(btn.dataset.adopt); } catch {}
      btn.textContent = 'Adopted'; btn.disabled = true;
    });
  });
  el.querySelectorAll('[data-flag]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await API.flagReport(btn.dataset.flag); } catch {}
      btn.textContent = 'Flagged'; btn.disabled = true;
      loadReports();
    });
  });
  el.querySelectorAll('[data-resolve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await API.resolveReport(btn.dataset.resolve); } catch {}
      btn.textContent = 'Cleaned ✓'; btn.disabled = true;
    });
  });
}

async function loadReports() {
  try {
    const reports = await API.getReports();
    renderMap(reports);
    renderTrending(reports);
    renderAreaSummaries(reports);
  } catch {}
}

// ── Dashboard tab ──
async function loadDashboard() {
  try {
    const reports = await API.getReports();
    document.getElementById('dashTotal').textContent = reports.length;
    document.getElementById('dashResolved').textContent = reports.filter(r => r.resolved).length;
    const areaSet = new Set(reports.map(r => (r.area || '').trim()).filter(Boolean));
    document.getElementById('dashAreas').textContent = areaSet.size;

    const counts = { recycle: 0, compost: 0, trash: 0, hazard: 0 };
    reports.forEach(r => (r.categories || []).forEach(c => { if (counts[c] !== undefined) counts[c]++; }));
    const totalTags = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    document.getElementById('wasteComposition').innerHTML = Object.entries(counts).map(([k, v]) => {
      const pct = Math.round(v / totalTags * 100);
      const meta = CAT_META[k];
      return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:.85rem;"><span>${meta.label}</span><span>${pct}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${meta.color}"></div></div></div>`;
    }).join('');

    const byArea = {};
    reports.forEach(r => { const k = (r.area || 'Unnamed area').trim(); byArea[k] = (byArea[k] || 0) + 1; });
    const top = Object.entries(byArea).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('recurringAreas').innerHTML = top.length ? top.map(([a, c]) =>
      `<div class="item-row" style="--mc:var(--clay)"><span class="name">${escapeHtml(a)}</span></div><div style="font-size:.78rem;color:var(--sub);margin:-6px 0 6px 12px;">${c} reports</div>`
    ).join('') : `<div class="empty">No data yet.</div>`;

    const resolvedReports = reports.filter(r => r.resolved && r.resolvedAt);
    if (resolvedReports.length >= 3) {
      const byAreaResolved = {};
      resolvedReports.forEach(r => { const k = (r.area || '').trim(); (byAreaResolved[k] = byAreaResolved[k] || []).push(r); });
      let improved = 0, checked = 0;
      Object.values(byAreaResolved).forEach(list => {
        const areaAll = reports.filter(r => (r.area || '').trim() === (list[0].area || '').trim());
        const afterTs = Math.max(...list.map(r => new Date(r.resolvedAt).getTime()));
        const before = areaAll.filter(r => new Date(r.createdAt).getTime() < afterTs);
        const after = areaAll.filter(r => new Date(r.createdAt).getTime() >= afterTs);
        if (before.length && after.length) {
          checked++;
          const bAvg = before.reduce((s, r) => s + Number(r.severity || 3), 0) / before.length;
          const aAvg = after.reduce((s, r) => s + Number(r.severity || 3), 0) / after.length;
          if (aAvg < bAvg) improved++;
        }
      });
      document.getElementById('beforeAfterStat').textContent = checked
        ? `In ${improved} of ${checked} areas measured, severity dropped after a cleanup was marked — early signal that intervention helps.`
        : 'Not enough before/after data yet to measure.';
    }
  } catch {}
}

// ── Rewards tab ──
async function loadRewards() {
  try {
    const [stats, adoptions] = await Promise.all([API.getRewards(), API.getAdoptions()]);
    document.getElementById('levelBadge').textContent = 'L' + stats.level;
    document.getElementById('rewardsLevel').textContent = 'Level ' + stats.level;
    document.getElementById('rewardsPoints').textContent = stats.points + ' points';
    document.getElementById('levelBarFill').style.width = (stats.progress * 100) + '%';
    document.getElementById('levelProgressText').textContent = `${stats.points} / ${stats.nextLevelPoints} to next level`;
    document.getElementById('rwStreak').textContent = stats.streak;
    document.getElementById('rwReports').textContent = stats.totalReports;
    document.getElementById('rwAdopted').textContent = stats.adoptedAreas;
    document.getElementById('rwResolved').textContent = stats.resolvedCount;
    document.getElementById('headerPoints').textContent = stats.points + ' pts';

    document.getElementById('badgeGrid').innerHTML = stats.badges.map(b =>
      `<div class="badge-item ${b.earned ? 'earned' : 'locked'}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      </div>`
    ).join('');

    const myAdopted = [...new Set(adoptions.filter(a => a.user_id === API.user?.id).map(a => a.area))];
    document.getElementById('myAreas').innerHTML = myAdopted.length
      ? myAdopted.map(a => `<div class="item-row" style="--mc:var(--moss)"><span class="name">${escapeHtml(a)}</span></div>`).join('')
      : `<div class="empty">No areas adopted yet — visit the Areas tab.</div>`;
  } catch {}
}

// ── Resources tab ──
function renderResources() {
  document.getElementById('resourceList1').innerHTML = RESOURCES.slice(0, 3).map(r =>
    `<div class="item-row" style="--mc:${r.color}"><span class="name">${r.title}<br><span class="note">${r.note}</span></span></div>`
  ).join('');
  document.getElementById('resourceList2').innerHTML = RESOURCES.slice(3).map(r =>
    `<div class="item-row" style="--mc:${r.color}"><span class="name">${r.title}<br><span class="note">${r.note}</span></span></div>`
  ).join('');
}

// ── Report submission ──
async function submitReport() {
  const area = document.getElementById('areaName').value.trim();
  const description = document.getElementById('areaDesc').value.trim();
  const severity = parseInt(document.getElementById('areaSeverity').value);
  const status = document.getElementById('reportStatus');
  const fileInput = document.getElementById('photoInput');
  if (!area) { status.textContent = 'Please enter an area name.'; return; }
  status.textContent = 'Submitting...';
  let photoUrl = null;
  if (fileInput.files[0]) {
    try { photoUrl = await resizeImage(fileInput.files[0]); } catch {}
  }
  try {
    await API.createReport({ area, description, severity, categories: [...selectedCats], coords: myCoords, photoUrl });
    document.getElementById('areaName').value = '';
    document.getElementById('areaDesc').value = '';
    fileInput.value = '';
    selectedCats.clear();
    myCoords = null;
    document.getElementById('locStatus').textContent = '';
    document.querySelectorAll('#catChips .chip').forEach(c => c.classList.remove('on'));
    status.textContent = 'Report submitted. Thank you 🌱';
  } catch (err) {
    status.textContent = err.message;
  }
}

// ── Tab switching ──
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  document.getElementById(tabName).style.display = 'block';
  if (tabName === 'areas') loadReports();
  if (tabName === 'dashboard') loadDashboard();
  if (tabName === 'rewards') loadRewards();
}

// ── Init ──
function initApp() {
  renderItems();
  renderResources();

  document.getElementById('search').addEventListener('input', e => { searchTerm = e.target.value; renderItems(); });
  document.querySelectorAll('#filterChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#filterChips .chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      activeFilter = chip.dataset.filter;
      renderItems();
    });
  });

  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.querySelectorAll('#catChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const c = chip.dataset.cat;
      if (selectedCats.has(c)) { selectedCats.delete(c); chip.classList.remove('on'); }
      else { selectedCats.add(c); chip.classList.add('on'); }
    });
  });

  document.getElementById('useLocation').addEventListener('click', () => {
    const locStatus = document.getElementById('locStatus');
    if (!navigator.geolocation) { locStatus.textContent = 'Location isn\'t available on this device.'; return; }
    locStatus.textContent = 'Getting location...';
    navigator.geolocation.getCurrentPosition(
      pos => { myCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude }; locStatus.textContent = 'Location attached ✓'; },
      () => { locStatus.textContent = 'Couldn\'t get location — you can still submit without it.'; },
      { timeout: 8000 }
    );
  });

  document.getElementById('submitReport').addEventListener('click', submitReport);
}

// Start when authed
window.addEventListener('ayese:authed', initApp, { once: true });
if (API.isLoggedIn()) initApp();
