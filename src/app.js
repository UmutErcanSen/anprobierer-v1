import { icon } from './icons.js';
import {
  TYPE_LABELS, TYPE_EN, COLORS, SIZES,
  $, $$, sleep, formatDate, generateId,
  fileToBase64, dataUrlToBase64, base64ToDataUrl,
  getImageSize, base64ToBlob, showToast,
  convertImageToStandard, escapeHtml,
} from './utils.js';

import {
  OPENAI_API, IMAGE_MODEL, TEXT_MODEL, OpenAIError,
  IMAGE_SIZES, COMBINED_PROMPT,
  buildTryOnPrompt, buildSalePrompt, callImageEdit,
  callChatCompletion, testApiKey,
} from './api.js';

import { currentUser, userProfile, onAuthChange, requireAuth, setPendingRedirect, isEmailVerified, refreshUserProfile, logout } from './auth.js';
import { checkGenerationAllowed, incrementGenerationsUsed, saveGeneration } from './firestore.js';
import { PLANS, renderPlanComparison } from './plans.js';
import { onRouteChange, getCurrentPath, navigateTo, ROUTES } from './router.js';
import { getMaxItemsForPlan, getQualityForPlan, checkAndResetMonthly } from './subscription.js';
import { showUpgradeModal } from './checkout.js';

const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true';

const state = {
  apiKey: '',
  personPhoto: null,
  clothingItems: [],
  generationMode: 'single',
  generatedImages: [],
  generationDone: false,
  isGenerating: false,
  selectedQuality: 'medium',
  selectedSize: '1024x1536',
  extraNotes: '',
};

const SESSION_KEY = 'vto_session';

function saveSession() {
  try {
    const data = {
      personPhoto: state.personPhoto,
      clothingItems: state.clothingItems.map(i => ({ ...i })),
      generationMode: state.generationMode,
      generatedImages: state.generatedImages.map(i => ({ ...i })),
      generationDone: state.generationDone,
      selectedSize: state.selectedSize,
      extraNotes: state.extraNotes,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      showToast(`Session konnte nicht gespeichert werden (Speicher voll).`, 'warning');
    }
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);

    // restore person photo
    if (data.personPhoto) {
      state.personPhoto = data.personPhoto;
      renderPersonPreview();
      ['step2','step3'].forEach(id => document.getElementById(id)?.classList.remove('hidden-zone'));
      updateStepStepper();
    }

    // restore clothing items
    if (data.clothingItems && data.clothingItems.length > 0) {
      state.clothingItems = data.clothingItems;
      renderClothingPreviews();
      updateClothingBadge();
    }

    // restore mode, quality, size
    if (data.generationMode) {
      state.generationMode = data.generationMode;
      const single = document.getElementById('modeSingle');
      const combined = document.getElementById('modeCombined');
      if (data.generationMode === 'combined') {
        single?.classList.remove('selected');
        combined?.classList.add('selected');
      } else {
        single?.classList.add('selected');
        combined?.classList.remove('selected');
      }
    }
    if (data.selectedSize) state.selectedSize = data.selectedSize;
    if (data.extraNotes !== undefined) state.extraNotes = data.extraNotes;
    const ss = document.getElementById('sizeSelect');
    if (ss) ss.value = state.selectedSize;
    const en = document.getElementById('extraNotes');
    if (en) en.value = state.extraNotes || '';

    // restore generated images
    if (data.generatedImages && data.generatedImages.length > 0) {
      state.generatedImages = data.generatedImages;
    }
    if (data.generationDone !== undefined) state.generationDone = data.generationDone;
    if (data.generatedImages && data.generatedImages.length > 0 && state.generationDone) {
      renderResults();
      renderZipPreview();
      document.getElementById('step4')?.classList.remove('hidden-zone');
      updateStepStepper();
    }

    // update gen summary if clothing exists
    if (state.clothingItems.length > 0) {
      updateGenSummary();
    }

    showToast('Session wiederhergestellt', 'info');
    updateGenerateBtnState();
  } catch (_) {}
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function updateClothingBadge() {
  let badge = clothingDropZone.parentElement.querySelector('.upload-count');
  if (state.clothingItems.length === 0) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'upload-count';
    clothingDropZone.after(badge);
  }
  const count = state.clothingItems.length;
  badge.textContent = `${count} Kleidungsstück${count > 1 ? 'e' : ''} hochgeladen`;
}

// ============ API KEY ============

const apiKeyInput = $('#apiKeyInput');
const apiStatusDot = $('#apiStatusDot');

function loadApiKey() {
  const devKey = import.meta.env.VITE_DEV_API_KEY;
  if (DEV_MODE && devKey) {
    apiKeyInput.value = devKey;
    state.apiKey = devKey;
    updateApiStatus(true);
    updateGenerateBtnState();
    return;
  }
  const saved = localStorage.getItem('openai_api_key');
  if (saved) {
    apiKeyInput.value = saved;
    state.apiKey = saved;
    updateApiStatus(true);
  }
  updateGenerateBtnState();
}

