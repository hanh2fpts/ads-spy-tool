// public/app.js
let currentCampaigns = [];
let sortCol = null;
let sortAsc = true;
let currentAdvertiserId = '';

const input = document.getElementById('advertiserIdInput');
const scrapeBtn = document.getElementById('scrapeBtn');
const errorMsg = document.getElementById('errorMsg');
const statsBar = document.getElementById('statsBar');
const loadingState = document.getElementById('loadingState');
const loadingStep = document.getElementById('loadingStep');
const cardView = document.getElementById('cardView');
const tableView = document.getElementById('tableView');
const tableBody = document.getElementById('tableBody');
const cardViewBtn = document.getElementById('cardViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const exportBtn = document.getElementById('exportBtn');

scrapeBtn.addEventListener('click', runScrape);
input.addEventListener('keydown', e => { if (e.key === 'Enter') runScrape(); });
cardViewBtn.addEventListener('click', () => showView('card'));
tableViewBtn.addEventListener('click', () => showView('table'));
exportBtn.addEventListener('click', doExport);

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    renderTable(currentCampaigns);
  });
});

async function runScrape() {
  const advertiserId = input.value.trim();
  setError('');
  if (!advertiserId) { setError('Vui lòng nhập Advertiser ID.'); return; }

  currentAdvertiserId = advertiserId;
  setLoading(true, 'Đang mở trình duyệt...');
  scrapeBtn.disabled = true;
  statsBar.classList.add('hidden');
  cardView.classList.add('hidden');
  tableView.classList.add('hidden');

  const steps = ['Đang mở trình duyệt...', 'Đang tải trang Google ATC...', 'Đang lấy dữ liệu...'];
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    loadingStep.textContent = steps[stepIdx];
  }, 4000);

  try {
    const res = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advertiserId }),
    });
    const data = await res.json();
    clearInterval(stepTimer);

    if (!res.ok) { setError(data.error); return; }

    currentCampaigns = data.campaigns;
    renderStats(currentCampaigns);
    renderCards(currentCampaigns);
    renderTable(currentCampaigns);
    statsBar.classList.remove('hidden');
    showView('card');
  } catch (_) {
    clearInterval(stepTimer);
    setError('Không thể kết nối server. Hãy đảm bảo server đang chạy.');
  } finally {
    setLoading(false);
    scrapeBtn.disabled = false;
  }
}

function renderStats(campaigns) {
  const active = campaigns.filter(c => c.isActive).length;
  document.getElementById('statTotal').textContent = `📦 ${campaigns.length} dự án`;
  document.getElementById('statActive').textContent = `✅ ${active} đang chạy`;
  document.getElementById('statInactive').textContent = `⏹ ${campaigns.length - active} đã tắt`;
}

function renderCards(campaigns) {
  cardView.innerHTML = campaigns.map(c => `
    <div class="card">
      ${c.thumbnailUrl
        ? `<img class="card-thumb" src="${c.thumbnailUrl}" alt="${c.name}" loading="lazy" />`
        : `<div class="card-thumb-placeholder">Không có ảnh</div>`}
      <div class="card-body">
        <div class="card-name">${c.name}</div>
        <div class="card-meta">
          📅 ${c.startDate || '?'} → ${c.endDate || 'nay'}<br/>
          📺 ${c.formats.join(' · ') || '—'}
        </div>
        <span class="badge ${c.isActive ? 'active' : 'inactive'}">
          ${c.isActive ? '● Đang chạy' : '⏹ Đã tắt'}
        </span>
      </div>
    </div>
  `).join('');
}

function renderTable(campaigns) {
  let sorted = [...campaigns];
  if (sortCol) {
    sorted.sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  tableBody.innerHTML = sorted.map(c => `
    <tr>
      <td>${c.name}</td>
      <td>${c.startDate || '—'}</td>
      <td>${c.endDate || '—'}</td>
      <td>${c.formats.join(' · ') || '—'}</td>
      <td><span class="badge ${c.isActive ? 'active' : 'inactive'}">${c.isActive ? 'Đang chạy' : 'Đã tắt'}</span></td>
    </tr>
  `).join('');
}

function showView(view) {
  cardView.classList.toggle('hidden', view !== 'card');
  tableView.classList.toggle('hidden', view !== 'table');
  cardViewBtn.classList.toggle('active', view === 'card');
  tableViewBtn.classList.toggle('active', view === 'table');
}

function doExport() {
  if (!currentAdvertiserId) return;
  window.location.href = `/api/export?advertiserId=${currentAdvertiserId}`;
}

function setError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.toggle('hidden', !msg);
}

function setLoading(show, step = '') {
  loadingState.classList.toggle('hidden', !show);
  if (step) loadingStep.textContent = step;
}
