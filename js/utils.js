const TYPE_LABELS = {
  jacket_coat: 'Jacken & Mäntel',
  sweater: 'Pullover & Strickpullover',
  blazer_suit: 'Blazer & Anzüge',
  dress: 'Kleider',
  skirt: 'Röcke',
  skort: 'Skorts',
  top_tshirt: 'Tops & T-Shirts',
  jeans: 'Jeans',
  pants_leggings: 'Hosen & Leggings',
  shorts: 'Shorts',
  jumpsuit: 'Jumpsuits & Playsuits',
  swimwear: 'Bademode',
  underwear: 'Unterwäsche & Nachtwäsche',
  activewear: 'Activewear',
  costume: 'Kostüme & Besonderes',
};

const TYPE_EN = {
  jacket_coat: 'jacket or coat',
  sweater: 'sweater or pullover',
  blazer_suit: 'blazer or suit',
  dress: 'dress',
  skirt: 'skirt',
  skort: 'skort',
  top_tshirt: 'top or t-shirt',
  jeans: 'jeans',
  pants_leggings: 'pants or leggings',
  shorts: 'shorts',
  jumpsuit: 'jumpsuit or playsuit',
  swimwear: 'swimwear',
  underwear: 'underwear or loungewear',
  activewear: 'activewear',
  costume: 'costume or special outfit',
};

const COLORS = [
  { label: 'Keine Angabe', value: '', hex: '' },
  { label: 'Schwarz', value: 'schwarz', hex: '#000000' },
  { label: 'Weiß', value: 'weiss', hex: '#f5f5f5' },
  { label: 'Grau', value: 'grau', hex: '#808080' },
  { label: 'Rot', value: 'rot', hex: '#e53935' },
  { label: 'Blau', value: 'blau', hex: '#1e88e5' },
  { label: 'Grün', value: 'gruen', hex: '#43a047' },
  { label: 'Gelb', value: 'gelb', hex: '#fdd835' },
  { label: 'Pink', value: 'pink', hex: '#ec407a' },
  { label: 'Lila', value: 'lila', hex: '#8e24aa' },
  { label: 'Orange', value: 'orange', hex: '#fb8c00' },
  { label: 'Braun', value: 'braun', hex: '#8d6e63' },
  { label: 'Beige', value: 'beige', hex: '#d7ccc8' },
  { label: 'Navy', value: 'navy', hex: '#1a237e' },
  { label: 'Türkis', value: 'tuerkis', hex: '#00acc1' },
  { label: 'Bordeaux', value: 'bordeaux', hex: '#880e4f' },
  { label: 'Silber', value: 'silber', hex: '#bdbdbd' },
  { label: 'Gold', value: 'gold', hex: '#f9a825' },
  { label: 'Denim', value: 'denim', hex: '#1565c0' },
  { label: 'Mehrfarbig', value: 'mehrfarbig', hex: '' },
];

const SIZES = [
  'XXS (30/2)',
  'XS (34/6)',
  'S (36/8)',
  'M (38/10)',
  'L (40/12)',
  'XL (42/14)',
  'XXL (44/16)',
  '3XL (46/18)',
  '4XL (48/20)',
  '5XL (50/22)',
];

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

function convertImageToStandard(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const maxDim = 2048;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) {
          const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          const jpegFile = new File([blob], name, { type: 'image/jpeg' });
          resolve(jpegFile);
        } else {
          reject(new Error('Konvertierung fehlgeschlagen.'));
        }
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht geladen werden.'));
    };
    img.src = url;
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