function validateApiKey(key) {
  return key.startsWith('sk-') && key.length >= 20;
}

function updateApiStatus(valid, isTesting) {
  apiStatusDot.className = 'status-dot' + (valid ? ' ready' : '') + (isTesting ? '' : '');
  if (valid) apiKeyInput.classList.add('valid');
  else apiKeyInput.classList.remove('valid');
}

function updateGenerateBtnState() {
  if (state.isGenerating) { generateBtn.disabled = true; return }
  const apiOk = state.apiKey && validateApiKey(state.apiKey);
  const photoOk = state.personPhoto !== null;
  const hasItems = state.clothingItems.length > 0;
  const itemsComplete = state.clothingItems.every(i => i.type && i.size);
  generateBtn.disabled = !(apiOk && photoOk && hasItems && itemsComplete);
}

function highlightField(el, msg) {
  if (!el) return;
  el.classList.add('field-error');
  let errEl = el.parentElement?.querySelector('.field-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error-msg';
    el.insertAdjacentElement('afterend', errEl);
  }
  errEl.innerHTML = `${icon('alert-circle', 12)} ${msg}`;
  el.addEventListener('input', () => clearFieldHighlight(el), { once: true });
  el.addEventListener('change', () => clearFieldHighlight(el), { once: true });
}

function clearFieldHighlight(el) {
  if (!el) return;
  el.classList.remove('field-error');
  const errEl = el.parentElement?.querySelector('.field-error-msg');
  if (errEl) errEl.remove();
}

function highlightUploadZone(el, msg) {
  if (!el) return;
  el.classList.add('field-error');
  let errEl = el.nextElementSibling;
  if (!errEl || !errEl.classList.contains('field-error-msg')) {
    errEl = document.createElement('div');
    errEl.className = 'field-error-msg';
    el.insertAdjacentElement('afterend', errEl);
  }
  errEl.innerHTML = `${icon('alert-circle', 12)} ${msg}`;
  el.addEventListener('click', () => {
    el.classList.remove('field-error');
    if (errEl && errEl.classList.contains('field-error-msg')) errEl.remove();
  }, { once: true });
  el.addEventListener('dragover', () => {
    el.classList.remove('field-error');
    if (errEl && errEl.classList.contains('field-error-msg')) errEl.remove();
  }, { once: true });
}

function highlightClothingItem(index, msg) {
  const card = document.querySelectorAll('#clothingPreviewGrid .preview-card')[index];
  if (!card) return;
  card.classList.add('clothing-card-invalid');
  const selects = card.querySelectorAll('select');
  selects.forEach(s => {
    if (!s.value) s.classList.add('clothing-select-invalid');
  });
  let errEl = card.querySelector('.field-error-msg');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'field-error-msg';
    card.appendChild(errEl);
  }
  errEl.innerHTML = `${icon('alert-circle', 12)} ${msg}`;
  const clearHandler = () => {
    card.classList.remove('clothing-card-invalid');
    selects.forEach(s => s.classList.remove('clothing-select-invalid'));
    if (errEl && errEl.classList.contains('field-error-msg')) errEl.remove();
  };
  selects.forEach(s => s.addEventListener('change', clearHandler, { once: true }));
}

function clearAllFieldHighlights() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
  document.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  document.querySelectorAll('.clothing-card-invalid').forEach(el => el.classList.remove('clothing-card-invalid'));
  document.querySelectorAll('.clothing-select-invalid').forEach(el => el.classList.remove('clothing-select-invalid'));
}

function updateStepStepper() {
  const stepper = document.getElementById('stepStepper');
  if (!stepper) return;
  const items = stepper.querySelectorAll('.step-stepper-item');
  const lines = stepper.querySelectorAll('.step-stepper-line');
  let activeStep = 1;
  if (state.personPhoto) activeStep = 2;
  if (state.clothingItems.length > 0 && state.clothingItems.every(i => i.type && i.size)) activeStep = 3;
  if (state.generationDone) activeStep = 4;
  items.forEach((item, idx) => {
    const step = idx + 1;
    item.classList.toggle('active', step === activeStep);
    item.classList.toggle('done', step < activeStep);
  });
  lines.forEach((line, idx) => {
    line.classList.toggle('done', idx + 1 < activeStep);
  });
}

function updateGenRemaining() {
  const el = document.getElementById('genRemaining');
  if (!el) return;
  if (!currentUser || !userProfile) { el.classList.add('hidden'); return; }
  const subKey = userProfile.subscription || 'free';
  const sub = PLANS[subKey] || PLANS.free;
  const used = userProfile.generationsUsed || 0;
  const limit = sub.limit;
  if (limit === -1) { el.classList.add('hidden'); return; }
  el.innerHTML = `${icon('clock', 14)} ${used} von ${limit} ${subKey === 'free' ? 'Gratis-' : ''}Generierungen diesen Monat`;
  el.classList.remove('hidden');
}

