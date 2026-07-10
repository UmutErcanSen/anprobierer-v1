const state = {
  apiKey: '',
  personPhoto: null,
  clothingItems: [],
  generationMode: 'single',
  generatedImages: [],
  currentStep: 1,
  generationDone: false,
  isGenerating: false,
  selectedQuality: 'medium',
  selectedSize: '1024x1536',
};

// ============ API KEY ============

const apiKeyInput = $('#apiKeyInput');
const apiStatusDot = $('#apiStatusDot');

function loadApiKey() {
  const saved = localStorage.getItem('openai_api_key');
  if (saved) {
    apiKeyInput.value = saved;
    state.apiKey = saved;
    updateApiStatus(true);
  }
}

function validateApiKey(key) {
  return key.startsWith('sk-') && key.length >= 20;
}

function updateApiStatus(valid, isTesting) {
  apiStatusDot.className = 'status-dot' + (valid ? ' ready' : '') + (isTesting ? '' : '');
  if (valid) apiKeyInput.classList.add('valid');
  else apiKeyInput.classList.remove('valid');
}

apiKeyInput.addEventListener('input', () => {
  const key = apiKeyInput.value.trim();
  if (validateApiKey(key)) {
    state.apiKey = key;
    localStorage.setItem('openai_api_key', key);
    updateApiStatus(true);
  } else if (!key) {
    state.apiKey = '';
    localStorage.removeItem('openai_api_key');
    updateApiStatus(false);
  } else {
    apiStatusDot.className = 'status-dot error';
    apiKeyInput.classList.remove('valid');
  }
});

