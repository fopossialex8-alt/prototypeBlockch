/* ╔══════════════════════════════════════════════════════════════╗
   ║  CoopEnergie — ui.js                                        ║
   ║  UI utilities: toast, modal, navigation, animations         ║
   ╚══════════════════════════════════════════════════════════════╝ */

'use strict';

/* ── TOAST ── */
const Toast = {
  show(title, body='', type='emerald', duration=4000) {
    const icons = { emerald:'✅', solar:'⚡', sapphire:'🔗', ruby:'⚠', violet:'📊' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast t-${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icons[type]||'ℹ'}</div>
      <div class="toast-body">
        <strong>${title}</strong>
        ${body ? `<span>${body}</span>` : ''}
      </div>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 350);
    }, duration);
  },
};

/* ── MODAL ── */
const Modal = {
  open(titleHTML, bodyHTML) {
    document.getElementById('modal-title').innerHTML = titleHTML;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal').classList.add('open');
  },
  close() {
    document.getElementById('modal').classList.remove('open');
  },
  openBlock(blockIdx) {
    const block = STATE.chain[blockIdx];
    if (!block) return;
    const typeIcons = { GENESIS:'🌐', COTISATION:'💰', VOTE:'🗳', RAPPORT:'📄', SMART:'📜' };
    const icon = typeIcons[block.type] || '⛓';

    const integrity = STATE.verifyIntegrity();
    const isValid = integrity.valid || integrity.invalidAt > blockIdx;

    const prevBlock = STATE.chain[blockIdx-1];
    const nextBlock = STATE.chain[blockIdx+1];

    let fieldsHTML = '';
    const d = block.data;
    if (block.type === 'COTISATION') {
      fieldsHTML = `
        <div class="modal-field"><div class="mf-label">Membre cotisant</div><div class="mf-value">${d.member} — ${d.memberZone}</div></div>
        <div class="modal-field"><div class="mf-label">Montant enregistré</div><div class="mf-value valid">${Number(d.amount).toLocaleString('fr-FR')} FCFA</div></div>
        <div class="modal-field"><div class="mf-label">Mode de paiement</div><div class="mf-value">${d.payMode === 'mtn' ? '📱 MTN Mobile Money' : '🟠 Orange Money'}</div></div>
        ${d.note ? `<div class="modal-field"><div class="mf-label">Note</div><div class="mf-value">${d.note}</div></div>` : ''}`;
    } else if (block.type === 'VOTE') {
      fieldsHTML = `
        <div class="modal-field"><div class="mf-label">Membre votant</div><div class="mf-value">${d.voter} — ${d.voterZone}</div></div>
        <div class="modal-field"><div class="mf-label">Vote exprimé</div><div class="mf-value highlight">${d.choice} — ${d.equipment}</div></div>`;
    } else if (block.type === 'GENESIS') {
      fieldsHTML = `
        <div class="modal-field"><div class="mf-label">Coopérative</div><div class="mf-value">${d.coopName}</div></div>
        <div class="modal-field"><div class="mf-label">Objectif</div><div class="mf-value">${Number(d.objectif).toLocaleString('fr-FR')} FCFA</div></div>
        <div class="modal-field"><div class="mf-label">Réseau</div><div class="mf-value highlight">${d.network}</div></div>`;
    }

    Modal.open(
      `${icon} Bloc #${block.num} — ${block.type}`,
      `
      ${fieldsHTML}
      <div class="modal-field">
        <div class="mf-label">Hash du bloc (empreinte cryptographique)</div>
        <div class="mf-value valid">${block.hash}</div>
      </div>
      <div class="modal-field">
        <div class="mf-label">Hash du bloc précédent (lien chaîne)</div>
        <div class="mf-value">${block.prevHash}</div>
      </div>
      <div class="modal-field">
        <div class="mf-label">Horodatage blockchain</div>
        <div class="mf-value">${block.data.timestamp}</div>
      </div>
      ${prevBlock ? `<div class="modal-field"><div class="mf-label">Bloc précédent</div><div class="mf-value">#${prevBlock.num} — ${prevBlock.type}</div></div>` : ''}
      ${nextBlock ? `<div class="modal-field"><div class="mf-label">Bloc suivant</div><div class="mf-value">#${nextBlock.num} — ${nextBlock.type}</div></div>` : ''}
      <div style="background:${isValid?'rgba(0,193,124,.08)':'rgba(255,69,96,.08)'};border:1px solid ${isValid?'rgba(0,193,124,.25)':'rgba(255,69,96,.25)'};border-radius:8px;padding:12px 14px;font-size:.8rem;color:${isValid?'var(--emerald)':'var(--ruby)'};display:flex;gap:8px;align-items:flex-start;margin-top:4px">
        <span>${isValid?'✓':'✗'}</span>
        <span>${isValid
          ? 'Bloc vérifié. Toute modification de ce bloc invaliderait automatiquement tous les blocs suivants, rendant la fraude instantanément détectable.'
          : 'Attention : intégrité de la chaîne compromise à partir de ce bloc.'
        }</span>
      </div>`
    );
  },
};

/* ── NAVIGATION ── */
const Nav = {
  current: 0,
  tabs: [
    { id:'dashboard',     label:'Dashboard',     icon:'📊' },
    { id:'cotisations',   label:'Cotisations',   icon:'💰' },
    { id:'vote',          label:'Vote',          icon:'🗳' },
    { id:'transparence',  label:'Transparence',  icon:'🔍' },
    { id:'rapport',       label:'Rapport',       icon:'📄' },
    { id:'about',         label:'À propos',      icon:'⛓' },
  ],

  go(idx) {
    Nav.current = idx;
    document.querySelectorAll('.page').forEach((p,i) => p.classList.toggle('active', i===idx));
    document.querySelectorAll('.nav-item').forEach((n,i) => n.classList.toggle('active', i===idx));
    document.getElementById('header-title').textContent = Nav.tabs[idx].label;
    // Trigger page-specific refresh
    window.dispatchEvent(new CustomEvent('page-change', { detail: { page: idx } }));
  },

  buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    nav.innerHTML = '';
    Nav.tabs.forEach((tab, i) => {
      const item = document.createElement('div');
      item.className = 'nav-item' + (i===0 ? ' active' : '');
      item.innerHTML = `<span class="nav-item-icon">${tab.icon}</span><span class="nav-item-label">${tab.label}</span>`;
      item.onclick = () => Nav.go(i);
      nav.appendChild(item);
      if (i === 4) {
        const div = document.createElement('div');
        div.className = 'nav-divider';
        nav.appendChild(div);
      }
    });
  },
};

/* ── SIDEBAR TOGGLE ── */
function toggleSidebar() {
  document.getElementById('app').classList.toggle('sidebar-open');
}

/* ── HASH ANIMATION ── */
async function animateHash(el, finalHash, duration=1400) {
  const chars = '0123456789abcdef';
  const steps = Math.floor(duration / 60);
  return new Promise(resolve => {
    let i = 0;
    const iv = setInterval(() => {
      let fake = '0x';
      for (let j=0; j<16; j++) fake += chars[Math.floor(Math.random()*chars.length)];
      fake += '…';
      el.textContent = fake;
      i++;
      if (i >= steps) {
        clearInterval(iv);
        el.textContent = STATE.shortHash(finalHash);
        resolve();
      }
    }, 60);
  });
}

/* ── COUNTER ANIMATION ── */
function animateCount(el, from, to, duration=800, suffix='') {
  const start = performance.now();
  const diff = to - from;
  const tick = now => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + diff * eased);
    el.textContent = val.toLocaleString('fr-FR') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ── CHIP GROUP HELPER ── */
function buildChipGroup(containerId, items, activeId, onSelect, extraClass='') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = `chip ${extraClass} ${item.id === activeId ? 'active' : ''}`;
    if (item.used) btn.classList.add('disabled');
    btn.textContent = item.label;
    btn.dataset.id = item.id;
    btn.onclick = () => {
      if (item.used) return;
      container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      onSelect(item);
    };
    container.appendChild(btn);
  });
}

/* ── FORMAT HELPERS ── */
const fmt = {
  fcfa: n  => Number(n).toLocaleString('fr-FR') + ' FCFA',
  pct:  n  => Math.round(n) + '%',
  date: () => new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }),
  initials: name => name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
};

/* ── SCROLL TO BOTTOM ── */
function scrollBottom(id) {
  const el = document.getElementById(id);
  if (el) el.scrollTop = el.scrollHeight;
}

/* ── UPDATE HEADER BLOCK COUNTER ── */
function updateHeaderCounter() {
  const el = document.getElementById('header-block-count');
  if (el) el.innerHTML = `Blocs : <span>${STATE.chain.length}</span>`;
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  Nav.buildSidebar();

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

  // Modal close
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target.id === 'modal') Modal.close();
  });
  document.getElementById('modal-close-btn').addEventListener('click', Modal.close);

  updateHeaderCounter();
});