function updateGenLimitWarning() {
  const el = document.getElementById('genLimitWarning');
  const cta = document.getElementById('genUpgradeCta');
  if (!el) return;
  if (!currentUser || !userProfile) { el.classList.add('hidden'); if (cta) cta.classList.add('hidden'); return; }
  const subKey = userProfile.subscription || 'free';
  const used = userProfile.generationsUsed || 0;
  const limit = PLANS[subKey]?.limit || 3;
  if (subKey !== 'free' || limit === -1) { el.classList.add('hidden'); if (cta) cta.classList.add('hidden'); return; }
  const remaining = limit - used;
  if (remaining > 2) { el.classList.add('hidden'); if (cta) cta.classList.add('hidden'); return; }
  el.innerHTML = `${icon('triangle-alert', 14)} Nur noch ${remaining} von ${limit} Gratis-Generierungen übrig – nach Limit keine Generierungen mehr möglich`;
  el.classList.remove('hidden');
  if (cta) {
    if (remaining <= 0) { cta.classList.remove('hidden'); } else { cta.classList.add('hidden'); }
  }
}

function applyFeatureGating() {
  const subKey = userProfile?.subscription || 'free';
  state.selectedQuality = getQualityForPlan(subKey);
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
  updateGenerateBtnState();
});

window.testApiKey = async function () {
  const key = state.apiKey;
  if (!validateApiKey(key)) { showToast('Bitte gültigen OpenAI API-Key eingeben (beginnt mit sk-).', 'warning'); return }
  const btn = document.getElementById('testKeyBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = `${icon('hourglass', 14)} Teste...`;
  apiStatusDot.className = 'status-dot';

  try {
    await testApiKey(key);
    updateApiStatus(true);
    showToast('API-Key ist gültig!', 'success');
  } catch (err) {
    if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
      apiStatusDot.className = 'status-dot error';
      showToast('Ungültiger API-Key. Prüfe den Key auf platform.openai.com/api-keys', 'error');
    } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      showToast('Verbindung zu OpenAI dauert zu lange. Internet prüfen?', 'error');
    } else {
      apiStatusDot.className = 'status-dot error';
      showToast(`${err.message}`, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${icon('search', 14)} Testen` }
  }
};

// ============ PERSON PHOTO ============

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
    updateGenerateBtnState();
    saveSession();
    showToast('Personenfoto erfolgreich geladen', 'success');
    updateStepStepper();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderPersonPreview() {
  if (!state.personPhoto) {
    personPreview.classList.add('hidden');
    personDropZone.classList.remove('has-file');
    return;
  }
  personDropZone.classList.add('has-file');
  personPreview.classList.remove('hidden');
  personPreview.innerHTML = `<div class="person-preview-inner">
    <img src="${base64ToDataUrl(state.personPhoto.base64, state.personPhoto.mimeType)}" alt="Person">
    <button class="remove-person-btn" id="removePersonBtn">×</button>
  </div>`;
  document.getElementById('removePersonBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.personPhoto = null;
    personPreview.classList.add('hidden');
    personDropZone.classList.remove('has-file');
    personFileInput.value = '';
    updateGenerateBtnState();
    saveSession();
    updateStepStepper();
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

// ============ CLOTHING ITEMS ============

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
    updateGenSummary();
    updateClothingBadge();
    updateGenerateBtnState();
    saveSession();
    showToast(`${promises.length} Kleidungsstück${promises.length > 1 ? 'e' : ''} hinzugefügt`, 'success');
    updateStepStepper();
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
    noClothingHint.classList.remove('hidden');
    return;
  }
  noClothingHint.classList.add('hidden');

  function sel(id, field, options, current) {
    const html = `<select class="item-select ${field}" data-id="${id}">${options.map(o => `<option value="${o.value}"${o.value===current?' selected':''}>${o.label||o.value}</option>`).join('')}</select>`;
    const match = options.find(o => o.value === current);
    const lbl = match ? (match.label || match.value) : (options[0]?.label || '');
    const trigger = `<button class="mobile-select-trigger" data-id="${id}" data-field="${field}"><span class="trigger-label">${lbl}</span><span class="trigger-chevron">${icon('chevron-down', 10)}</span></button>`;
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
      saveSession();
      updateGenerateBtnState();
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
      saveSession();
      updateGenerateBtnState();
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
          saveSession();
          updateGenerateBtnState();
        },
      });
    });
  });

  clothingPreviewGrid.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.clothingItems = state.clothingItems.filter(i => i.id !== btn.dataset.id);
      if (state.generationDone) {
        state.generationDone = false;
      }
      renderClothingPreviews();
      updateGenSummary();
      updateClothingBadge();
      updateGenerateBtnState();
      saveSession();
      updateStepStepper();
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

// ============ MODE & GENERATE ============

$('#modeSingle').addEventListener('click', () => {
  state.generationMode = 'single';
  $('#modeSingle').classList.add('selected');
  $('#modeCombined').classList.remove('selected');
  updateGenSummary();
  saveSession();
});
$('#modeCombined').addEventListener('click', () => {
  state.generationMode = 'combined';
  $('#modeCombined').classList.add('selected');
  $('#modeSingle').classList.remove('selected');
  updateGenSummary();
  saveSession();
});

$('#sizeSelect').addEventListener('change', () => {
  state.selectedSize = $('#sizeSelect').value;
  updateGenSummary();
  saveSession();
});
const extraNotesEl = document.getElementById('extraNotes');
if (extraNotesEl) {
  extraNotesEl.addEventListener('input', () => {
    state.extraNotes = extraNotesEl.value;
    saveSession();
  });
}

function updateGenSummary() {
  const totalCount = state.clothingItems.length;
  const mode = state.generationMode === 'single' ? 'Einzeln' : 'Alle zusammen';
  const calls = totalCount === 0 ? 0 : state.generationMode === 'single' ? totalCount : 1;
  const sizeLabel = IMAGE_SIZES[state.selectedSize] || state.selectedSize;
  const items = [
    { icon: icon('camera', 16), label: 'Kleidungsstücke', val: `${totalCount}` },
    { icon: icon('settings', 16), label: 'Modus', val: mode },
    { icon: icon('globe', 16), label: 'API-Aufrufe', val: calls },
    { icon: icon('ruler', 16), label: 'Größe', val: sizeLabel },
  ];
  document.getElementById('genSummary').innerHTML =
    `<div class="gen-info-filled">${items.map(i => `<div class="gen-info-item"><span class="gen-info-icon">${i.icon}</span><span><strong>${i.val}</strong> <span class="gen-info-label">${i.label}</span></span></div>`).join('')}</div>`;
}

// ============ GENERATE ============

const generateBtn = $('#generateBtn');
const progressWrap = $('#progressWrap');

const logArea = $('#logArea');
const progressTimers = {};
let activeLottie = null;
const abortControllers = {};

function addLog(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
  logArea.appendChild(el);
  logArea.scrollTop = logArea.scrollHeight;
}

function statusIcon(type) {
  if (type === 'done') {
    return icon('check-circle', 20, 2.5).replace('stroke="currentColor"', 'stroke="#10b981"');
  }
  if (type === 'error') {
    return icon('x-circle', 20, 2.5).replace('stroke="currentColor"', 'stroke="#ef4444"');
  }
  return icon('clock', 20, 2).replace('stroke="currentColor"', 'stroke="#71717a"');
}

function showProgressItems(mode, items) {
  const container = document.getElementById('progressItems');
  const cancelBtn = `<button class="btn btn-sm btn-danger cancel-btn-spacer" id="cancelGenBtn">${icon('x', 14)} Generierung abbrechen</button>`;
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
      </div>
      ${cancelBtn}`;
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
    `).join('') + cancelBtn;
  }
  document.getElementById('cancelGenBtn')?.addEventListener('click', cancelGeneration);
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

let generationCancelled = false;

function cancelGeneration() {
  generationCancelled = true;
  Object.values(abortControllers).forEach(c => c.abort());
  addLog('Generierung vom Benutzer abgebrochen', 'warn');
  showToast('Generierung abgebrochen', 'warning');
  Object.keys(progressTimers).forEach(k => stopItemProgress(k));
  if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }
  state.isGenerating = false;
  updateGenerateBtnState();
  document.getElementById('cancelGenBtn')?.remove();
  if (state.generatedImages.length > 0) {
    state.generationDone = true;
    saveSession();
    renderResults();
    renderZipPreview();
    document.getElementById('step4')?.classList.remove('hidden-zone');
    document.getElementById('step4')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

generateBtn.addEventListener('click', async () => {
  if (state.isGenerating) return;
  clearAllFieldHighlights();
  if (!state.apiKey || !validateApiKey(state.apiKey)) {
    showToast('Bitte gültigen OpenAI API-Key eingeben.', 'error'); return
  }
  if (!state.personPhoto) {
    showToast('Kein Personenfoto vorhanden.', 'error');
    highlightUploadZone(document.getElementById('personDropZone'), 'Bitte ein Personenfoto hochladen');
    return;
  }
  if (state.clothingItems.length === 0) {
    showToast('Keine Kleidungsstücke vorhanden.', 'error');
    highlightUploadZone(document.getElementById('clothingDropZone'), 'Bitte mindestens ein Kleidungsstück hochladen');
    return;
  }

  let items = state.clothingItems;

  if (state.generationMode === 'combined' && items.length > 9) {
    showToast('Im kombinierten Modus werden max. 9 Kleidungsstücke unterstützt.', 'warning'); return;
  }

  const subKey = userProfile?.subscription || 'free';
  const maxItems = getMaxItemsForPlan(subKey);
  if (items.length > maxItems) {
    showToast(`${PLANS[subKey]?.label || 'Free'} erlaubt max. ${maxItems} Kleidungsstück${maxItems > 1 ? 'e' : ''} pro Bild. Upgrade dein Abo für mehr.`, 'warning');
    return;
  }

  const missing = items.filter(i => !i.type || !i.size);
  if (missing.length > 0) {
    showToast(`Bitte für ${missing.length} Kleidungsstück${missing.length>1?'e':''} Typ und Größe wählen.`, 'warning');
    items.forEach((item, idx) => {
      if (!item.type || !item.size) {
        highlightClothingItem(idx, 'Typ und Größe wählen');
      }
    });
    return;
  }

  const resetResult = await checkAndResetMonthly(currentUser?.uid);
  if (resetResult) {
    if (resetResult.reason === 'canceled_expired') {
      showToast('Dein Abo ist abgelaufen. Du bist jetzt auf Free zurückgestuft.', 'warning');
    } else {
      showToast('Generierungs-Zähler wurde zurückgesetzt.', 'info');
    }
    await refreshUserProfile();
  }
  const allowed = await checkGenerationAllowed(currentUser?.uid);
  if (!allowed) {
    showUpgradeModal('generate');
    if (DEV_MODE) {
      showToast('⚠️ Limit erreicht – in DEV dennoch generiert.', 'warning');
    } else {
      return;
    }
  }
  if (!DEV_MODE) {
    if (!isEmailVerified()) {
      showToast('Bitte bestätige zuerst deine E-Mail-Adresse. Prüfe dein Postfach.', 'error'); return;
    }
  }

  state.generatedImages = [];
  state.isGenerating = true;
  generationCancelled = false;
  generateBtn.disabled = true;
  progressWrap.classList.remove('hidden');
  logArea.innerHTML = '';
  document.getElementById('resultsGrid').innerHTML = '';
  state.generationDone = false;

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
        if (generationCancelled) return;
        addLog(`Generiere Anprobebild für "${item.name}" (${TYPE_LABELS[item.type]})...`);
        updateProgressItem(i, 0, 'generating');
        startItemProgress(i);
        const controller = new AbortController();
        abortControllers[i] = controller;

        try {
          addLog(`Sende API-Request für "${item.name}"...`);
          const data = await callImageEdit({
            personPhoto: state.personPhoto,
            clothingItems: [item],
            prompt: buildTryOnPrompt(item.type, item.size, state.extraNotes),
            apiKey: state.apiKey,
            signal: controller.signal,
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
          addLog(`${icon('check-circle', 12).replace('stroke="currentColor"','stroke="#10b981"')} "${item.name}" erfolgreich generiert`, 'success');
        } catch (err) {
          if (err.name === 'AbortError') return;
          if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
            addLog(`${icon('wallet', 12)} Guthaben aufgebraucht. Bitte Guthaben aufladen.`, 'error');
            showToast('OpenAI-Guthaben aufgebraucht.', 'error');
            stopItemProgress(i, false);
            failCount++;
          } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
            addLog(`${icon('key', 12)} API-Key ungültig oder keine Berechtigung.`, 'error');
            showToast('API-Key ungültig. Prüfe den Key.', 'error');
            stopItemProgress(i, false);
            failCount++;
          } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            addLog(`${icon('clock', 12)} Zeitüberschreitung bei "${item.name}" (180s).`, 'warn');
            showToast(`"${item.name}" Zeitüberschreitung, übersprungen.`, 'warning');
            stopItemProgress(i, false);
            failCount++;
          } else {
            console.error(`Fehler "${item.name}":`, err);
            addLog(`${icon('x-circle', 12)} ${err.message}`, 'error');
            showToast(`"${item.name}" fehlgeschlagen: ${err.message.slice(0, 80)}`, 'error');
            stopItemProgress(i, false);
            failCount++;
          }
        } finally {
          delete abortControllers[i];
        }

        doneCount++;
        if (!generationCancelled) progressOverallEl.textContent = `Generiere Bilder... (${doneCount}/${totalCalls} fertig)`;
      });

      await Promise.allSettled(promises);
    } else {
      addLog(`Generiere kombiniertes Anprobebild (${items.length} Kleidungsstücke)...`);
      updateProgressItem(0, 0, 'generating');
      startItemProgress(0);
      const controller = new AbortController();
      abortControllers[0] = controller;

      try {
        const data = await callImageEdit({
          personPhoto: state.personPhoto,
          clothingItems: items,
          prompt: COMBINED_PROMPT + (state.extraNotes ? `\n\nZusätzliche Anweisungen des Nutzers: ${state.extraNotes}` : ''),
          apiKey: state.apiKey,
          signal: controller.signal,
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
        addLog(`${icon('check-circle', 12)} Kombiniertes Bild erfolgreich generiert`, 'success');
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
          addLog(`${icon('wallet', 12)} Guthaben aufgebraucht.`, 'error');
          showToast('OpenAI-Guthaben aufgebraucht.', 'error');
          failCount++;
        } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
          addLog(`${icon('key', 12)} API-Key ungültig.`, 'error');
          showToast('API-Key ungültig.', 'error');
          failCount++;
        } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          addLog(`${icon('clock', 12)} Zeitüberschreitung (300s).`, 'error');
          showToast(`Zeitüberschreitung. Internet prüfen.`, 'error');
          failCount++;
        } else {
          console.error('Fehler:', err);
          addLog(`${icon('x-circle', 12)} ${err.message}`, 'error');
          showToast(`${err.message}`, 'error');
          failCount++;
        }
        stopItemProgress(0, false);
      } finally {
        delete abortControllers[0];
      }
    }

    document.getElementById('cancelGenBtn')?.remove();

    if (generationCancelled) return;

    const resultMsg = successCount > 0
      ? `${icon('check-circle', 12)} ${successCount}/${totalCalls} Bilder erfolgreich`
      : `${icon('x-circle', 12)} Alle Generierungen fehlgeschlagen.`;
    document.getElementById('progressOverall').textContent = resultMsg;
    addLog(resultMsg, successCount > 0 ? 'success' : 'error');

    if (successCount > 0) {
      state.generationDone = true;
      renderResults();
      renderZipPreview();
      generateAllSaleTexts();
      saveSession();
      if (currentUser) {
        if (!DEV_MODE) {
          await incrementGenerationsUsed(currentUser.uid);
          if (userProfile) userProfile.generationsUsed = (userProfile.generationsUsed || 0) + 1;
        }
        updateGenRemaining();
        updateGenLimitWarning();
        const first = state.generatedImages[0];
        const thumbnail = first?.base64 ? await createThumbnail(first.base64, first.mimeType) : null;
        const previewImage = first?.base64 ? await createThumbnail(first.base64, first.mimeType, 600) : null;
        saveGeneration(currentUser.uid, { mode, quality: state.selectedQuality, itemCount: items.length, notes: state.extraNotes, imageCount: successCount, thumbnail, previewImage });
      }
      addHistoryEntry(items.length, mode, successCount, state.extraNotes);
      document.getElementById('step4')?.classList.remove('hidden-zone');
      document.getElementById('step4')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateStepStepper();
      showToast(`${successCount} von ${totalCalls} Bild${totalCalls > 1 ? 'ern' : ''} erfolgreich`, successCount === totalCalls ? 'success' : 'warning');
    }
    if (failCount > 0) {
      showToast(`${failCount} ${failCount === 1 ? 'Bild' : 'Bilder'} fehlgeschlagen. Details im Log.`, 'error');
    }
  } catch (err) {
    addLog(`${icon('x-circle', 12)} Unerwarteter Fehler: ${err.message}`, 'error');
    showToast('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  } finally {
    Object.keys(progressTimers).forEach(k => stopItemProgress(k));
    if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }
    state.isGenerating = false;
    updateGenerateBtnState();
  }
});

// ============ RESULTS + SALE TEXT ============

const resultsGrid = $('#resultsGrid');

function renderResults() {
  const hint = document.getElementById('noResultsHint');
  if (state.generatedImages.length === 0) { if (hint) hint.classList.remove('hidden'); return }
  if (hint) hint.classList.add('hidden');
  resultsGrid.innerHTML = state.generatedImages.map((img, idx) => `
    <div class="result-card" data-idx="${idx}">
      <div class="result-card-header">
        <img class="result-card-thumb" src="${base64ToDataUrl(img.base64, img.mimeType)}" alt="">
        <div class="result-card-info">
          <strong>${escapeHtml(img.clothingName)}</strong>
          <span>${img.clothingType === 'combined' ? 'Kombiniert' : TYPE_LABELS[img.clothingType]} · ${getImageSize(img.base64)} MB</span>
        </div>
        <button class="collapse-toggle" aria-label="Ein-/ausklappen">${icon('chevron-down', 14)}</button>
      </div>
      <div class="result-card-body">
        <img src="${base64ToDataUrl(img.base64, img.mimeType)}" alt="${escapeHtml(img.name)}">
        <div class="result-card-actions">
          <button class="btn btn-sm btn-primary download-btn">${icon('download', 14)} Herunterladen</button>
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
      copyBtn.innerHTML = `${icon('copy', 14)} Kopieren`;
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
copyBtn.innerHTML = `${icon('copy', 14)} Kopieren`;
        copyBtn.addEventListener('click', () => copySaleText(i));
        textArea.appendChild(copyBtn);
        addLog(`${icon('check-circle', 12)} Verkaufstext für "${img.clothingName}" generiert`, 'success');
      }
    } catch (err) {
      if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
        addLog(`${icon('key', 12)} API-Key ungültig.`, 'error');
      } else {
        addLog(`${icon('x-circle', 12)} Fehler bei "${img.clothingName}": ${err.message}`, 'error');
      }
      textArea.classList.remove('generating');
      textArea.innerHTML = `<span class="gen-error-msg">${icon('x-circle', 12)} Textgenerierung fehlgeschlagen</span>`;
    }
  }
  saveSession();
}