window.testApiKey = async function () {
  const key = state.apiKey;
  if (!validateApiKey(key)) { showToast('Bitte gültigen OpenAI API-Key eingeben (beginnt mit sk-).', 'warning'); return }
  const btn = document.getElementById('testKeyBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Teste...';
  apiStatusDot.className = 'status-dot';

  try {
    await testApiKey(key);
    updateApiStatus(true);
    showToast('✅ API-Key ist gültig!', 'success');
  } catch (err) {
    if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
      apiStatusDot.className = 'status-dot error';
      showToast('🔑 Ungültiger API-Key. Prüfe den Key auf platform.openai.com/api-keys', 'error');
    } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      showToast('⏱ Verbindung zu OpenAI dauert zu lange. Internet prüfen?', 'error');
    } else {
      apiStatusDot.className = 'status-dot error';
      showToast(`🌐 ${err.message}`, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Testen' }
  }
};

// ============ STEP NAVIGATION ============

function goToStep(n) {
  const prev = state.currentStep;
  state.currentStep = n;

  const currentSec = document.getElementById(`step${prev}`);
  const nextSec = document.getElementById(`step${n}`);

  if (currentSec && currentSec !== nextSec) {
    currentSec.classList.remove('visible');
    currentSec.classList.add(n > prev ? 'exit-left' : 'exit-right');
    setTimeout(() => currentSec.classList.remove('exit-left', 'exit-right'), 350);
  }

  if (nextSec) {
    nextSec.classList.remove('visible');
    nextSec.classList.add(n > prev ? 'enter-right' : 'enter-left');
    nextSec.classList.add('visible');
    setTimeout(() => nextSec.classList.remove('enter-right', 'enter-left'), 350);
  }

  $$('.step-node').forEach(t => {
    t.classList.remove('active');
    const sn = parseInt(t.dataset.step, 10);
    if (sn === n) t.classList.add('active');
    else if (sn < n) t.classList.add('done');
    else t.classList.remove('done');
  });

  $$('.step-connector').forEach(c => {
    const prevNode = c.previousElementSibling;
    if (prevNode) {
      const sn = parseInt(prevNode.dataset.step, 10);
      c.classList.toggle('done', sn < n);
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ STEP 1: PERSON PHOTO ============

const personDropZone = $('#personDropZone');
const personFileInput = $('#personFileInput');
const personPreview = $('#personPreview');

async function handlePersonFile(file) {
  if (!file) return;
  const maxSize = 20 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Das Foto ist zu groß. Maximal 20 MB erlaubt.', 'error');
    return;
  }
  try {
    const converted = await convertImageToStandard(file);
    const data = await fileToBase64(converted);
    state.personPhoto = data;
    renderPersonPreview();
    const stepsBar = document.getElementById('stepsBar');
    if (stepsBar) stepsBar.classList.replace('hidden', 'show');
    const middle = document.getElementById('step1MiddleSection');
    if (middle) { middle.classList.remove('hidden-zone'); middle.classList.add('fade-in'); }
    const initView = document.getElementById('step1InitialView');
    if (initView) initView.style.display = 'none';
    const nextBtn = document.getElementById('step1Next');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
    showToast('Personenfoto erfolgreich geladen', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPersonPreview() {
  if (!state.personPhoto) {
    personPreview.style.display = 'none';
    personDropZone.classList.remove('has-file');
    return;
  }
  personDropZone.classList.add('has-file');
  personPreview.style.display = 'block';
  personPreview.innerHTML = `<div style="position:relative;display:inline-block">
    <img src="${base64ToDataUrl(state.personPhoto.base64, state.personPhoto.mimeType)}" alt="Person">
    <button class="remove-person-btn" id="removePersonBtn">×</button>
  </div>`;
  document.getElementById('removePersonBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.personPhoto = null;
    personPreview.style.display = 'none';
    personDropZone.classList.remove('has-file');
    personFileInput.value = '';
    const stepsBar = document.getElementById('stepsBar');
    if (stepsBar) stepsBar.classList.replace('show', 'hidden');
    const middle = document.getElementById('step1MiddleSection');
    if (middle) middle.classList.add('hidden-zone');
    const initView = document.getElementById('step1InitialView');
    if (initView) initView.style.display = '';
    const nextBtn = document.getElementById('step1Next');
    if (nextBtn) nextBtn.style.display = 'none';
    const tipRow = document.getElementById('photoTipRow');
    if (tipRow) tipRow.style.display = 'none';
  });
}

personDropZone.addEventListener('dragover', e => { e.preventDefault(); personDropZone.classList.add('drag-over') });
personDropZone.addEventListener('dragleave', () => personDropZone.classList.remove('drag-over'));
personDropZone.addEventListener('drop', e => {
  e.preventDefault();
  personDropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) handlePersonFile(f);
  else showToast('Bitte nur Bilddateien hochladen.', 'warning');
});
personFileInput.addEventListener('change', () => {
  if (personFileInput.files[0]) handlePersonFile(personFileInput.files[0]);
});

$('#step1StartBtn').addEventListener('click', () => {
  document.getElementById('heroSection').classList.add('hero-hidden');
  document.getElementById('step1MiddleSection').classList.add('hidden-zone');
  const dz = document.getElementById('personDropZone');
  dz.classList.remove('hidden-zone');
  dz.classList.add('fade-in');
  document.getElementById('step1StartBtn').disabled = true;
  const tipRow = document.getElementById('photoTipRow');
  if (tipRow) tipRow.style.display = 'block';
});

$('#step1Next').addEventListener('click', () => {
  if (!state.personPhoto) { showToast('Bitte zuerst ein Personenfoto hochladen.', 'warning'); return }
  if (!state.apiKey || !validateApiKey(state.apiKey)) { showToast('Bitte gültigen OpenAI API-Key eingeben.', 'warning'); return }
  goToStep(2);
});

// ============ STEP 2: CLOTHING ITEMS ============

const clothingDropZone = $('#clothingDropZone');
const clothingFileInput = $('#clothingFileInput');
const clothingPreviewGrid = $('#clothingPreviewGrid');
const noClothingHint = $('#noClothingHint');

async function handleClothingFiles(files) {
  const maxSize = 20 * 1024 * 1024;
  const promises = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (f.size > maxSize) { showToast(`${f.name} ist zu groß (max 20 MB). Übersprungen.`, 'warning'); continue }
    promises.push(convertImageToStandard(f).then(converted => fileToBase64(converted)).then(data => {
      state.clothingItems.push({ id: generateId(), ...data, type: '', size: '', colors: [] });
    }));
  }
  if (!promises.length) return;
  try {
    await Promise.all(promises);
    renderClothingPreviews();
    const count = state.clothingItems.length;
    clothingDropZone.querySelector('.upload-count')?.remove();
    const badge = document.createElement('div');
    badge.className = 'upload-count';
    badge.textContent = `${count} Kleidungsstück${count > 1 ? 'e' : ''} hochgeladen`;
    clothingDropZone.after(badge);
    showToast(`${promises.length} Kleidungsstück${promises.length > 1 ? 'e' : ''} hinzugefügt`, 'success');
  } catch (err) {
    showToast('Fehler beim Verarbeiten der Bilder.', 'error');
  }
}

function getColorHex(value) {
  const c = COLORS.find(c => c.value === value);
  return c ? c.hex : '';
}

function getColorLabel(value) {
  const c = COLORS.find(c => c.value === value);
  return c ? c.label : '';
}

function isMobile() { return window.innerWidth < 640 }

function buildColorTrigger(item) {
  const colors = item.colors || [];
  if (colors.length === 0) return '<span class="trigger-label">Farbe wählen</span>';
  const dots = colors.map(c => {
    const hex = getColorHex(c);
    return `<span class="color-dot" style="background:${hex||'transparent'}"></span>`;
  });
  const labels = colors.map(c => getColorLabel(c)).join(', ');
  return `<span class="color-dots">${dots.join('')}</span><span class="trigger-label">${escapeHtml(labels)}</span>`;
}

function renderClothingPreviews() {
  if (state.clothingItems.length === 0) {
    clothingPreviewGrid.innerHTML = '';
    noClothingHint.style.display = 'block';
    return;
  }
  noClothingHint.style.display = 'none';

  function sel(id, field, options, current) {
    const html = `<select class="item-select ${field}" data-id="${id}">${options.map(o => `<option value="${o.value}"${o.value===current?' selected':''}>${o.label||o.value}</option>`).join('')}</select>`;
    const match = options.find(o => o.value === current);
    const lbl = match ? (match.label || match.value) : (options[0]?.label || '');
    const trigger = `<button class="mobile-select-trigger" data-id="${id}" data-field="${field}"><span class="trigger-label">${lbl}</span><span class="trigger-chevron">▼</span></button>`;
    return html + trigger;
  }

  const typeOpts = [{value:'',label:'Typ wählen'}].concat(Object.entries(TYPE_LABELS).map(([v,l])=>({value:v,label:l})));
  const sizeOpts = [{value:'',label:'Größe wählen'}].concat(SIZES.map(s=>({value:s,label:s})));

  clothingPreviewGrid.innerHTML = state.clothingItems.map(item => `
    <div class="preview-card" data-id="${item.id}">
      <img src="${base64ToDataUrl(item.base64, item.mimeType)}" alt="${item.name}">
      <div class="info">
        <div class="item-name">${escapeHtml(item.name)}</div>
        ${sel(item.id, 'type-select', typeOpts, item.type)}
        ${sel(item.id, 'size-select', sizeOpts, item.size)}
        <div class="color-section">
          <button class="mobile-select-trigger color-trigger" data-id="${item.id}" data-field="color">
            ${buildColorTrigger(item)}
          </button>
        </div>
      </div>
      <button class="remove" data-id="${item.id}">×</button>
    </div>
  `).join('');

  /* Native select change handlers */
  clothingPreviewGrid.querySelectorAll('.type-select').forEach(sel => {
    sel.addEventListener('change', e => {
      e.stopPropagation();
      const id = sel.dataset.id;
      const item = state.clothingItems.find(i => i.id === id);
      if (!item) return;
      item.type = sel.value;
      const trig = document.querySelector(`.mobile-select-trigger[data-id="${id}"][data-field="type-select"] .trigger-label`);
      if (trig) trig.textContent = sel.value ? TYPE_LABELS[sel.value] : 'Typ wählen';
    });
  });

  clothingPreviewGrid.querySelectorAll('.size-select').forEach(sel => {
    sel.addEventListener('change', e => {
      e.stopPropagation();
      const id = sel.dataset.id;
      const item = state.clothingItems.find(i => i.id === id);
      if (!item) return;
      item.size = sel.value;
      const trig = document.querySelector(`.mobile-select-trigger[data-id="${id}"][data-field="size-select"] .trigger-label`);
      if (trig) trig.textContent = sel.value || 'Größe wählen';
    });
  });

  /* Mobile trigger handlers */
  clothingPreviewGrid.querySelectorAll('.mobile-select-trigger').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const item = state.clothingItems.find(i => i.id === id);
      if (!item) return;
      const field = btn.dataset.field;
      let title, options, currentValue, currentValues, showDots, getDot, multi;

      if (field === 'type-select') {
        title = 'Kleidungstyp auswählen';
        options = typeOpts;
        currentValue = item.type;
        showDots = false;
        multi = false;
      } else if (field === 'size-select') {
        title = 'Größe wählen';
        options = sizeOpts;
        currentValue = item.size;
        showDots = false;
        multi = false;
      } else if (field === 'color') {
        title = 'Farbe auswählen (max. 2)';
        options = COLORS.filter(c => c.value).map(c => ({ value: c.value, label: c.label }));
        currentValues = [...(item.colors || [])];
        showDots = true;
        getDot = (v) => getColorHex(v);
        multi = true;
      }

      openSelectOverlay({
        title, options, currentValue, currentValues,
        showDots,
        getDotColor: getDot,
        multi,
        onChange: (val) => {
          if (field === 'type-select') {
            item.type = val;
            const ns = document.querySelector(`.type-select[data-id="${id}"]`);
            if (ns) ns.value = val;
            const tl = document.querySelector(`.mobile-select-trigger[data-id="${id}"][data-field="type-select"] .trigger-label`);
            if (tl) tl.textContent = val ? TYPE_LABELS[val] : 'Typ wählen';
          } else if (field === 'size-select') {
            item.size = val;
            const ns = document.querySelector(`.size-select[data-id="${id}"]`);
            if (ns) ns.value = val;
            const tl = document.querySelector(`.mobile-select-trigger[data-id="${id}"][data-field="size-select"] .trigger-label`);
            if (tl) tl.textContent = val || 'Größe wählen';
          } else if (field === 'color') {
            item.colors = val || [];
            renderClothingPreviews();
          }
        },
      });
    });
  });

  clothingPreviewGrid.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.clothingItems = state.clothingItems.filter(i => i.id !== btn.dataset.id);
      if (state.generationDone && state.currentStep === 4) {
        state.generationDone = false;
      }
      renderClothingPreviews();
    });
  });
}

