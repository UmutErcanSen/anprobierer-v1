const TYPE_LABELS = { top: 'Oberteil', bottom: 'Unterteil', shoes: 'Schuhe' };
const TYPE_EN = { top: 'top', bottom: 'bottoms', shoes: 'shoes' };

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function formatDate() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function generateId() { return Math.random().toString(36).slice(2, 9) }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64, mimeType: file.type || 'image/jpeg', name: file.name, file });
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl) {
  const parts = dataUrl.split(',');
  return { base64: parts[1] || parts[0], mimeType: dataUrl.split(';')[0].split(':')[1] || 'image/jpeg' };
}

function base64ToDataUrl(base64, mimeType) {
  return `data:${mimeType};base64,${base64}`;
}

function getImageSize(base64) {
  return Math.round((base64.length * 3) / 4 / 1024 / 1024 * 100) / 100;
}

function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNums);
  return new Blob([byteArray], { type: mimeType });
}

function showToast(message, type = 'info', duration = 6000) {
  const icons = { error: '❌', success: '✅', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove() }, duration);
}