async function generateSaleTextForImage(img) {
  const data = await callChatCompletion({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: base64ToDataUrl(img.base64, img.mimeType) } },
          { type: 'text', text: buildSalePrompt(TYPE_LABELS[img.clothingType] || img.clothingType, img.size, img.colors || [], state.extraNotes) },
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
  showToast(`${img.clothingName} wird heruntergeladen`, 'success');
}

function copySaleText(idx) {
  const text = state.generatedImages[idx]?.saleText;
  if (!text) { showToast('Kein Verkaufstext vorhanden.', 'warning'); return }
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(`.result-card[data-idx="${idx}"] .copy-text-btn`);
    if (btn) { btn.classList.add('copied'); btn.innerHTML = `${icon('check', 14)} Kopiert`; setTimeout(() => { btn.innerHTML = `${icon('copy', 14)} Kopieren`; }, 2000); }
    showToast('Verkaufstext kopiert!', 'success');
  }).catch(() => {
    showToast('Kopieren fehlgeschlagen.', 'error');
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
    showToast(`${folder}.zip erfolgreich heruntergeladen (${size} MB)`, 'success');
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
  if (btn) btn.innerHTML = (area.classList.contains('visible') ? '' : '') + `${icon('folder-open', 14)} ${area.classList.contains('visible') ? 'Ausblenden' : 'Details'}`;
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
    }).join('') + `<button class="select-overlay-confirm">${icon('check', 14)} Bestätigen</button>`;

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
      return `<button class="select-overlay-option${sel?' selected':''}" data-value="${opt.value}">${dot}<span>${opt.label}</span>${sel?`<span class="select-overlay-check">${icon('check', 14)}</span>`:''}</button>`;
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

