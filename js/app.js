const state = {
  apiKey: '',
  personPhoto: null,
  clothingItems: [],
  generationMode: 'single',
  generatedImages: [],
  saleText: '',
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
  state.currentStep = n;
  $$('.step-section').forEach(el => el.classList.remove('visible'));
  const sec = document.getElementById(`step${n}`);
  if (sec) sec.classList.add('visible');

  $$('.step-tab').forEach(t => {
    t.classList.remove('active');
    const sn = parseInt(t.dataset.step, 10);
    if (sn === n) t.classList.add('active');
    else if (sn < n) t.classList.add('done');
    else t.classList.remove('done');
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ STEP 1: PERSON PHOTO ============

const personDropZone = $('#personDropZone');
const personFileInput = $('#personFileInput');
const personPreview = $('#personPreview');

function handlePersonFile(file) {
  if (!file) return;
  const maxSize = 7 * 1024 * 1024;
  if (file.size > maxSize) {
    showToast('Das Foto ist zu groß. Maximal 7 MB erlaubt.', 'error');
    return;
  }
  fileToBase64(file).then(data => {
    state.personPhoto = data;
    renderPersonPreview();
    showToast('Personenfoto erfolgreich geladen', 'success');
  }).catch(err => showToast(err.message, 'error'));
}

function renderPersonPreview() {
  if (!state.personPhoto) {
    personPreview.style.display = 'none';
    personDropZone.classList.remove('has-file');
    return;
  }
  personDropZone.classList.add('has-file');
  personPreview.style.display = 'block';
  personPreview.innerHTML = `<img src="${base64ToDataUrl(state.personPhoto.base64, state.personPhoto.mimeType)}" alt="Person">`;
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

function handleClothingFiles(files) {
  const maxSize = 7 * 1024 * 1024;
  const promises = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    if (f.size > maxSize) { showToast(`${f.name} ist zu groß (max 7 MB). Übersprungen.`, 'warning'); continue }
    promises.push(fileToBase64(f).then(data => {
      state.clothingItems.push({ id: generateId(), ...data, type: 'top' });
    }));
  }
  if (!promises.length) return;
  Promise.all(promises).then(() => {
    renderClothingPreviews();
    showToast(`${promises.length} Kleidungsstück${promises.length > 1 ? 'e' : ''} hinzugefügt`, 'success');
  });
}

function renderClothingPreviews() {
  if (state.clothingItems.length === 0) {
    clothingPreviewGrid.innerHTML = '';
    noClothingHint.style.display = 'block';
    return;
  }
  noClothingHint.style.display = 'none';
  clothingPreviewGrid.innerHTML = state.clothingItems.map(item => `
    <div class="preview-card" data-id="${item.id}">
      <img src="${base64ToDataUrl(item.base64, item.mimeType)}" alt="${item.name}">
      <div class="info">
        <div>${item.name}</div>
        <span class="type-badge ${item.type}">${TYPE_LABELS[item.type] || item.type}</span>
        <div class="type-selector" data-id="${item.id}">
          <button class="type-btn${item.type === 'top' ? ' selected top' : ''}" data-type="top">Oberteil</button>
          <button class="type-btn${item.type === 'bottom' ? ' selected bottom' : ''}" data-type="bottom">Unterteil</button>
          <button class="type-btn${item.type === 'shoes' ? ' selected shoes' : ''}" data-type="shoes">Schuhe</button>
        </div>
      </div>
      <button class="remove" data-id="${item.id}">×</button>
    </div>
  `).join('');

  clothingPreviewGrid.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('[data-id]').dataset.id;
      const type = btn.dataset.type;
      const item = state.clothingItems.find(i => i.id === id);
      if (!item) return;
      item.type = type;
      renderClothingPreviews();
    });
  });

  clothingPreviewGrid.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.clothingItems = state.clothingItems.filter(i => i.id !== btn.dataset.id);
      if (state.generationDone) {
        state.generationDone = false;
        $('#step4Next').disabled = true;
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

// ============ STEP 3: MODE ============

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
$('#step3Next').addEventListener('click', () => {
  if (state.generationMode === 'combined' && state.clothingItems.length > 9) {
    showToast('Im kombinierten Modus werden max. 9 Kleidungsstücke unterstützt.', 'warning');
    return;
  }
  goToStep(4);
  updateGenSummary();
});

$('#qualitySelect').addEventListener('change', () => {
  state.selectedQuality = $('#qualitySelect').value;
  updateGenSummary();
});
$('#sizeSelect').addEventListener('change', () => {
  state.selectedSize = $('#sizeSelect').value;
});

function updateGenSummary() {
  const count = state.clothingItems.length;
  const mode = state.generationMode === 'single' ? 'Einzeln' : 'Alle zusammen';
  const est = estimateCost(count, state.generationMode, state.selectedQuality);
  const sizeLabel = IMAGE_SIZES[state.selectedSize] || state.selectedSize;
  document.getElementById('genSummary').textContent =
    `${count} Kleidungsstück${count > 1 ? 'e' : ''} · Modus: ${mode} · ${est.calls} API-Aufruf${est.calls > 1 ? 'e' : ''} · ${sizeLabel}`;

  const costEl = document.getElementById('costEstimate');
  costEl.style.display = 'block';
  costEl.innerHTML = `<strong>💰 Geschätzte Kosten:</strong> ${est.calls} × $${est.perImage} = <strong>~$${est.total.toFixed(3)}</strong> (Qualität: ${QUALITY_PRICES[state.selectedQuality]?.label || 'Mittel'})<br><span style="font-size:.75rem;color:var(--text-3)">OpenAI hat keinen Free Tier. Dir wird der Betrag von deinem Guthaben abgezogen.</span>`;
}

// ============ STEP 4: GENERATE ============

const generateBtn = $('#generateBtn');
const progressWrap = $('#progressWrap');
const progressFill = $('#progressFill');
const progressLabel = $('#progressLabel');
const logArea = $('#logArea');

function addLog(msg, type = 'info') {
  logArea.classList.add('visible');
  const el = document.createElement('div');
  el.className = `log-entry ${type}`;
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logArea.appendChild(el);
  logArea.scrollTop = logArea.scrollHeight;
}

function setProgress(pct, label) {
  progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (label) progressLabel.textContent = label;
}

generateBtn.addEventListener('click', async () => {
  if (state.isGenerating) return;
  if (!state.apiKey || !validateApiKey(state.apiKey)) {
    showToast('Bitte gültigen OpenAI API-Key eingeben.', 'error'); return
  }
  if (!state.personPhoto) { showToast('Kein Personenfoto vorhanden.', 'error'); return }
  if (state.clothingItems.length === 0) { showToast('Keine Kleidungsstücke vorhanden.', 'error'); return }

  state.generatedImages = [];
  state.isGenerating = true;
  generateBtn.disabled = true;
  progressWrap.style.display = 'block';
  logArea.classList.add('visible');
  logArea.innerHTML = '';
  document.getElementById('resultsGrid').innerHTML = '';
  document.getElementById('saleTextBox').classList.remove('visible');
  document.getElementById('saleTextBox').textContent = '';
  state.generationDone = false;
  $('#step4Next').disabled = true;

  const items = state.clothingItems;
  const mode = state.generationMode;
  const totalCalls = mode === 'single' ? items.length : 1;
  let successCount = 0;
  let failCount = 0;

  try {
    if (mode === 'single') {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        addLog(`Generiere Anprobebild für "${item.name}" (${TYPE_LABELS[item.type]})...`);
        setProgress((i / totalCalls) * 100, `Bild ${i+1} von ${totalCalls} wird generiert...`);

        try {
          addLog(`Sende API-Request für "${item.name}"...`);
          const data = await callImageEdit({
            personPhoto: state.personPhoto,
            clothingItems: [item],
            prompt: buildTryOnPrompt(item.type),
            apiKey: state.apiKey,
            signal: AbortSignal.timeout(90000),
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
          });
          successCount++;
          addLog(`✅ "${item.name}" erfolgreich generiert`, 'success');
        } catch (err) {
          if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
            addLog(`💰 Guthaben aufgebraucht. Bitte Guthaben aufladen.`, 'error');
            showToast('💰 OpenAI-Guthaben aufgebraucht. Lade Guthaben auf platform.openai.com/account/billing', 'error');
            failCount++;
            break;
          } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
            addLog(`🔑 API-Key ungültig oder keine Berechtigung.`, 'error');
            showToast('🔑 API-Key ungültig. Prüfe den Key.', 'error');
            failCount++;
            break;
          } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            addLog(`⏱ Zeitüberschreitung bei "${item.name}" (90s).`, 'error');
            showToast(`⏱ Zeitüberschreitung. Internet prüfen oder Bild verkleinern.`, 'error');
            failCount++;
            break;
          } else {
            console.error(`Fehler "${item.name}":`, err);
            addLog(`❌ ${err.message}`, 'error');
            showToast(`❌ ${err.message}`, 'error');
            failCount++;
            break;
          }
        }
        setProgress(((i + 1) / totalCalls) * 100, `Bild ${i+1} von ${totalCalls} - ${successCount} OK`);
      }
    } else {
      addLog(`Generiere kombiniertes Anprobebild (${items.length} Kleidungsstücke)...`);
      setProgress(30, 'Generiere kombiniertes Bild...');

      try {
        const data = await callImageEdit({
          personPhoto: state.personPhoto,
          clothingItems: items,
          prompt: COMBINED_PROMPT,
          apiKey: state.apiKey,
          signal: AbortSignal.timeout(120000),
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
        });
        successCount++;
        addLog(`✅ Kombiniertes Bild erfolgreich generiert`, 'success');
        setProgress(100, '✅ Generierung abgeschlossen!');
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
          addLog(`⏱ Zeitüberschreitung (120s).`, 'error');
          showToast(`⏱ Zeitüberschreitung. Internet prüfen.`, 'error');
          failCount++;
        } else {
          console.error('Fehler:', err);
          addLog(`❌ ${err.message}`, 'error');
          showToast(`❌ ${err.message}`, 'error');
          failCount++;
        }
      }
    }

    setProgress(100, successCount > 0 ? '✅ Generierung abgeschlossen!' : '❌ Generierung fehlgeschlagen.');

    if (successCount > 0) {
      state.generationDone = true;
      $('#step4Next').disabled = false;
      showToast(`${successCount} Bild${successCount > 1 ? 'er' : ''} erfolgreich generiert`, 'success');
    }
    if (failCount > 0) {
      showToast(`${failCount} Generierung${failCount > 1 ? 'en' : ''} fehlgeschlagen. Details im Log.`, 'error');
    }
  } catch (err) {
    addLog(`❌ Unerwarteter Fehler: ${err.message}`, 'error');
    showToast('Ein unerwarteter Fehler ist aufgetreten.', 'error');
  } finally {
    state.isGenerating = false;
    generateBtn.disabled = false;
  }
});