clothingDropZone.addEventListener('dragover', e => { e.preventDefault(); clothingDropZone.classList.add('drag-over') });
clothingDropZone.addEventListener('dragleave', () => clothingDropZone.classList.remove('drag-over'));
clothingDropZone.addEventListener('drop', e => {
  e.preventDefault();
  clothingDropZone.classList.remove('drag-over');
  handleClothingFiles(e.dataTransfer.files);
});
clothingFileInput.addEventListener('change', () => {
  if (clothingFileInput.files.length) handleClothingFiles(clothingFileInput.files);
  clothingFileInput.value = '';
});

$('#step2Back').addEventListener('click', () => goToStep(1));
$('#step2Next').addEventListener('click', () => {
  if (state.clothingItems.length === 0) { showToast('Bitte mindestens ein Kleidungsstück hochladen.', 'warning'); return }
  goToStep(3);
});

// ============ STEP 3: MODE & GENERATE ============

$('#modeSingle').addEventListener('click', () => {
  state.generationMode = 'single';
  $('#modeSingle').classList.add('selected');
  $('#modeCombined').classList.remove('selected');
});
$('#modeCombined').addEventListener('click', () => {
  state.generationMode = 'combined';
  $('#modeCombined').classList.add('selected');
  $('#modeSingle').classList.remove('selected');
});

$('#step3Back').addEventListener('click', () => goToStep(2));

$('#qualitySelect').addEventListener('change', () => {
  state.selectedQuality = $('#qualitySelect').value;
  updateGenSummary();
});
$('#sizeSelect').addEventListener('change', () => {
  state.selectedSize = $('#sizeSelect').value;
  updateGenSummary();
});

function updateGenSummary() {
  const count = state.clothingItems.length;
  const mode = state.generationMode === 'single' ? 'Einzeln' : 'Alle zusammen';
  const est = estimateCost(count, state.generationMode, state.selectedQuality);
  const sizeLabel = IMAGE_SIZES[state.selectedSize] || state.selectedSize;
  const items = [
    { icon: '📸', label: 'Kleidungsstücke', val: count },
    { icon: '⚙️', label: 'Modus', val: mode },
    { icon: '🌐', label: 'API-Aufrufe', val: est.calls },
    { icon: '📐', label: 'Größe', val: sizeLabel },
  ];
  document.getElementById('genSummary').innerHTML =
    `<div class="gen-info-filled">${items.map(i => `<div class="gen-info-item"><span class="gen-info-icon">${i.icon}</span><span><strong>${i.val}</strong> <span class="gen-info-label">${i.label}</span></span></div>`).join('')}</div>`;

  const costEl = document.getElementById('costEstimate');
  costEl.style.display = 'block';
  costEl.innerHTML = `<strong>💰 Geschätzte Kosten:</strong> ${est.calls} × $${est.perImage} = <strong>~$${est.total.toFixed(3)}</strong> (Qualität: ${QUALITY_PRICES[state.selectedQuality]?.label || 'Mittel'})<br><span style="font-size:.75rem;color:var(--text-3)">OpenAI hat keinen Free Tier. Dir wird der Betrag von deinem Guthaben abgezogen.</span>`;
}

// ============ STEP 4: GENERATE ============

const generateBtn = $('#generateBtn');
const progressWrap = $('#progressWrap');