window.toggleBurgerMenu = function () {
  const dd = document.getElementById('burgerDropdown');
  const isOpen = dd.classList.contains('open');

  if (!isOpen) {
    const btn = document.getElementById('burgerBtn');
    const rect = btn.getBoundingClientRect();

    if (window.innerWidth > 768) {
      dd.style.top = (rect.bottom + 8) + 'px';
      dd.style.right = (window.innerWidth - rect.right) + 'px';
      dd.style.left = 'auto';
      dd.style.bottom = 'auto';
      document.body.style.overflow = '';
    } else {
      const header = document.querySelector('header');
      dd.style.top = header.offsetHeight + 'px';
      document.body.style.overflow = 'hidden';
    }
  } else {
    dd.style.top = '';
    dd.style.right = '';
    dd.style.left = '';
    dd.style.bottom = '';
    document.body.style.overflow = '';
  }

  dd.classList.toggle('open');
};
window.closeBurgerMenu = function () {
  document.getElementById('burgerDropdown').classList.remove('open');
  document.body.style.overflow = '';
};
window.handleBurgerLogout = async function () {
  closeBurgerMenu();
  await logout();
  navigateTo('/');
};
document.addEventListener('click', (e) => {
  const wrapper = document.querySelector('.burger-wrapper');
  const dd = document.getElementById('burgerDropdown');
  if (wrapper && dd && !wrapper.contains(e.target) && !dd.contains(e.target)) {
    closeBurgerMenu();
  }
});
document.getElementById('burgerDropdown').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeBurgerMenu();
  }
});

