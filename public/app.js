// public/app.js
let currentCampaigns = [];
let sortCol = null;
let sortAsc = true;
let currentAdvertiserId = '';
let activeStream = null; // current EventSource

function calcDays(startDate, endDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : null;
}

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
const clearCacheBtn = document.getElementById('clearCacheBtn');
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
clearCacheBtn.addEventListener('click', doClearCache);

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    renderTable(currentCampaigns);
  });
});

function runScrape() {
  const advertiserId = input.value.trim();
  setError('');
  if (!advertiserId) { setError('Vui lòng nhập Advertiser ID.'); return; }

  // Cancel any in-progress stream
  if (activeStream) { activeStream.close(); activeStream = null; }

  currentAdvertiserId = advertiserId;
  currentCampaigns = [];
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

  let firstPage = true;

  const es = new EventSource(`/api/scrape-stream?advertiserId=${encodeURIComponent(advertiserId)}`);
  activeStream = es;

  es.addEventListener('page', (e) => {
    const data = JSON.parse(e.data);
    currentCampaigns.push(...data.campaigns);

    const stillLoading = !data.done;
    if (firstPage) {
      clearInterval(stepTimer);
      firstPage = false;
      renderStats(currentCampaigns, stillLoading);
      renderCards(currentCampaigns);
      renderTable(currentCampaigns);
      statsBar.classList.remove('hidden');
      showView('table');
      setLoading(false);
    } else {
      renderStats(currentCampaigns, stillLoading);
      if (sortCol) {
        renderTable(currentCampaigns);
      } else {
        appendTableRows(data.campaigns);
      }
      appendCards(data.campaigns);
    }

    if (data.done) {
      es.close();
      activeStream = null;
      scrapeBtn.disabled = false;
      setLoadingMore(false);
    } else {
      setLoadingMore(true, data.total || currentCampaigns.length);
    }
  });

  es.addEventListener('error', (e) => {
    clearInterval(stepTimer);
    es.close();
    activeStream = null;
    scrapeBtn.disabled = false;
    setLoading(false);
    setLoadingMore(false);
    if (e.data) {
      try {
        const d = JSON.parse(e.data);
        setError(d.error || 'Lỗi không xác định từ server.');
      } catch (_) {}
    }
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) return;
    clearInterval(stepTimer);
    es.close();
    activeStream = null;
    scrapeBtn.disabled = false;
    setLoading(false);
    setLoadingMore(false);
    if (!currentCampaigns.length) {
      setError('Không thể kết nối server. Hãy đảm bảo server đang chạy.');
    }
  };
}

function setLoadingMore(show, total = 0) {
  let el = document.getElementById('loadingMoreBar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loadingMoreBar';
    el.style.cssText = 'text-align:center;padding:8px;font-size:13px;color:#64748b';
    tableView.appendChild(el);
  }
  el.style.display = show ? '' : 'none';
  if (show) el.textContent = `Đang tải thêm... (${total} quảng cáo)`;
}

function appendTableRows(campaigns) {
  const rows = campaigns.map(c => {
    const days = calcDays(c.startDate, c.endDate);
    const urlCell = c.homepageUrl
      ? `<a class="table-atc-link" href="${esc(c.homepageUrl)}" target="_blank" rel="noopener noreferrer">${esc(new URL(c.homepageUrl).hostname)}</a>`
      : '—';
    return `<tr>
      <td class="td-name">${esc(c.name)}</td>
      <td class="td-url">${urlCell}</td>
      <td>${esc(c.startDate || '—')}</td>
      <td>${esc(c.endDate || '—')}</td>
      <td class="td-days">${days !== null ? days : '—'}</td>
      <td>${esc(c.formats.join(' · ') || '—')}</td>
      <td><span class="badge ${c.isActive ? 'active' : 'inactive'}">${c.isActive ? 'Đang chạy' : 'Đã tắt'}</span></td>
      <td>${c.creativeId ? `<a class="table-atc-link" href="https://adstransparency.google.com/advertiser/${esc(currentAdvertiserId)}/creative/${esc(c.creativeId)}?region=anywhere" target="_blank" rel="noopener noreferrer">🔗 Xem quảng cáo</a>` : '—'}</td>
    </tr>`;
  }).join('');
  tableBody.insertAdjacentHTML('beforeend', rows);
}

