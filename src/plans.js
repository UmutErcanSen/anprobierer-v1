export const PLANS = {
  free: {
    label: 'Free', limit: 5, color: '#71717a',
    emoji: '⭐', price: '0 €', quality: 'Mittel', support: 'Standard',
    itemsPerImage: '1', vintedTexts: 'Nein',
    popular: false,
  },
  basic: {
    label: 'Basic', limit: 50, color: '#22c55e',
    emoji: '💎', price: '9,99 €', annualPrice: '8,33 €', quality: 'Hoch', support: 'Priorität',
    itemsPerImage: 'Bis zu 5', vintedTexts: 'Ja',
    popular: true,
  },
  pro: {
    label: 'Pro', limit: -1, color: '#f59e0b',
    emoji: '👑', price: '19,99 €', quality: 'Max', support: 'Premium',
    itemsPerImage: 'Unbegrenzt', vintedTexts: 'Ja',
    popular: false,
  },
};

const ROWS = [
  { label: 'Generierungen / Monat', key: (p, key) => key === 'free' ? 'Nur 5' : p.limit === -1 ? 'Unbegrenzt' : `${p.limit}` },
  { label: 'Bildqualität', key: p => p.quality },
  { label: 'Kleidungsstücke pro Bild', key: p => p.itemsPerImage },
  { label: 'Vinted-Anzeigentexte', key: p => p.vintedTexts },
  { label: 'Download-Format', key: () => 'PNG + ZIP' },
  { label: 'Support', key: p => p.support },
];

const PLAN_KEYS = ['free', 'basic', 'pro'];

export function renderPlanComparison(container, activePlan, options = {}) {
  const { showUpgradeBtn = true, onUpgrade } = options;
  const active = activePlan || '';

  const headerCells = PLAN_KEYS.map(key => {
    const p = PLANS[key];
    const isActive = active === key;
    return `<div class="plan-cell plan-cell--head${isActive ? ' plan-cell--active' : ''}" data-plan="${key}" style="--plan-color:${p.color};--plan-color-dim:${p.color}18">
      ${p.popular ? '<span class="plan-badge-popular">Beliebt</span>' : ''}
      <span class="plan-cell-name">${p.label}</span>
      <span class="plan-cell-price">${p.price}</span>
      <span class="plan-cell-period">/Monat</span>
      ${p.annualPrice ? `<div class="plan-cell-annual"><span class="plan-cell-annual-old">${p.price}</span> <span class="plan-cell-annual-new">${p.annualPrice}</span> / Monat bei Jahreszahlung</div>` : ''}
    </div>`;
  }).join('');

  const bodyRows = ROWS.map(r => `
    <div class="plan-table-row">
      <div class="plan-table-label">${r.label}</div>
      ${PLAN_KEYS.map(key => {
        const p = PLANS[key];
        const isActive = active === key;
        return `<div class="plan-cell${isActive ? ' plan-cell--active' : ''}" data-plan="${key}" style="--plan-color:${p.color};--plan-color-dim:${p.color}18">${r.key(p, key)}</div>`;
      }).join('')}
    </div>
  `).join('');

  const footerCells = PLAN_KEYS.map(key => {
    const p = PLANS[key];
    const isActive = active === key;
    if (!showUpgradeBtn) {
      return `<div class="plan-cell plan-cell--footer" data-plan="${key}"></div>`;
    }
    return `<div class="plan-cell plan-cell--footer${isActive ? ' plan-cell--active' : ''}" data-plan="${key}" style="--plan-color:${p.color};--plan-color-dim:${p.color}18">
      ${isActive
        ? `<span class="plan-active-badge">Aktuelles Abo</span>`
        : `<button class="plan-upgrade-btn" data-plan="${key}">Upgraden</button>`
      }
    </div>`;
  }).join('');

  container.innerHTML = `
    <h3 class="plan-comparison-title">Tarifvergleich</h3>
    <div class="plan-table">
      <div class="plan-table-head">
        <div class="plan-table-corner"></div>
        ${headerCells}
      </div>
      ${bodyRows}
      ${showUpgradeBtn ? `
      <div class="plan-table-row plan-table-footer">
        <div class="plan-table-label"></div>
        ${footerCells}
      </div>` : ''}
    </div>
  `;

  if (onUpgrade) {
    container.querySelectorAll('.plan-upgrade-btn').forEach(btn => {
      btn.addEventListener('click', () => onUpgrade(btn.dataset.plan));
    });
  }
}