window.openPhotoGuide = function () {
  document.getElementById('photoGuide').classList.add('visible');
  document.body.style.overflow = 'hidden';
};

window.closePhotoGuide = function (e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('photoGuide').classList.remove('visible');
  document.body.style.overflow = '';
};

window.openClothingGuide = function () {
  document.getElementById('clothingGuide').classList.add('visible');
  document.body.style.overflow = 'hidden';
};

window.closeClothingGuide = function (e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('clothingGuide').classList.remove('visible');
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
  document.getElementById('lightboxPrev').classList.toggle('hidden', lightboxIdx <= 0);
  document.getElementById('lightboxNext').classList.toggle('hidden', lightboxIdx >= state.generatedImages.length - 1);
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
    const cg = document.getElementById('clothingGuide');
    if (cg.classList.contains('visible')) closeClothingGuide();
    const sm = document.getElementById('settingsModal');
    if (sm.classList.contains('visible')) closeSettings();
    const so = document.getElementById('selectOverlay');
    if (so.classList.contains('visible')) closeSelectOverlay();
    const cm = document.getElementById('checkoutModal');
    if (cm.classList.contains('visible')) closeCheckout();
    const um = document.getElementById('upgradeModal');
    if (um.classList.contains('visible')) closeCheckout();
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
  zipPreview.innerHTML = `${icon('package', 14)} ${imgCount} Bild${imgCount > 1 ? 'er' : ''}${textCount > 0 ? ` + ${textCount} Verkaufstext${textCount > 1 ? 'e' : ''}` : ''} · Bereit zum Download als "${title}_${formatDate()}.zip"`;
}