function appendCards(campaigns) {
  const html = campaigns.map(c => `
    <div class="card">
      ${c.thumbnailUrl
        ? `<img class="card-thumb" src="${esc(c.thumbnailUrl)}" alt="${esc(c.name)}" loading="lazy" />`
        : `<div class="card-thumb-placeholder">Không có ảnh</div>`}
      <div class="card-body">
        <div class="card-name">${esc(c.name)}</div>
        ${c.homepageUrl
          ? `<div class="card-url"><a href="${esc(c.homepageUrl)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(c.homepageUrl)}</a></div>`
          : ''}
        <div class="card-meta">
          📅 ${esc(c.startDate || '?')} → ${esc(c.endDate || 'nay')}
          ${calcDays(c.startDate, c.endDate) !== null ? `· ${calcDays(c.startDate, c.endDate)} ngày` : ''}<br/>
          📺 ${esc(c.formats.join(' · ') || '—')}
        </div>
        <span class="badge ${c.isActive ? 'active' : 'inactive'}">
          ${c.isActive ? '● Đang chạy' : '⏹ Đã tắt'}
        </span>
        ${c.creativeId ? `<a class="card-detail-btn" href="https://adstransparency.google.com/advertiser/${esc(currentAdvertiserId)}/creative/${esc(c.creativeId)}?region=anywhere" target="_blank" rel="noopener noreferrer">🔗 Xem quảng cáo</a>` : ''}
      </div>
    </div>
  `).join('');
  cardView.insertAdjacentHTML('beforeend', html);
}

function renderStats(campaigns, loading = false) {
  const prefix = loading ? '~' : '';
  const active = campaigns.filter(c => c.isActive).length;
  document.getElementById('statTotal').textContent = `📦 ${prefix}${campaigns.length} dự án`;
  document.getElementById('statActive').textContent = `✅ ${prefix}${active} đang chạy`;
  document.getElementById('statInactive').textContent = `⏹ ${prefix}${campaigns.length - active} đã tắt`;
}

function renderCards(campaigns) {
  cardView.innerHTML = campaigns.map(c => `
    <div class="card">
      ${c.thumbnailUrl
        ? `<img class="card-thumb" src="${esc(c.thumbnailUrl)}" alt="${esc(c.name)}" loading="lazy" />`
        : `<div class="card-thumb-placeholder">Không có ảnh</div>`}
      <div class="card-body">
        <div class="card-name">${esc(c.name)}</div>
        ${c.homepageUrl
          ? `<div class="card-url"><a href="${esc(c.homepageUrl)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(c.homepageUrl)}</a></div>`
          : ''}
        <div class="card-meta">
          📅 ${esc(c.startDate || '?')} → ${esc(c.endDate || 'nay')}
          ${calcDays(c.startDate, c.endDate) !== null ? `· ${calcDays(c.startDate, c.endDate)} ngày` : ''}<br/>
          📺 ${esc(c.formats.join(' · ') || '—')}
        </div>
        <span class="badge ${c.isActive ? 'active' : 'inactive'}">
          ${c.isActive ? '● Đang chạy' : '⏹ Đã tắt'}
        </span>
        ${c.creativeId ? `<a class="card-detail-btn" href="https://adstransparency.google.com/advertiser/${esc(currentAdvertiserId)}/creative/${esc(c.creativeId)}?region=anywhere" target="_blank" rel="noopener noreferrer">🔗 Xem quảng cáo</a>` : ''}
      </div>
    </div>
  `).join('');

}

function renderTable(campaigns) {
  let sorted = [...campaigns];
  if (sortCol) {
    sorted.sort((a, b) => {
      const va = sortCol === '_days' ? (calcDays(a.startDate, a.endDate) ?? -1) : (a[sortCol] ?? '');
      const vb = sortCol === '_days' ? (calcDays(b.startDate, b.endDate) ?? -1) : (b[sortCol] ?? '');
      if (typeof va === 'number') return sortAsc ? va - vb : vb - va;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }
  tableBody.innerHTML = sorted.map(c => {
    const days = calcDays(c.startDate, c.endDate);
    const urlCell = c.homepageUrl
      ? `<a class="table-atc-link" href="${esc(c.homepageUrl)}" target="_blank" rel="noopener noreferrer">${esc(new URL(c.homepageUrl).hostname)}</a>`
      : '—';
    return `
    <tr>
      <td class="td-name">${esc(c.name)}</td>
      <td class="td-url">${urlCell}</td>
      <td>${esc(c.startDate || '—')}</td>
      <td>${esc(c.endDate || '—')}</td>
      <td class="td-days">${days !== null ? days : '—'}</td>
      <td>${esc(c.formats.join(' · ') || '—')}</td>
      <td><span class="badge ${c.isActive ? 'active' : 'inactive'}">${c.isActive ? 'Đang chạy' : 'Đã tắt'}</span></td>
      <td>${c.creativeId ? `<a class="table-atc-link" href="https://adstransparency.google.com/advertiser/${esc(currentAdvertiserId)}/creative/${esc(c.creativeId)}?region=anywhere" target="_blank" rel="noopener noreferrer">🔗 Xem quảng cáo</a>` : '—'}</td>
    </tr>`;
  }).join('');
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

async function doClearCache() {
  if (!currentAdvertiserId) return;
  if (activeStream) { activeStream.close(); activeStream = null; }
  await fetch('/api/clear-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ advertiserId: currentAdvertiserId }),
  });
  runScrape();
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

  // Raw OCR text fallback (when structured parse produced no results)
  if (d.ocrText && d.headlines.length === 0 && d.descriptions.length === 0) {
    sections.push(`<div class="detail-section"><h3>Nội dung nhận dạng (OCR)</h3><div class="detail-text-item" style="white-space:pre-wrap">${esc(d.ocrText)}</div></div>`);
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