const logArea = $('#logArea');
const progressTimers = {};
let activeLottie = null;

function addLog(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logArea.appendChild(el);
  logArea.scrollTop = logArea.scrollHeight;
}

function statusIcon(type) {
  if (type === 'done') {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".2" stroke="#10b981"/><polyline points="8 12 11 15 16 9"/></svg>';
  }
  if (type === 'error') {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity=".2" stroke="#ef4444"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#71717a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
}

function showProgressItems(mode, items) {
  const container = document.getElementById('progressItems');
  if (mode === 'combined') {
    container.innerHTML = `
      <div class="progress-item" data-idx="0">
        <img class="progress-item-thumb" src="${base64ToDataUrl(items[0].base64, items[0].mimeType)}" alt="">
        <div class="progress-item-info">
          <div class="progress-item-name">Alle Kleidungsstücke (kombiniert)</div>
          <div class="progress-item-type">${items.length} Kleidungsstücke</div>
        </div>
        <div class="progress-item-bar-wrap">
          <div class="progress-item-bar"><div class="progress-item-fill"></div></div>
          <div class="progress-item-pct">0%</div>
        </div>
        <div class="progress-item-status" title="Wartet...">${statusIcon('')}</div>
      </div>`;
  } else {
    container.innerHTML = items.map((item, i) => `
      <div class="progress-item" data-idx="${i}">
        <img class="progress-item-thumb" src="${base64ToDataUrl(item.base64, item.mimeType)}" alt="">
        <div class="progress-item-info">
          <div class="progress-item-name">${escapeHtml(item.name)}</div>
          <div class="progress-item-type">${TYPE_LABELS[item.type] || item.type}</div>
        </div>
        <div class="progress-item-bar-wrap">
          <div class="progress-item-bar"><div class="progress-item-fill"></div></div>
          <div class="progress-item-pct">0%</div>
        </div>
        <div class="progress-item-status" title="Wartet...">${statusIcon('')}</div>
      </div>
    `).join('');
  }
}

function updateProgressItem(idx, pct, status) {
  const card = document.querySelector(`.progress-item[data-idx="${idx}"]`);
  if (!card) return;
  const fill = card.querySelector('.progress-item-fill');
  const pctEl = card.querySelector('.progress-item-pct');
  const statusEl = card.querySelector('.progress-item-status');
  if (fill) fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
  card.classList.remove('done', 'error');

  if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }

  if (status === 'done') {
    card.classList.add('done');
    statusEl.innerHTML = statusIcon('done');
    statusEl.title = 'Fertig';
  } else if (status === 'error') {
    card.classList.add('error');
    statusEl.innerHTML = statusIcon('error');
    statusEl.title = 'Fehlgeschlagen';
  } else if (status === 'generating') {
    statusEl.innerHTML = '<div class="status-lottie"></div>';
    statusEl.title = 'Wird erstellt...';
    if (typeof lottie !== 'undefined') {
      activeLottie = {
        idx,
        instance: lottie.loadAnimation({
          container: statusEl.querySelector('.status-lottie'),
          renderer: 'svg',
          loop: true,
          autoplay: true,
          path: 'js/loading.json',
        }),
      };
    }
  } else {
    statusEl.innerHTML = statusIcon('');
    statusEl.title = 'Wartet...';
  }
}

function setProgressOverall(current, total) {
  const el = document.getElementById('progressOverall');
  if (el) el.textContent = `Generiere Bild ${current} von ${total}...`;
}

function startItemProgress(idx) {
  stopItemProgress(idx);
  let pct = 5;
  const start = Date.now();
  progressTimers[idx] = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    if (elapsed < 3) {
      pct = 5 + (elapsed / 3) * 20;
    } else {
      pct = Math.min(85, 25 + (elapsed - 3) * 0.2);
    }
    const card = document.querySelector(`.progress-item[data-idx="${idx}"]`);
    if (card) {
      const fill = card.querySelector('.progress-item-fill');
      const pctEl = card.querySelector('.progress-item-pct');
      if (fill) fill.style.width = `${pct}%`;
      if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
    }
  }, 400);
}

function stopItemProgress(idx, success) {
  if (progressTimers[idx]) {
    clearInterval(progressTimers[idx]);
    delete progressTimers[idx];
  }
  if (success === true) {
    updateProgressItem(idx, 100, 'done');
  } else if (success === false) {
    const card = document.querySelector(`.progress-item[data-idx="${idx}"]`);
    const pctEl = card?.querySelector('.progress-item-pct');
    const currentPct = pctEl ? parseInt(pctEl.textContent) || 0 : 0;
    updateProgressItem(idx, currentPct, 'error');
  }
}