$('#step4Back').addEventListener('click', () => goToStep(3));
$('#step4Next').addEventListener('click', () => {
  if (state.generatedImages.length > 0) {
    renderResults();
    goToStep(5);
  }
});

// ============ STEP 5: RESULTS + SALE TEXT ============

const resultsGrid = $('#resultsGrid');
const saleImageSelect = $('#saleImageSelect');
const saleTextBox = $('#saleTextBox');
const saleTextBtn = $('#saleTextBtn');

function renderResults() {
  if (state.generatedImages.length === 0) return;
  resultsGrid.innerHTML = state.generatedImages.map((img, idx) => `
    <div class="result-card">
      <img src="${base64ToDataUrl(img.base64, img.mimeType)}" alt="${img.name}">
      <div class="result-info">
        <strong>${img.clothingName}</strong><br>
        <span style="color:var(--text-3)">${img.clothingType === 'combined' ? 'Kombiniert' : TYPE_LABELS[img.clothingType]}</span><br>
        <span style="font-size:.7rem;color:var(--text-3)">${(getImageSize(img.base64))} MB</span>
      </div>
    </div>
  `).join('');

  saleImageSelect.innerHTML = '<option value="">– Bild auswählen –</option>' +
    state.generatedImages.map((img, idx) =>
      `<option value="${idx}">${img.clothingName} (${img.clothingType === 'combined' ? 'Kombiniert' : TYPE_LABELS[img.clothingType]})</option>`
    ).join('');
}