export function resetUploadUI() {
  state.personPhoto = null;
  state.clothingItems = [];
  state.generatedImages = [];
  state.generationDone = false;
  state.isGenerating = false;
  state.generationMode = 'single';

  const pv = document.getElementById('personPreview');
  if (pv) pv.classList.add('hidden');
  const dropZone = document.getElementById('personDropZone');
  if (dropZone) dropZone.classList.remove('has-file');
  document.getElementById('step4')?.classList.add('hidden-zone');
  clothingPreviewGrid.innerHTML = '';
  noClothingHint.classList.remove('hidden');
  updateClothingBadge();
  resultsGrid.innerHTML = '';
  const noResultsHint = document.getElementById('noResultsHint');
  if (noResultsHint) noResultsHint.classList.remove('hidden');
  logArea.classList.remove('visible');
  logArea.innerHTML = '';
  Object.keys(progressTimers).forEach(k => stopItemProgress(k));
  if (activeLottie) { activeLottie.instance.destroy(); activeLottie = null; }
  progressWrap.classList.add('hidden');
  document.getElementById('progressItems').innerHTML = '';
  document.getElementById('progressOverall').textContent = '';
  const zp = document.getElementById('zipPreview');
  if (zp) zp.textContent = '';
  $('#modeSingle').classList.add('selected');
  $('#modeCombined').classList.remove('selected');
  state.extraNotes = '';
  const en = document.getElementById('extraNotes');
  if (en) en.value = '';

  personFileInput.value = '';
  clothingFileInput.value = '';
  clearSession();
  updateGenerateBtnState();
  navigateTo('/');
}