generateBtn.addEventListener('click', async () => {
  if (state.isGenerating) return;
  if (!state.apiKey || !validateApiKey(state.apiKey)) {
    showToast('Bitte gültigen OpenAI API-Key eingeben.', 'error'); return
  }
  if (!state.personPhoto) { showToast('Kein Personenfoto vorhanden.', 'error'); return }
  if (state.clothingItems.length === 0) { showToast('Keine Kleidungsstücke vorhanden.', 'error'); return }
  if (state.generationMode === 'combined' && state.clothingItems.length > 9) {
    showToast('Im kombinierten Modus werden max. 9 Kleidungsstücke unterstützt.', 'warning'); return;
  }
  const missing = state.clothingItems.filter(i => !i.type || !i.size);
  if (missing.length > 0) {
    showToast(`Bitte für ${missing.length} Kleidungsstück${missing.length>1?'e':''} Typ und Größe wählen.`, 'warning'); return;
  }

  state.generatedImages = [];
  state.isGenerating = true;
  generateBtn.disabled = true;
  progressWrap.style.display = 'flex';
  logArea.innerHTML = '';
  document.getElementById('resultsGrid').innerHTML = '';
  state.generationDone = false;

  const items = state.clothingItems;
  const mode = state.generationMode;
  const totalCalls = mode === 'single' ? items.length : 1;
  let successCount = 0;
  let failCount = 0;

  showProgressItems(mode, items);
  const progressOverallEl = document.getElementById('progressOverall');
  if (totalCalls > 1) progressOverallEl.textContent = `Generiere Bilder... (0/${totalCalls} fertig)`;

  try {
    if (mode === 'single') {
      let doneCount = 0;

      const promises = items.map(async (item, i) => {
        addLog(`Generiere Anprobebild für "${item.name}" (${TYPE_LABELS[item.type]})...`);
        updateProgressItem(i, 0, 'generating');
        startItemProgress(i);

        try {
          addLog(`Sende API-Request für "${item.name}"...`);
          const data = await callImageEdit({
            personPhoto: state.personPhoto,
            clothingItems: [item],
            prompt: buildTryOnPrompt(item.type, item.size),
            apiKey: state.apiKey,
            signal: AbortSignal.timeout(180000),
            size: state.selectedSize,
            quality: state.selectedQuality,
          });

          const imgData = data.data[0];
          if (!imgData || !imgData.b64_json) {
            throw new Error('Keine Bilddaten in der API-Antwort.');
          }

          state.generatedImages.push({
            base64: imgData.b64_json,
            mimeType: 'image/png',
            name: `${TYPE_LABELS[item.type]}_${item.name.replace(/\.[^.]+$/, '')}.png`,
            clothingType: item.type,
            clothingName: item.name,
            size: item.size,
            colors: [...(item.colors || [])],
            saleText: '',
          });
          successCount++;
          stopItemProgress(i, true);
          addLog(`✅ "${item.name}" erfolgreich generiert`, 'success');
        } catch (err) {
          if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
            addLog(`💰 Guthaben aufgebraucht. Bitte Guthaben aufladen.`, 'error');
            showToast('💰 OpenAI-Guthaben aufgebraucht.', 'error');
            stopItemProgress(i, false);
            failCount++;
          } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
            addLog(`🔑 API-Key ungültig oder keine Berechtigung.`, 'error');
            showToast('🔑 API-Key ungültig. Prüfe den Key.', 'error');
            stopItemProgress(i, false);
            failCount++;
          } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            addLog(`⏱ Zeitüberschreitung bei "${item.name}" (180s).`, 'warn');
            showToast(`⏱ "${item.name}" Zeitüberschreitung, übersprungen.`, 'warning');
            stopItemProgress(i, false);
            failCount++;
          } else {
            console.error(`Fehler "${item.name}":`, err);
            addLog(`❌ ${err.message}`, 'error');
            showToast(`❌ "${item.name}" fehlgeschlagen: ${err.message.slice(0, 80)}`, 'error');
            stopItemProgress(i, false);
            failCount++;
          }
        }

        doneCount++;
        progressOverallEl.textContent = `Generiere Bilder... (${doneCount}/${totalCalls} fertig)`;
      });

      await Promise.allSettled(promises);
    } else {
      addLog(`Generiere kombiniertes Anprobebild (${items.length} Kleidungsstücke)...`);
      updateProgressItem(0, 0, 'generating');
      startItemProgress(0);

      try {
        const data = await callImageEdit({
          personPhoto: state.personPhoto,
          clothingItems: items,
          prompt: COMBINED_PROMPT,
          apiKey: state.apiKey,
          signal: AbortSignal.timeout(300000),
          size: state.selectedSize,
          quality: state.selectedQuality,
        });

        const imgData = data.data[0];
        if (!imgData || !imgData.b64_json) {
          throw new Error('Keine Bilddaten in der API-Antwort.');
        }

        state.generatedImages.push({
          base64: imgData.b64_json,
          mimeType: 'image/png',
          name: `Kombiniert_${formatDate()}.png`,
          clothingType: 'combined',
          clothingName: 'Alle Kleidungsstücke',
          saleText: '',
        });
        successCount++;
        stopItemProgress(0, true);
        addLog(`✅ Kombiniertes Bild erfolgreich generiert`, 'success');
      } catch (err) {
        if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
          addLog(`💰 Guthaben aufgebraucht.`, 'error');
          showToast('💰 OpenAI-Guthaben aufgebraucht.', 'error');
          failCount++;
        } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
          addLog(`🔑 API-Key ungültig.`, 'error');
          showToast('🔑 API-Key ungültig.', 'error');
          failCount++;
        } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          addLog(`⏱ Zeitüberschreitung (300s).`, 'error');
          showToast(`⏱ Zeitüberschreitung. Internet prüfen.`, 'error');
          failCount++;
        } else {
          console.error('Fehler:', err);
          addLog(`❌ ${err.message}`, 'error');
          showToast(`❌ ${err.message}`, 'error');
          failCount++;
        }
        stopItemProgress(0, false);
      }
    }

    const resultMsg = successCount > 0
      ? `✅ ${successCount}/${totalCalls} Bilder erfolgreich`
      : '❌ Alle Generierungen fehlgeschlagen.';
    document.getElementById('progressOverall').textContent = resultMsg;
    addLog(resultMsg, successCount > 0 ? 'success' : 'error');

    if (successCount > 0) {
      state.generationDone = true;
      renderResults();
      goToStep(4);
      renderZipPreview();
      generateAllSaleTexts();
      showToast(`${successCount} von ${totalCalls} Bild${totalCalls > 1 ? 'ern' : ''} erfolgreich`, successCount === totalCalls ? 'success' : 'warning');
    }
    if (failCount > 0) {
      showToast(`${failCount} ${failCount === 1 ? 'Bild' : 'Bilder'} fehlgeschlagen. Details im Log.`, 'error');
    }
  } catch (err) {
    addLog(`❌ Unerwarteter Fehler: ${err.message}`, 'error');
    showToast('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  } finally {
    Object.keys(progressTimers).forEach(k => stopItemProgress(k));
    if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }
    state.isGenerating = false;
    generateBtn.disabled = false;
  }
});

$('#step4Back').addEventListener('click', () => goToStep(3));

// ============ STEP 4: RESULTS + SALE TEXT ============

const resultsGrid = $('#resultsGrid');