saleTextBtn.addEventListener('click', async () => {
  const idx = parseInt(saleImageSelect.value, 10);
  if (isNaN(idx) || !state.generatedImages[idx]) {
    showToast('Bitte zuerst ein Bild auswählen.', 'warning');
    return;
  }
  if (!state.apiKey || !validateApiKey(state.apiKey)) {
    showToast('Bitte gültigen OpenAI API-Key eingeben.', 'error');
    return;
  }

  const img = state.generatedImages[idx];
  saleTextBtn.disabled = true;
  saleTextBtn.textContent = '⏳ Generiere...';
  saleTextBox.classList.remove('visible');
  saleTextBox.textContent = '';

  try {
    addLog('Generiere Vinted-Verkaufstext...');

    const data = await callChatCompletion({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: base64ToDataUrl(img.base64, img.mimeType) } },
            { type: 'text', text: buildSalePrompt() },
          ],
        },
      ],
      apiKey: state.apiKey,
      signal: AbortSignal.timeout(30000),
    });

    const text = data.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('Leere Antwort erhalten.');
    state.saleText = text;
    saleTextBox.textContent = text;
    saleTextBox.classList.add('visible');
    addLog('✅ Verkaufstext generiert', 'success');
    showToast('Verkaufstext erfolgreich generiert', 'success');
  } catch (err) {
    if (err instanceof OpenAIError && err.type === 'insufficient_quota') {
      addLog('💰 Guthaben aufgebraucht.', 'error');
      showToast('💰 OpenAI-Guthaben aufgebraucht.', 'error');
    } else if (err instanceof OpenAIError && (err.status === 401 || err.status === 403)) {
      addLog('🔑 API-Key ungültig.', 'error');
      showToast('🔑 API-Key ungültig.', 'error');
    } else if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      addLog('⏱ Zeitüberschreitung (30s).', 'error');
      showToast('⏱ Zeitüberschreitung. Internet prüfen.', 'error');
    } else {
      console.error('Fehler bei Text-Generierung:', err);
      addLog(`❌ ${err.message}`, 'error');
      showToast(`❌ ${err.message}`, 'error');
    }
  } finally {
    saleTextBtn.disabled = false;
    saleTextBtn.textContent = '📄 Text generieren';
  }
});

