// public/app.js
let currentCampaigns = [];
let sortCol = null;
let sortAsc = true;
let currentAdvertiserId = '';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
const creativeModal = document.getElementById('creativeModal');
const modalBody = document.getElementById('modalBody');
document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
creativeModal.addEventListener('click', e => { if (e.target === creativeModal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

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

    if (!res.ok) { setError(data.error || 'Lỗi không xác định từ server.'); return; }

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
        ? `<img class="card-thumb" src="${esc(c.thumbnailUrl)}" alt="${esc(c.name)}" loading="lazy" />`
        : `<div class="card-thumb-placeholder">Không có ảnh</div>`}
      <div class="card-body">
        <div class="card-name">${esc(c.name)}</div>
        <div class="card-meta">
          📅 ${esc(c.startDate || '?')} → ${esc(c.endDate || 'nay')}<br/>
          📺 ${esc(c.formats.join(' · ') || '—')}
        </div>
        <span class="badge ${c.isActive ? 'active' : 'inactive'}">
          ${c.isActive ? '● Đang chạy' : '⏹ Đã tắt'}
        </span>
        ${c.creativeId ? `<button class="card-detail-btn" data-creative="${esc(c.creativeId)}">🔍 Xem mẫu quảng cáo</button>` : ''}
      </div>
    </div>
  `).join('');

  cardView.querySelectorAll('.card-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => openCreativeDetail(btn.dataset.creative));
  });
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
      <td>${esc(c.name)}</td>
      <td>${esc(c.startDate || '—')}</td>
      <td>${esc(c.endDate || '—')}</td>
      <td>${esc(c.formats.join(' · ') || '—')}</td>
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
  window.location.href = `/api/export?advertiserId=${encodeURIComponent(currentAdvertiserId)}`;
}

function setError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.toggle('hidden', !msg);
}

function setLoading(show, step = '') {
  loadingState.classList.toggle('hidden', !show);
  if (step) loadingStep.textContent = step;
}

function closeModal() {
  creativeModal.classList.add('hidden');
  modalBody.innerHTML = '';
}

async function openCreativeDetail(creativeId) {
  creativeModal.classList.remove('hidden');
  modalBody.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
      <div>Đang tải mẫu quảng cáo...</div>
    </div>`;

  try {
    const params = new URLSearchParams({ advertiserId: currentAdvertiserId, creativeId });
    const res = await fetch(`/api/creative-detail?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
    renderCreativeDetail(data);
  } catch (err) {
    modalBody.innerHTML = `<p class="detail-empty" style="padding:20px">${esc(err.message)}</p>`;
  }
}

function renderCreativeDetail(d) {
  const sections = [];

  // Thumbnails / image components
  if (d.images && d.images.length > 0) {
    const unique = d.images.filter((img, i, arr) => arr.findIndex(x => x.url === img.url) === i);
    const imgs = unique.map(img => `
      <div>
        <img src="${esc(img.url)}" loading="lazy" style="max-height:120px" />
        ${img.width && img.height ? `<div class="detail-image-label">${img.width}×${img.height}</div>` : ''}
      </div>`).join('');
    sections.push(`<div class="detail-section"><h3>Thành phần ảnh</h3><div class="detail-images">${imgs}</div></div>`);
  }

  // Headlines
  if (d.headlines && d.headlines.length > 0) {
    const items = d.headlines.map(h => `<div class="detail-text-item">${esc(h)}</div>`).join('');
    sections.push(`<div class="detail-section"><h3>Tiêu đề</h3><div class="detail-text-list">${items}</div></div>`);
  }

  // Descriptions
  if (d.descriptions && d.descriptions.length > 0) {
    const items = d.descriptions.map(desc => `<div class="detail-text-item">${esc(desc)}</div>`).join('');
    sections.push(`<div class="detail-section"><h3>Mô tả</h3><div class="detail-text-list">${items}</div></div>`);
  }

  // Keywords (video URL or other metadata)
  if (d.keywords && d.keywords.length > 0) {
    const items = d.keywords.map(k => `<div class="detail-text-item">${esc(k.type)}: ${esc(k.value)}</div>`).join('');
    sections.push(`<div class="detail-section"><h3>Từ khoá / Metadata</h3><div class="detail-text-list">${items}</div></div>`);
  }

  // Preview link
  if (d.previewUrls && d.previewUrls.length > 0) {
    sections.push(`
      <div class="detail-section">
        <h3>Xem trực tiếp</h3>
        <a class="detail-preview-link" href="${esc(d.previewUrls[0])}" target="_blank" rel="noopener noreferrer">
          Mở preview quảng cáo ↗
        </a>
      </div>`);
  }

  if (sections.length === 0) {
    sections.push(`<p class="detail-empty">Không có dữ liệu chi tiết cho quảng cáo này.</p>`);
  }

  const creativeLabel = d.creativeId ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:16px">${esc(d.creativeId)}</div>` : '';
  modalBody.innerHTML = creativeLabel + sections.join('');
}