function renderResults() {
  if (state.generatedImages.length === 0) return;
  resultsGrid.innerHTML = state.generatedImages.map((img, idx) => `
    <div class="result-card" data-idx="${idx}">
      <div class="result-card-header">
        <img class="result-card-thumb" src="${base64ToDataUrl(img.base64, img.mimeType)}" alt="">
        <div class="result-card-info">
          <strong>${escapeHtml(img.clothingName)}</strong>
          <span>${img.clothingType === 'combined' ? 'Kombiniert' : TYPE_LABELS[img.clothingType]} · ${getImageSize(img.base64)} MB</span>
        </div>
        <button class="collapse-toggle" aria-label="Ein-/ausklappen">▼</button>
      </div>
      <div class="result-card-body">
        <img src="${base64ToDataUrl(img.base64, img.mimeType)}" alt="${escapeHtml(img.name)}">
        <div class="result-card-actions">
          <button class="btn btn-sm btn-primary download-btn">⬇ Herunterladen</button>
        </div>
        <div class="result-sale-text${img.saleText ? '' : ' generating'}">
          <div class="sale-text-content"></div>
        </div>
      </div>
    </div>
  `).join('');

  resultsGrid.querySelectorAll('.result-card').forEach((card, idx) => {
    const img = state.generatedImages[idx];
    const bodyImg = card.querySelector('.result-card-body > img');
    bodyImg.addEventListener('click', () => openLightbox(img, idx));
    card.querySelector('.download-btn').addEventListener('click', () => downloadSingleImage(idx));
    card.querySelector('.result-card-header').addEventListener('click', (e) => {
      if (e.target.closest('.download-btn') || e.target.closest('.copy-text-btn')) return;
      card.classList.toggle('collapsed');
    });
    if (img.saleText) {
      const contentDiv = card.querySelector('.sale-text-content');
      if (contentDiv) contentDiv.textContent = img.saleText;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-sm btn-secondary copy-text-btn';
      copyBtn.textContent = '📋 Kopieren';
      copyBtn.addEventListener('click', () => copySaleText(idx));
      card.querySelector('.result-sale-text').appendChild(copyBtn);
    }
  });
}

async function generateAllSaleTexts() {
  for (let i = 0; i < state.generatedImages.length; i++) {
    const img = state.generatedImages[i];
    if (img.saleText) continue;

    const card = document.querySelector(`.result-card[data-idx="${i}"]`);
    const textArea = card?.querySelector('.result-sale-text');
    if (!textArea) continue;

    textArea.classList.add('generating');
    textArea.innerHTML = '<span class="spinner"></span> Generiere Verkaufstext...';

    try {
      addLog(`Generiere Vinted-Verkaufstext für "${img.clothingName}"...`);
      const text = await generateSaleTextForImage(img);
      if (text) {
        img.saleText = text;
        textArea.classList.remove('generating');
        textArea.innerHTML = '';
        const pre = document.createElement('div');
        pre.className = 'sale-text-content';
        pre.textContent = text;
        textArea.appendChild(pre);
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-sm btn-secondary copy-text-btn';
        copyBtn.textContent = '📋 Kopieren';
        copyBtn.addEventListener('click', () => copySaleText(i));
        textArea.appendChild(copyBtn);
        addLog(`✅ Verkaufstext für "${img.clothingName}" generiert`, 'success');
      }
    } catch (err) {
      if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
        addLog('🔑 API-Key ungültig.', 'error');
      } else {
        addLog(`❌ Fehler bei "${img.clothingName}": ${err.message}`, 'error');
      }
      textArea.classList.remove('generating');
      textArea.innerHTML = '<span style="color:var(--error);font-size:.8rem">❌ Textgenerierung fehlgeschlagen</span>';
    }
  }
}

async function generateSaleTextForImage(img) {
  const data = await callChatCompletion({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: base64ToDataUrl(img.base64, img.mimeType) } },
          { type: 'text', text: buildSalePrompt(TYPE_LABELS[img.clothingType] || img.clothingType, img.size, img.colors || []) },
        ],
      },
    ],
    apiKey: state.apiKey,
    signal: AbortSignal.timeout(30000),
  });
  return data.choices?.[0]?.message?.content || '';
}

function downloadSingleImage(idx) {
  const img = state.generatedImages[idx];
  if (!img) return;
  const a = document.createElement('a');
  a.href = base64ToDataUrl(img.base64, img.mimeType);
  a.download = img.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`⬇ ${img.clothingName} wird heruntergeladen`, 'success');
}

function copySaleText(idx) {
  const text = state.generatedImages[idx]?.saleText;
  if (!text) { showToast('Kein Verkaufstext vorhanden.', 'warning'); return }
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(`.result-card[data-idx="${idx}"] .copy-text-btn`);
    if (btn) { btn.classList.add('copied'); btn.textContent = '✓ Kopiert'; setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '📋 Kopieren'; }, 2000); }
    showToast('📋 Verkaufstext kopiert!', 'success');
  }).catch(() => {
    showToast('❌ Kopieren fehlgeschlagen.', 'error');
  });
}