$('#step5Back').addEventListener('click', () => goToStep(4));
$('#step5Next').addEventListener('click', () => {
  renderZipPreview();
  goToStep(6);
});

// ============ STEP 6: DOWNLOAD ============

const sessionTitle = $('#sessionTitle');
const downloadZipBtn = $('#downloadZipBtn');
const resetBtn = $('#resetBtn');
const zipPreview = $('#zipPreview');

function renderZipPreview() {
  const title = sessionTitle.value.trim() || 'VirtualTryOn';
  const imgCount = state.generatedImages.length;
  const hasText = state.saleText ? true : false;
  zipPreview.textContent = `📦 ${imgCount} Bild${imgCount > 1 ? 'er' : ''} ${hasText ? '+ 1 Verkaufstext' : ''} · Bereit zum Download als "${title}_${formatDate()}.zip"`;
}

downloadZipBtn.addEventListener('click', async () => {
  const title = sessionTitle.value.trim() || 'VirtualTryOn';
  const dateStr = formatDate();
  const folder = `${title}_${dateStr}`;

  if (state.generatedImages.length === 0 && !state.saleText) {
    showToast('Keine Daten zum Herunterladen.', 'warning');
    return;
  }

  try {
    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = '⏳ Packe ZIP...';

    const zip = new JSZip();

    if (state.generatedImages.length > 0) {
      const imgFolder = zip.folder(`${folder}/Bilder`);
      for (const img of state.generatedImages) {
        const safeName = img.name.replace(/[<>:"/\\|?*]/g, '_');
        imgFolder.file(safeName, img.base64, { base64: true });
      }
    }

    if (state.saleText) {
      const textFolder = zip.folder(`${folder}/Verkaufsanzeige Text`);
      textFolder.file('anzeige.txt', state.saleText);
    }

    const summary = [
      `Session: ${title}`,
      `Datum: ${dateStr}`,
      `Generierte Bilder: ${state.generatedImages.length}`,
      `Kleidungsstücke: ${state.clothingItems.map(i => `${i.name} (${TYPE_LABELS[i.type]})`).join(', ')}`,
      `Modus: ${state.generationMode === 'single' ? 'Einzeln' : 'Alle zusammen'}`,
      state.saleText ? `\n--- Verkaufstext ---\n${state.saleText}` : '',
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
    zipPreview.textContent = `✅ ZIP erstellt: ${folder}.zip (${size} MB) · ${state.generatedImages.length} Bild${state.generatedImages.length > 1 ? 'er' : ''} ${state.saleText ? '+ 1 Verkaufstext' : ''}`;
    showToast(`📦 ${folder}.zip erfolgreich heruntergeladen`, 'success');
  } catch (err) {
    showToast(`Fehler beim ZIP-Erstellen: ${err.message}`, 'error');
  } finally {
    downloadZipBtn.disabled = false;
    downloadZipBtn.textContent = '📦 ZIP herunterladen';
  }
});

resetBtn.addEventListener('click', () => {
  if (state.generatedImages.length > 0 && !confirm('Wirklich zurücksetzen? Alle generierten Bilder gehen verloren.')) return;
  state.personPhoto = null;
  state.clothingItems = [];
  state.generatedImages = [];
  state.saleText = '';
  state.generationDone = false;
  state.currentStep = 1;
  state.isGenerating = false;
  state.generationMode = 'single';

  document.getElementById('personPreview').style.display = 'none';
  document.getElementById('personDropZone').classList.remove('has-file');
  clothingPreviewGrid.innerHTML = '';
  noClothingHint.style.display = 'block';
  resultsGrid.innerHTML = '';
  saleTextBox.classList.remove('visible');
  saleTextBox.textContent = '';
  saleImageSelect.innerHTML = '<option value="">– Bild auswählen –</option>';
  logArea.classList.remove('visible');
  logArea.innerHTML = '';
  progressWrap.style.display = 'none';
  progressFill.style.width = '0%';
  $('#step4Next').disabled = true;
  zipPreview.textContent = '';
  document.getElementById('costEstimate').style.display = 'none';
  $('#modeSingle').classList.add('selected');
  $('#modeCombined').classList.remove('selected');

  personFileInput.value = '';
  clothingFileInput.value = '';
  goToStep(1);
  showToast('Session zurückgesetzt', 'info');
});

$('#step6Back').addEventListener('click', () => goToStep(5));

// ============ INIT ============

loadApiKey();

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active?.type === 'file') active.click();
  }
});

console.log('✦ Virtual Try-On App (OpenAI) geladen');
console.log(`API-Key ${state.apiKey ? '✓ vorhanden' : '✗ fehlt'}`);
