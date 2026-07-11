export const PLANS = {
  free: {
    label: 'Gratis', limit: 5, color: '#71717a',
    emoji: '⭐', price: '0 €', quality: 'Mittel', support: 'Standard',
  },
  basic: {
    label: 'Basic', limit: 50, color: '#22c55e',
    emoji: '💎', price: '9,99 €', quality: 'Hoch', support: 'Priorität',
  },
  pro: {
    label: 'Pro', limit: -1, color: '#f59e0b',
    emoji: '👑', price: '19,99 €', quality: 'Max', support: 'Premium',
  },
};

const ROWS = [
  { label: 'Generierungen', key: p => p.limit === -1 ? '∞' : `${p.limit}/Monat` },
  { label: 'Qualität', key: p => p.quality },
  { label: 'Support', key: p => p.support },
  { label: 'Preis', key: p => p.price },
];

const PLAN_KEYS = ['free', 'basic', 'pro'];

export function renderPlanComparison(container, activePlan, options = {}) {
  const { showUpgradeBtn = true } = options;
  const active = activePlan || '';
  container.innerHTML = `
    <h3 class="plan-comparison-title">📊 Tarifvergleich</h3>
    <div class="plan-table">
      <div class="plan-table-head">
        <div class="plan-table-corner"></div>
        ${PLAN_KEYS.map(key => {
          const p = PLANS[key];
          const isActive = active === key;
          return `<div class="plan-cell plan-cell--head${isActive ? ' plan-cell--active' : ''}"${isActive ? ` style="--plan-color:${p.color};--plan-color-dim:${p.color}18"` : ''}>
            <span class="plan-cell-emoji">${p.emoji}</span>
            <span class="plan-cell-name">${p.label}</span>
          </div>`;
        }).join('')}
      </div>
      ${ROWS.map(r => `
        <div class="plan-table-row">
          <div class="plan-table-label">${r.label}</div>
          ${PLAN_KEYS.map(key => {
            const isActive = active === key;
            return `<div class="plan-cell${isActive ? ' plan-cell--active' : ''}"${isActive ? ` style="--plan-color:${PLANS[key].color};--plan-color-dim:${PLANS[key].color}18"` : ''}>${r.key(PLANS[key])}</div>`;
          }).join('')}
        </div>
      `).join('')}
    </div>
    ${showUpgradeBtn ? '<button class="btn btn-primary plan-upgrade-btn" disabled>⬆️ Jetzt upgraden (bald verfügbar)</button>' : ''}
  `;
}