async function downloadAllAsZip(title) {
  title = title || 'VirtualTryOn';
  const dateStr = formatDate();
  const folder = `${title}_${dateStr}`;

  if (state.generatedImages.length === 0) {
    showToast('Keine Daten zum Herunterladen.', 'warning');
    return;
  }

  try {
    const zip = new JSZip();

    if (state.generatedImages.length > 0) {
      const imgFolder = zip.folder(`${folder}/Bilder`);
      for (const img of state.generatedImages) {
        const safeName = img.name.replace(/[<>:"/\\|?*]/g, '_');
        imgFolder.file(safeName, img.base64, { base64: true });
      }
    }

    const textCount = state.generatedImages.filter(i => i.saleText).length;
    if (textCount > 0) {
      const textFolder = zip.folder(`${folder}/Verkaufsanzeige Texte`);
      state.generatedImages.forEach((img) => {
        if (img.saleText) {
          const safeName = img.clothingName.replace(/[<>:"/\\|?*]/g, '_');
          textFolder.file(`anzeige_${safeName}.txt`, img.saleText);
        }
      });
    }

    const summary = [
      `Session: ${title}`,
      `Datum: ${dateStr}`,
      `Generierte Bilder: ${state.generatedImages.length}`,
      `Kleidungsstücke: ${state.clothingItems.map(i => `${i.name} (${TYPE_LABELS[i.type]})`).join(', ')}`,
      `Modus: ${state.generationMode === 'single' ? 'Einzeln' : 'Alle zusammen'}`,
      textCount > 0 ? `\n--- Verkaufstexte ---\n${state.generatedImages.filter(i => i.saleText).map(i => `${i.clothingName}:\n${i.saleText}`).join('\n---\n')}` : '',
    ].join('\n');
    zip.file(`${folder}/zusammenfassung.txt`, summary);

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    const size = (blob.size / 1024 / 1024).toFixed(2);
    showToast(`📦 ${folder}.zip erfolgreich heruntergeladen (${size} MB)`, 'success');
    return true;
  } catch (err) {
    showToast(`Fehler beim ZIP-Erstellen: ${err.message}`, 'error');
    return false;
  }
}

window.toggleLog = function () {
  const area = document.getElementById('logArea');
  area.classList.toggle('visible');
  const btn = document.querySelector('.log-toggle');
  if (btn) btn.textContent = area.classList.contains('visible') ? '📂 Ausblenden' : '📂 Details';
};

window.openSelectOverlay = function ({ title, options, currentValue, currentValues, onChange, showDots, getDotColor, multi }) {
  const overlay = document.getElementById('selectOverlay');
  document.getElementById('selectOverlayTitle').textContent = title;
  const list = document.getElementById('selectOverlayList');

  if (multi) {
    const selected = [...(currentValues || [])];
    list.innerHTML = options.map(opt => {
      const isSelected = selected.includes(opt.value);
      const dot = showDots && getDotColor ? `<span class="select-overlay-dot" style="background:${getDotColor(opt.value)||'transparent'}"></span>` : '';
      return `<button class="select-overlay-option${isSelected?' multi-selected':''}" data-value="${opt.value}">${dot}<span class="multi-indicator"></span><span>${opt.label}</span></button>`;
    }).join('') + '<button class="select-overlay-confirm">✓ Bestätigen</button>';

    list.querySelectorAll('.select-overlay-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        if (!val) return;
        const idx = selected.indexOf(val);
        if (idx >= 0) {
          selected.splice(idx, 1);
          btn.classList.remove('multi-selected');
        } else {
          if (selected.length >= 2) {
            showToast('Maximal 2 Farben auswählbar.', 'warning');
            return;
          }
          selected.push(val);
          btn.classList.add('multi-selected');
        }
      });
    });

    list.querySelector('.select-overlay-confirm').addEventListener('click', () => {
      onChange(selected);
      closeSelectOverlay();
    });
  } else {
    list.innerHTML = options.map(opt => {
      const sel = opt.value === currentValue;
      const dot = showDots && getDotColor ? `<span class="select-overlay-dot" style="background:${getDotColor(opt.value)||'transparent'}"></span>` : '';
      return `<button class="select-overlay-option${sel?' selected':''}" data-value="${opt.value}">${dot}<span>${opt.label}</span>${sel?'<span class=\"select-overlay-check\">✓</span>':''}</button>`;
    }).join('');
    list.querySelectorAll('.select-overlay-option').forEach(btn => {
      btn.addEventListener('click', () => { onChange(btn.dataset.value); closeSelectOverlay(); });
    });
  }

  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
};

window.closeSelectOverlay = function () {
  document.getElementById('selectOverlay').classList.remove('visible');
  document.body.style.overflow = '';
};

window.toggleSettings = function () {
  const m = document.getElementById('settingsModal');
  m.classList.toggle('visible');
  document.body.style.overflow = m.classList.contains('visible') ? 'hidden' : '';
};

window.closeSettings = function () {
  document.getElementById('settingsModal').classList.remove('visible');
  document.body.style.overflow = '';
};

window.toggleUserModal = function () {
  const m = document.getElementById('userModal');
  m.classList.toggle('visible');
  document.body.style.overflow = m.classList.contains('visible') ? 'hidden' : '';
};

window.closeUserModal = function () {
  document.getElementById('userModal').classList.remove('visible');
  document.body.style.overflow = '';
};

window.openPhotoGuide = function () {
  document.getElementById('photoGuide').classList.add('visible');
  document.body.style.overflow = 'hidden';
};

window.closePhotoGuide = function (e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('photoGuide').classList.remove('visible');
  document.body.style.overflow = '';
};

let lightboxIdx = 0;

window.openLightbox = function (img, idx) {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const lbInfo = document.getElementById('lightboxInfo');
  lightboxIdx = idx !== undefined ? idx : state.generatedImages.findIndex(i => i === img);
  if (lightboxIdx < 0) lightboxIdx = 0;
  updateLightboxContent();
  lb.classList.add('visible');
  document.body.style.overflow = 'hidden';
};

function updateLightboxContent() {
  const img = state.generatedImages[lightboxIdx];
  if (!img) return;
  const lbImg = document.getElementById('lightboxImg');
  const lbInfo = document.getElementById('lightboxInfo');
  lbImg.src = base64ToDataUrl(img.base64, img.mimeType);
  lbInfo.textContent = `${img.clothingName} · ${img.clothingType === 'combined' ? 'Kombiniert' : TYPE_LABELS[img.clothingType]} (${lightboxIdx + 1}/${state.generatedImages.length})`;
  document.getElementById('lightboxPrev').style.display = lightboxIdx > 0 ? 'flex' : 'none';
  document.getElementById('lightboxNext').style.display = lightboxIdx < state.generatedImages.length - 1 ? 'flex' : 'none';
}

window.navigateLightbox = function (dir) {
  const newIdx = lightboxIdx + dir;
  if (newIdx < 0 || newIdx >= state.generatedImages.length) return;
  lightboxIdx = newIdx;
  updateLightboxContent();
};

window.closeLightbox = function (e) {
  if (e && e.target !== e.currentTarget) return;
  const lb = document.getElementById('lightbox');
  lb.classList.remove('visible');
  document.body.style.overflow = '';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('lightbox');
    if (lb.classList.contains('visible')) closeLightbox();
    const pg = document.getElementById('photoGuide');
    if (pg.classList.contains('visible')) closePhotoGuide();
    const sm = document.getElementById('settingsModal');
    if (sm.classList.contains('visible')) closeSettings();
    const um = document.getElementById('userModal');
    if (um.classList.contains('visible')) closeUserModal();
    const so = document.getElementById('selectOverlay');
    if (so.classList.contains('visible')) closeSelectOverlay();
  }
  if (e.key === 'ArrowLeft') {
    const lb = document.getElementById('lightbox');
    if (lb.classList.contains('visible')) { e.preventDefault(); navigateLightbox(-1); }
  }
  if (e.key === 'ArrowRight') {
    const lb = document.getElementById('lightbox');
    if (lb.classList.contains('visible')) { e.preventDefault(); navigateLightbox(1); }
  }
});