resetBtn.addEventListener('click', () => {
  if (state.generatedImages.length > 0 && !confirm('Wirklich zurücksetzen? Alle generierten Bilder gehen verloren.')) return;
  resetUploadUI();
  showToast('Session zurückgesetzt', 'info');
});

window.toggleKeyVisibility = function () {
  const input = document.getElementById('apiKeyInput');
  const btn = document.getElementById('keyToggleBtn');
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = icon('eye-off', 16);
    btn.title = 'Key verstecken';
  } else {
    input.type = 'password';
    btn.innerHTML = icon('eye', 16);
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

// ============ SESSION HISTORY ============

const HISTORY_KEY = 'vto_history';

function addHistoryEntry(itemCount, mode, successCount, notes) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({
      id: generateId(),
      date: new Date().toISOString(),
      itemCount,
      mode,
      successCount,
      notes: notes || '',
    });
    if (history.length > 20) history.length = 20;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
  } catch (_) {}
}

function renderHistory() {
  const container = document.getElementById('historyList');
  if (!container) return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    if (history.length === 0) {
      container.innerHTML = `<div class="empty-state empty-state--compact"><span class="empty-icon">${icon('mail', 24)}</span><span class="empty-desc">Noch keine abgeschlossenen Sessions.</span></div>`;
      return;
    }
    container.innerHTML = history.map((h, idx) => `
      <div class="history-item">
        <div class="history-item-info">
          <strong>Session ${history.length - idx}</strong>
          <span>${new Date(h.date).toLocaleDateString('de-DE')} · ${h.itemCount} Kleidungsstück${h.itemCount > 1 ? 'e' : ''} · ${h.mode === 'single' ? 'Einzeln' : 'Kombiniert'} · ${h.successCount} Bild${h.successCount > 1 ? 'er' : ''}</span>
          ${h.notes ? `<span class="history-notes">„${h.notes.slice(0, 30)}${h.notes.length > 30 ? '…' : ''}"</span>` : ''}
        </div>
        <button class="btn btn-sm btn-outline" onclick="deleteHistoryEntry('${h.id}')" title="Eintrag löschen">${icon('x', 14)}</button>
      </div>
    `).join('');
  } catch (_) {
    container.innerHTML = '';
  }
}

window.deleteHistoryEntry = function (id) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.filter(h => h.id !== id)));
    renderHistory();
  } catch (_) {}
};

window.clearHistory = function () {
  if (!confirm('Gesamten Verlauf löschen?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
};

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

function createThumbnail(base64, mimeType, maxW = 150) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(null);
    img.src = base64ToDataUrl(base64, mimeType);
  });
}

// ============ INIT ============

loadApiKey();
loadSession();
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

console.log('Virtual Try-On App (OpenAI) geladen');
console.log(`API-Key ${state.apiKey ? 'vorhanden' : 'fehlt'}`);

// Route-aware initialization
onRouteChange((path) => {
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (path === ROUTES.CREATE) {
    if (!DEV_MODE && currentUser && !isEmailVerified()) {
      showToast('Bitte bestätige zuerst deine E-Mail-Adresse.', 'error');
    }
    updateGenRemaining();
    updateGenLimitWarning();
    applyFeatureGating();
    updateStepStepper();
  }
  if (path === ROUTES.PREISE) {
    const pricingTable = document.getElementById('pricingComparisonTable');
    if (pricingTable) {
      renderPlanComparison(pricingTable, userProfile?.subscription || 'free', {
        showUpgradeBtn: true,
        onUpgrade: async () => {
          if (!currentUser) {
            try { await requireAuth(); } catch { return; }
          }
          showUpgradeModal('upgrade-btn');
        },
      });
    }
  }
});

onAuthChange((user, profile) => {
  if (!user) {
    resetUploadUI();
  }
  if (getCurrentPath() === ROUTES.CREATE) {
    updateGenRemaining();
    updateGenLimitWarning();
  }
});