$('#downloadAllBtn').addEventListener('click', () => downloadAllAsZip(sessionTitle.value.trim() || 'VirtualTryOn'));
const resetBtn = $('#resetBtn');
const zipPreview = $('#zipPreview');

function renderZipPreview() {
  const title = sessionTitle.value.trim() || 'VirtualTryOn';
  const imgCount = state.generatedImages.length;
  const textCount = state.generatedImages.filter(i => i.saleText).length;
  zipPreview.textContent = `📦 ${imgCount} Bild${imgCount > 1 ? 'er' : ''}${textCount > 0 ? ` + ${textCount} Verkaufstext${textCount > 1 ? 'e' : ''}` : ''} · Bereit zum Download als "${title}_${formatDate()}.zip"`;
}

resetBtn.addEventListener('click', () => {
  if (state.generatedImages.length > 0 && !confirm('Wirklich zurücksetzen? Alle generierten Bilder gehen verloren.')) return;
  state.personPhoto = null;
  state.clothingItems = [];
  state.generatedImages = [];
  state.generationDone = false;
  state.currentStep = 1;
  state.isGenerating = false;
  state.generationMode = 'single';

  const pv = document.getElementById('personPreview');
  if (pv) pv.style.display = 'none';
  const dropZone = document.getElementById('personDropZone');
  if (dropZone) { dropZone.classList.remove('has-file'); dropZone.classList.add('hidden-zone'); }
  const initView = document.getElementById('step1InitialView');
  if (initView) initView.style.display = '';
  const tipRow = document.getElementById('photoTipRow');
  if (tipRow) tipRow.style.display = 'none';
  const hero = document.getElementById('heroSection');
  if (hero) hero.classList.remove('hero-hidden');
  const startBtn = document.getElementById('step1StartBtn');
  if (startBtn) startBtn.disabled = false;
  clothingPreviewGrid.innerHTML = '';
  noClothingHint.style.display = 'block';
  resultsGrid.innerHTML = '';
  logArea.classList.remove('visible');
  logArea.innerHTML = '';
  Object.keys(progressTimers).forEach(k => stopItemProgress(k));
  if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }
  progressWrap.style.display = 'none';
  document.getElementById('progressItems').innerHTML = '';
  document.getElementById('progressOverall').textContent = '';
  zipPreview.textContent = '';
  document.getElementById('costEstimate').style.display = 'none';
  $('#modeSingle').classList.add('selected');
  $('#modeCombined').classList.remove('selected');

  personFileInput.value = '';
  clothingFileInput.value = '';
  goToStep(1);
  showToast('Session zurückgesetzt', 'info');
});

window.toggleKeyVisibility = function () {
  const input = document.getElementById('apiKeyInput');
  const btn = document.getElementById('keyToggleBtn');
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    btn.title = 'Key verstecken';
  } else {
    input.type = 'password';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.title = 'Key anzeigen';
  }
};

// Settings tabs
document.querySelectorAll('.settings-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('visible'));
    tab.classList.add('active');
    const panel = document.querySelector(`.settings-panel[data-panel="${tab.dataset.panel}"]`);
    if (panel) panel.classList.add('visible');
  });
});

// Header shrink on scroll (RAF-throttled)
let headerRafPending = false;
window.addEventListener('scroll', () => {
  if (headerRafPending) return;
  headerRafPending = true;
  requestAnimationFrame(() => {
    const header = document.querySelector('header');
    if (header) {
      header.classList.toggle('header-compact', window.scrollY > 50);
    }
    headerRafPending = false;
  });
}, { passive: true });

// Reveal animation on scroll (Intersection Observer)
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .1, rootMargin: '0px 0px -50px 0px' });

function observeReveal() {
  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
}

// Update lightbox click handler in renderResults
const origOpenLightbox = window.openLightbox;
window.openLightbox = function (img, idx) {
  origOpenLightbox(img, idx);
};

// beforeunload warning on unsaved state
window.addEventListener('beforeunload', (e) => {
  if (state.generatedImages.length > 0 && !state.generationDone) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ============ INIT ============

loadApiKey();
observeReveal();

// Word rotation
const heroWords = ['Anprobieren', 'Fotografieren', 'Verkaufen'];
let wordIdx = 0;
const heroWordEl = document.getElementById('heroRotatingWord');
if (heroWordEl) {
  setInterval(() => {
    heroWordEl.classList.add('fade-out');
    setTimeout(() => {
      wordIdx = (wordIdx + 1) % heroWords.length;
      heroWordEl.textContent = heroWords[wordIdx];
      heroWordEl.classList.remove('fade-out');
    }, 300);
  }, 3000);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active?.type === 'file') active.click();
  }
});

console.log('✦ Virtual Try-On App (OpenAI) geladen');
console.log(`API-Key ${state.apiKey ? '✓ vorhanden' : '✗ fehlt'}`);
