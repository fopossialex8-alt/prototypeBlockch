/* ╔══════════════════════════════════════════════════════════════╗
   ║  CoopEnergie — pages.js                                     ║
   ║  All page rendering: Dashboard, Cotisations, Vote,          ║
   ║  Transparence, Rapport, About                               ║
   ╚══════════════════════════════════════════════════════════════╝ */

'use strict';

/* ══════════════════════════════════════════════════════
   PAGE 0 — DASHBOARD
══════════════════════════════════════════════════════ */
const Dashboard = {
  init() {
    this.render();
  },

  render() {
    this.updateKPIs();
    this.renderFeed();
    this.renderMemberList();
    this.renderProgress();
  },

  updateKPIs() {
    const kpiData = [
      { id:'kpi-blocks',   val: STATE.chain.length,    color:'--emerald', suffix:'' },
      { id:'kpi-collecte', val: STATE.totalCollecte,   color:'--solar',   suffix:'' },
      { id:'kpi-pct',      val: STATE.pct,             color:'--sapphire',suffix:'%' },
      { id:'kpi-votes',    val: STATE.totalVotes,      color:'--violet',  suffix:''/6 },
      { id:'kpi-members',  val: Object.keys(STATE.cotisations).length, color:'--ruby', suffix:'' },
    ];
    kpiData.forEach(k => {
      const el = document.getElementById(k.id);
      if (el) el.textContent = k.val.toLocaleString('fr-FR') + k.suffix;
    });

    // Progress
    const pfill = document.getElementById('dash-prog-fill');
    const ppct  = document.getElementById('dash-prog-pct');
    const pnote = document.getElementById('dash-prog-note');
    if (pfill) pfill.style.width = STATE.pct + '%';
    if (ppct)  ppct.textContent  = STATE.pct + '%';
    if (pnote) {
      const rem = STATE.coop.objectif - STATE.totalCollecte;
      pnote.textContent = rem > 0
        ? `Encore ${rem.toLocaleString('fr-FR')} FCFA pour atteindre l'objectif`
        : '🎉 Objectif atteint — Smart contract déclenché !';
    }
  },

  renderFeed() {
    const body = document.getElementById('feed-body');
    if (!body) return;
    body.innerHTML = '';
    const blocks = [...STATE.chain].reverse().slice(0,12);
    if (!blocks.length) {
      body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--tx-4);font-size:.85rem">Chaîne initialisée — aucune transaction encore</div>`;
      return;
    }
    blocks.forEach(block => {
      const colors = { GENESIS:'emerald', COTISATION:'emerald', VOTE:'sapphire', RAPPORT:'solar', SMART:'violet' };
      const icons  = { GENESIS:'🌐', COTISATION:'💰', VOTE:'🗳', RAPPORT:'📄', SMART:'📜' };
      const color  = colors[block.type] || 'emerald';
      const icon   = icons[block.type]  || '⛓';
      const name   = block.data.member || block.data.voter || block.data.coopName || 'Système';
      const detail = block.type === 'COTISATION'
        ? `+${Number(block.data.amount).toLocaleString('fr-FR')} FCFA`
        : block.type === 'VOTE' ? `Vote: ${block.data.choice}`
        : block.type;

      const div = document.createElement('div');
      div.className = 'feed-block';
      div.innerHTML = `
        <div class="feed-block-num">#${block.num}</div>
        <div class="feed-block-icon">${icon}</div>
        <div class="feed-block-info">
          <div class="feed-block-title">${name}</div>
          <div class="feed-block-hash">⛓ ${STATE.shortHash(block.hash)}</div>
        </div>
        <div class="feed-block-badge badge-${color}">${detail}</div>`;
      div.onclick = () => Modal.openBlock(block.num - 1);
      body.appendChild(div);
    });
  },

  renderMemberList() {
    const wrap = document.getElementById('member-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    MEMBERS.forEach(m => {
      const cot = STATE.cotisations[m.id];
      const total = cot ? cot.total : 0;
      const voted = !!STATE.votes[m.id];
      const row = document.createElement('div');
      row.className = 'member-row';
      row.innerHTML = `
        <div class="member-av" style="background:${m.color}">${m.id}</div>
        <span class="member-name">${m.name}</span>
        <span class="member-contrib" style="color:${m.color}">${total ? fmt.fcfa(total) : '—'}</span>
        <span class="member-status" style="background:${voted?'var(--sapphire-dim)':'var(--bg-5)'};color:${voted?'var(--sapphire)':'var(--tx-4)'}">${voted?'✓ Voté':'—'}</span>`;
      wrap.appendChild(row);
    });
  },

  renderProgress() {
    // Already done in updateKPIs
  },
};

/* ══════════════════════════════════════════════════════
   PAGE 1 — COTISATIONS
══════════════════════════════════════════════════════ */
const Cotisations = {
  submitting: false,

  init() {
    this.buildMemberChips();
    this.buildPayChips();
    this.updatePreview();
    this.renderChain();
    this.renderStats();

    // Live preview on input change
    document.getElementById('cot-amount')?.addEventListener('input', () => this.updatePreview());
    document.getElementById('cot-note')?.addEventListener('input', () => this.updatePreview());
  },

  buildMemberChips() {
    buildChipGroup(
      'cot-members', 
      MEMBERS.map(m => ({ id:m.id, label:m.name.split(' ')[0]+' '+m.name.split(' ')[1]?.charAt(0)+'.', used:false })),
      STATE.selectedMember.id,
      (item) => {
        STATE.selectedMember = MEMBERS.find(m => m.id === item.id);
        this.updatePreview();
      }
    );
  },

  buildPayChips() {
    const chips = [
      { id:'mtn',    label:'📱 MTN MoMo' },
      { id:'orange', label:'🟠 Orange Money' },
    ];
    buildChipGroup('cot-pay', chips, STATE.payMode, (item) => {
      STATE.payMode = item.id;
      this.updatePreview();
    }, 'solar');
  },

  updatePreview() {
    const amount = parseInt(document.getElementById('cot-amount')?.value)||0;
    const m      = STATE.selectedMember;
    const prev   = STATE.lastBlock;
    const prevHash = prev ? prev.hash : '0x' + '0'.repeat(32);

    const set = (id, val, cls='') => {
      const el = document.getElementById(id);
      if (el) { el.textContent = val; if (cls) el.className = cls; }
    };

    set('prev-num',    `#${STATE.chain.length + 1}`);
    set('prev-hash',   STATE.shortHash(prevHash), 't-prev');
    set('prev-data',   `${m.name} → ${amount.toLocaleString('fr-FR')} FCFA`, 't-val');
    set('prev-pay',    STATE.payMode === 'mtn' ? 'MTN Mobile Money' : 'Orange Money', 't-stamp');
    set('prev-time',   new Date().toLocaleString('fr-FR'), 't-stamp');
    set('prev-hashval','[sera calculé au minage]', 't-hash');
  },

  async submit() {
    if (this.submitting) return;
    const amountInput = document.getElementById('cot-amount');
    const noteInput   = document.getElementById('cot-note');
    const amount = parseInt(amountInput?.value)||0;
    if (amount < 1000) { Toast.show('Montant trop faible', 'Minimum 1 000 FCFA', 'ruby'); return; }
    if (amount > 500000) { Toast.show('Montant trop élevé', 'Maximum 500 000 FCFA', 'ruby'); return; }

    this.submitting = true;
    const btn = document.getElementById('cot-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⛓ Minage…'; }

    // Animate hash
    const hashEl = document.getElementById('prev-hashval');
    if (hashEl) await animateHash(hashEl, '0x_pending', 1200);

    // Mine block
    const block = STATE.recordCotisation(
      STATE.selectedMember, amount, STATE.payMode,
      noteInput?.value || ''
    );

    // Update hash display
    if (hashEl) hashEl.textContent = STATE.shortHash(block.hash);

    this.renderChain();
    this.renderStats();
    Dashboard.render();
    updateHeaderCounter();
    Transparence.refresh();

    // Trigger smart contract check
    SmartContracts.check();

    Toast.show(
      `💰 ${STATE.selectedMember.name}`,
      `${amount.toLocaleString('fr-FR')} FCFA enregistrés — Bloc #${block.num}`,
      'emerald'
    );

    // Reset
    if (amountInput) amountInput.value = 25000;
    if (noteInput)   noteInput.value = '';
    this.submitting = false;
    if (btn) { btn.disabled = false; btn.textContent = '⛓ Enregistrer sur blockchain'; }
    this.updatePreview();
  },

  renderStats() {
    const total = STATE.totalCollecte;
    const pct   = STATE.pct;

    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('cs-total',  fmt.fcfa(total));
    set('cs-pct',    pct+'%');
    set('cs-count',  STATE.chain.filter(b=>b.type==='COTISATION').length);

    const pfill = document.getElementById('cot-prog-fill');
    const ppct  = document.getElementById('cot-prog-pct-label');
    const pnote = document.getElementById('cot-prog-note');
    if (pfill) pfill.style.width = pct+'%';
    if (ppct)  ppct.textContent  = pct+'%';
    if (pnote) {
      const rem = STATE.coop.objectif - total;
      pnote.textContent = rem > 0
        ? `Il manque ${rem.toLocaleString('fr-FR')} FCFA`
        : '🎉 Objectif atteint !';
    }
  },

  renderChain() {
    const body = document.getElementById('chain-body');
    if (!body) return;
    body.innerHTML = '';
    const cotBlocks = STATE.chain.filter(b => b.type === 'COTISATION' || b.type === 'GENESIS');
    if (cotBlocks.length <= 1) {
      body.innerHTML = `<div class="chain-empty"><div class="ce-icon">⛓</div><div>Aucune cotisation enregistrée</div><div style="font-size:.8rem;margin-top:4px;color:var(--tx-4)">Utilisez le formulaire pour commencer</div></div>`;
      return;
    }
    const toShow = cotBlocks.filter(b=>b.type==='COTISATION');
    toShow.forEach((block, i) => {
      const isLast = i === toShow.length - 1;
      const m = MEMBERS.find(m2 => m2.id === block.data.memberId) || MEMBERS[0];
      const entry = document.createElement('div');
      entry.className = 'chain-entry';
      entry.innerHTML = `
        <div class="chain-spine">
          <div class="cs-dot" style="border-color:${m.color}"></div>
          ${!isLast ? '<div class="cs-line"></div>' : ''}
        </div>
        <div class="chain-card" onclick="Modal.openBlock(${block.num-1})">
          <div class="chain-card-top">
            <span class="chain-card-num">#${block.num}</span>
            <span class="chain-card-type" style="background:var(--emerald-dim);color:var(--emerald)">💰 COTISATION</span>
            <span class="chain-card-time">${block.displayTime}</span>
          </div>
          <div class="chain-card-grid">
            <div class="ccg-item"><div class="k">Membre</div><div class="v" style="color:${m.color}">${block.data.member}</div></div>
            <div class="ccg-item"><div class="k">Montant</div><div class="v text-emerald">${Number(block.data.amount).toLocaleString('fr-FR')} FCFA</div></div>
            <div class="ccg-item"><div class="k">Paiement</div><div class="v">${block.data.payMode==='mtn'?'MTN MoMo':'Orange Money'}</div></div>
            <div class="ccg-item"><div class="k">Prev. hash</div><div class="v text-muted" style="font-size:.65rem">${STATE.shortHash(block.prevHash)}</div></div>
          </div>
          <div class="chain-card-hash">
            🔗 <span>${block.hash}</span>
            <span class="hash-valid">✓ Vérifié</span>
          </div>
        </div>`;
      body.appendChild(entry);
    });
    scrollBottom('chain-body');
  },
};

/* ══════════════════════════════════════════════════════
   PAGE 2 — VOTE
══════════════════════════════════════════════════════ */
const Vote = {
  init() {
    this.renderOptions();
    this.buildVoterChips();
    this.renderResults();
    this.renderLedger();
  },

  renderOptions() {
    const wrap = document.getElementById('vote-options');
    if (!wrap) return;
    wrap.innerHTML = '';
    Object.entries(EQUIPMENT).forEach(([key, eq]) => {
      const cnt  = STATE.voteCounts[key];
      const total = STATE.totalVotes || 1;
      const pct  = Math.round(cnt / total * 100);
      const div  = document.createElement('div');
      div.className = 'vote-option' + (STATE.selectedOption===key ? ' selected' : '');
      div.id = `opt-${key}`;
      div.innerHTML = `
        <div class="vote-opt-head">
          <div>
            <div class="vote-opt-title">${eq.name}</div>
            <div class="vote-opt-price">${fmt.fcfa(eq.price)} · ${eq.supplier}</div>
            <div style="font-size:.75rem;color:var(--tx-3);margin-top:3px">${eq.specs}</div>
          </div>
          <div class="vote-opt-badges">
            <span style="font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:var(--r-pill);background:${key==='A'?'var(--emerald-dim)':key==='B'?'var(--sapphire-dim)':'var(--solar-dim)'};color:${eq.color}">${eq.badge}</span>
            <div class="vote-radio" id="radio-${key}">${STATE.selectedOption===key?'✓':''}</div>
          </div>
        </div>
        <div class="vote-bar-row">
          <span class="vb-label">Votes</span>
          <div class="vb-track"><div class="vb-fill" id="vfill-${key}" style="width:${pct}%;background:${eq.color}"></div></div>
          <span class="vb-count" id="vcnt-${key}" style="color:${eq.color}">${cnt} vote${cnt>1?'s':''}</span>
        </div>`;
      div.onclick = () => this.selectOption(key);
      wrap.appendChild(div);
    });
  },

  selectOption(key) {
    STATE.selectedOption = key;
    document.querySelectorAll('.vote-option').forEach(o => o.classList.remove('selected'));
    const opt = document.getElementById(`opt-${key}`);
    if (opt) opt.classList.add('selected');
    document.querySelectorAll('[id^=radio-]').forEach(r => r.textContent='');
    const radio = document.getElementById(`radio-${key}`);
    if (radio) { radio.style.background='var(--emerald)'; radio.style.borderColor='var(--emerald)'; radio.style.color='var(--bg-0)'; radio.textContent='✓'; }
    this.updateVoteBtn();
  },

  buildVoterChips() {
    buildChipGroup(
      'vote-voters',
      MEMBERS.map(m => ({
        id: m.id,
        label: m.name.split(' ')[0] + ' ' + (m.name.split(' ')[1]?.charAt(0)||'') + '.',
        used: !!STATE.votes[m.id],
      })),
      STATE.selectedVoter?.id,
      (item) => {
        if (STATE.votes[item.id]) return;
        STATE.selectedVoter = MEMBERS.find(m => m.id === item.id);
        this.updateVoteBtn();
      },
      'sapphire'
    );
  },

  updateVoteBtn() {
    const btn = document.getElementById('vote-btn');
    if (!btn) return;
    const ready = STATE.selectedOption && STATE.selectedVoter && !STATE.votes[STATE.selectedVoter?.id];
    btn.disabled = !ready;
    btn.className = `btn btn-full ${ready ? 'btn-sapphire' : 'btn-ghost'}`;
    btn.textContent = ready
      ? `🗳 ${STATE.selectedVoter.name} vote pour ${STATE.selectedOption}`
      : STATE.selectedVoter && STATE.votes[STATE.selectedVoter.id]
        ? '⚠ Ce membre a déjà voté'
        : 'Sélectionnez un membre et une option';
  },

  async submitVote() {
    if (!STATE.selectedOption || !STATE.selectedVoter) return;
    if (STATE.votes[STATE.selectedVoter.id]) {
      Toast.show('Vote impossible', 'Ce membre a déjà voté', 'ruby');
      return;
    }

    const block = STATE.recordVote(STATE.selectedVoter, STATE.selectedOption);
    if (!block) return;

    this.renderOptions();
    this.buildVoterChips();
    this.renderResults();
    this.renderLedger();
    Dashboard.render();
    updateHeaderCounter();
    Transparence.refresh();
    SmartContracts.check();

    Toast.show(
      `🗳 Vote enregistré — Bloc #${block.num}`,
      `${STATE.selectedVoter.name} → Option ${STATE.selectedOption}`,
      'sapphire'
    );

    STATE.selectedOption = null;
    this.updateVoteBtn();

    if (STATE.winner) {
      setTimeout(() => {
        const eq = EQUIPMENT[STATE.winner];
        Toast.show(
          '🏆 Quorum atteint !',
          `Gagnant : ${eq.short} — Smart contract déclenché`,
          'solar',
          6000
        );
        this.showWinner();
        SmartContracts.triggerPurchase();
      }, 600);
    }
  },

  renderResults() {
    const total = STATE.totalVotes || 1;
    Object.entries(STATE.voteCounts).forEach(([key, cnt]) => {
      const pct = Math.round(cnt / total * 100);
      const eq  = EQUIPMENT[key];
      const rfill = document.getElementById(`rfill-${key}`);
      const rpct  = document.getElementById(`rpct-${key}`);
      const rcnt  = document.getElementById(`rcnt-${key}`);
      const vfill = document.getElementById(`vfill-${key}`);
      const vcnt  = document.getElementById(`vcnt-${key}`);
      if (rfill) rfill.style.width = pct + '%';
      if (rpct)  rpct.textContent  = pct + '%';
      if (rcnt)  rcnt.textContent  = cnt + ' vote' + (cnt>1?'s':'');
      if (vfill) vfill.style.width = pct + '%';
      if (vcnt)  vcnt.textContent  = cnt + ' vote' + (cnt>1?'s':'');
    });
    const tvEl = document.getElementById('total-votes-count');
    if (tvEl) tvEl.textContent = STATE.totalVotes + ' / 6 membres';
  },

  renderLedger() {
    const body = document.getElementById('vote-ledger-body');
    if (!body) return;
    body.innerHTML = '';
    const voteBlocks = STATE.chain.filter(b=>b.type==='VOTE');
    if (!voteBlocks.length) {
      body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--tx-4);font-size:.83rem">Aucun vote enregistré</div>`;
      return;
    }
    voteBlocks.forEach(block => {
      const m = MEMBERS.find(m2=>m2.id===block.data.voterId) || MEMBERS[0];
      const eq = EQUIPMENT[block.data.choice];
      const div = document.createElement('div');
      div.className = 'vote-entry';
      div.innerHTML = `
        <div class="ve-av" style="background:${m.color}">${m.id}</div>
        <span class="ve-name">${block.data.voter}</span>
        <span class="ve-choice" style="background:${eq.color}22;color:${eq.color}">Opt. ${block.data.choice}</span>
        <span class="ve-hash">${STATE.shortHash(block.hash)}</span>`;
      div.onclick = () => Modal.openBlock(block.num-1);
      div.style.cursor = 'pointer';
      body.appendChild(div);
    });
    scrollBottom('vote-ledger-body');
  },

  showWinner() {
    const banner = document.getElementById('winner-banner');
    if (!banner || !STATE.winner) return;
    const eq = EQUIPMENT[STATE.winner];
    banner.classList.add('show');
    const title = document.getElementById('winner-title');
    const sub   = document.getElementById('winner-sub');
    if (title) title.textContent = `Opt. ${STATE.winner} — ${eq.short} ÉLU`;
    if (sub)   sub.textContent   = `${STATE.voteCounts[STATE.winner]} votes · ${fmt.fcfa(eq.price)} · Fournisseur : ${eq.supplier}`;
  },
};

/* ══════════════════════════════════════════════════════
   PAGE 3 — TRANSPARENCE / AUDIT
══════════════════════════════════════════════════════ */
const Transparence = {
  init() {
    this.refresh();
  },

  refresh() {
    this.renderAuditList();
    this.updateSmartContracts();
    this.updateIntegrityCheck();
  },

  renderAuditList(filter='') {
    const body = document.getElementById('audit-list-body');
    if (!body) return;
    body.innerHTML = '';
    const all = [...STATE.chain].reverse();
    const filtered = filter
      ? all.filter(b => {
          const search = (b.type + (b.data.member||b.data.voter||b.data.coopName||'') + b.hash + (b.data.amount||b.data.choice||'')).toLowerCase();
          return search.includes(filter.toLowerCase());
        })
      : all;

    const countEl = document.getElementById('audit-count');
    if (countEl) countEl.textContent = filtered.length + ' entrées';

    if (!filtered.length) {
      body.innerHTML = `<div style="text-align:center;padding:32px;color:var(--tx-4);font-size:.84rem">Aucun résultat</div>`;
      return;
    }

    const colors = { GENESIS:'emerald', COTISATION:'emerald', VOTE:'sapphire', RAPPORT:'solar', SMART:'violet' };
    const icons  = { GENESIS:'🌐', COTISATION:'💰', VOTE:'🗳', RAPPORT:'📄', SMART:'📜' };

    filtered.forEach(block => {
      const color = colors[block.type] || 'emerald';
      const icon  = icons[block.type]  || '⛓';
      const name  = block.data.member || block.data.voter || block.data.coopName || 'Système';
      const amount = block.type === 'COTISATION'
        ? `+${Number(block.data.amount).toLocaleString('fr-FR')} FCFA`
        : block.type === 'VOTE' ? `Opt. ${block.data.choice}` : block.type;

      const div = document.createElement('div');
      div.className = 'audit-item';
      div.innerHTML = `
        <div class="audit-icon-wrap" style="background:var(--${color}-dim)">${icon}</div>
        <div class="audit-info">
          <div class="audit-title">${name}
            <span style="font-size:.62rem;font-weight:700;padding:1px 7px;border-radius:var(--r-pill);background:var(--${color}-dim);color:var(--${color});margin-left:6px">${block.type}</span>
          </div>
          <div class="audit-hash" title="${block.hash}">⛓ ${block.hash}</div>
        </div>
        <div class="audit-right">
          <div class="audit-amount" style="color:var(--${color})">${amount}</div>
          <div class="audit-time">${block.displayTime}</div>
        </div>`;
      div.onclick = () => Modal.openBlock(block.num-1);
      body.appendChild(div);
    });
  },

  updateSmartContracts() {
    // Trigger statuses
    const hasCot = STATE.chain.some(b=>b.type==='COTISATION');
    const hasVote = STATE.chain.some(b=>b.type==='VOTE');
    const objReached = STATE.pct >= 100;
    const quorum = STATE.quorumReached;

    SmartContracts.setTriggerStatus('trig-cot',  hasCot  ? 'ok' : 'idle',  hasCot  ? '✓ Actif'   : 'En attente');
    SmartContracts.setTriggerStatus('trig-vote', hasVote ? 'ok' : 'idle',  hasVote ? '✓ Actif'   : 'En attente');
    SmartContracts.setTriggerStatus('trig-obj',  objReached ? 'ok':'wait', objReached?'✓ Atteint':'En cours');
    SmartContracts.setTriggerStatus('trig-quorum', quorum ? 'ok':'wait',  quorum   ? '✓ Atteint':'En cours');
  },

  updateIntegrityCheck() {
    const result = STATE.verifyIntegrity();
    const el = document.getElementById('integrity-status');
    if (!el) return;
    if (result.valid) {
      el.innerHTML = `
        <span style="color:var(--emerald);font-size:.85rem;font-weight:700">✓ Chaîne intègre</span>
        <span style="font-size:.75rem;color:var(--tx-3);margin-top:2px;display:block">${STATE.chain.length} blocs vérifiés — Aucune altération détectée</span>`;
    } else {
      el.innerHTML = `
        <span style="color:var(--ruby);font-size:.85rem;font-weight:700">✗ Intégrité compromise au bloc #${result.invalidAt}</span>`;
    }
  },
};

/* ══════════════════════════════════════════════════════
   SMART CONTRACTS ENGINE
══════════════════════════════════════════════════════ */
const SmartContracts = {
  check() {
    Transparence.updateSmartContracts();
  },

  setTriggerStatus(id, cls, label) {
    const el = document.getElementById(id + '-status');
    const ti = document.getElementById(id);
    if (el) {
      el.className = `ti-status ts-${cls}`;
      el.textContent = label;
    }
    if (ti) ti.classList.toggle('active', cls === 'ok');
  },

  triggerPurchase() {
    if (!STATE.winner) return;
    const eq = EQUIPMENT[STATE.winner];
    // Add SMART block
    STATE.addBlock('SMART', {
      action: 'ACHAT_AUTORISE',
      equipment: eq.name,
      price: eq.price,
      supplier: eq.supplier,
      fundsReleased: STATE.totalCollecte,
      winner: STATE.winner,
      votes: STATE.voteCounts,
    });
    Dashboard.render();
    updateHeaderCounter();
    Transparence.refresh();
  },
};

/* ══════════════════════════════════════════════════════
   PAGE 4 — RAPPORT
══════════════════════════════════════════════════════ */
const Rapport = {
  generated: false,

  init() {
    this.updateStats();
  },

  updateStats() {
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('rap-collecte', fmt.fcfa(STATE.totalCollecte));
    set('rap-pct',      STATE.pct + '%');
    set('rap-blocks',   STATE.chain.length);
    set('rap-votes',    STATE.totalVotes + '/6');

    // Impact calcs
    const kits = Math.floor(STATE.totalCollecte / 62500);
    const menages = kits * 4;
    set('rap-menages', menages || '—');
    set('rap-co2',     menages ? (menages * 0.8).toFixed(1) + ' t/an' : '—');
    set('rap-savings', fmt.fcfa(Math.round(STATE.totalCollecte * 0.35)));
  },

  generate() {
    // Update date
    const dateEl = document.getElementById('report-date');
    if (dateEl) dateEl.textContent = fmt.date();

    // KPIs
    document.getElementById('rk-collecte')?.setAttribute && null;
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('rk-collecte-val', fmt.fcfa(STATE.totalCollecte));
    set('rk-pct-val',      STATE.pct + '%');
    set('rk-members-val',  Object.keys(STATE.cotisations).length + '/' + MEMBERS.length);

    // Contributions
    const contribWrap = document.getElementById('report-contrib-list');
    if (contribWrap) {
      contribWrap.innerHTML = '';
      const sorted = Object.entries(STATE.cotisations)
        .sort((a,b)=>b[1].total-a[1].total);
      if (!sorted.length) {
        contribWrap.innerHTML = `<div style="color:var(--tx-4);font-size:.8rem;padding:10px 0">Aucune cotisation enregistrée</div>`;
      } else {
        sorted.forEach(([id, cot]) => {
          const m   = cot.member;
          const pct = Math.round(cot.total / STATE.totalCollecte * 100);
          const row = document.createElement('div');
          row.className = 'report-contrib-row';
          row.innerHTML = `
            <div class="rc-av" style="background:${m.color}">${m.id}</div>
            <span class="rc-name">${m.name}</span>
            <span class="rc-amount">${fmt.fcfa(cot.total)}</span>
            <span class="rc-pct">${pct}%</span>
            <span class="rc-check">✓</span>`;
          contribWrap.appendChild(row);
        });
      }
    }

    // Decision
    const winnerEl = document.getElementById('report-winner-val');
    const winnerSub = document.getElementById('report-winner-sub');
    if (STATE.winner) {
      const eq = EQUIPMENT[STATE.winner];
      if (winnerEl) winnerEl.textContent = eq.name;
      if (winnerSub) winnerSub.textContent = `${STATE.voteCounts[STATE.winner]} votes · ${fmt.fcfa(eq.price)} · ${eq.supplier}`;
    } else {
      if (winnerEl) winnerEl.textContent = 'Vote non finalisé (quorum non atteint)';
      if (winnerSub) winnerSub.textContent = `${STATE.totalVotes}/6 votes exprimés`;
    }

    // Seal hash
    const sealHash = BlockchainEngine.hash('rapport' + Date.now() + STATE.totalCollecte + STATE.totalVotes);
    const sealEl = document.getElementById('report-seal-hash');
    if (sealEl) sealEl.textContent = STATE.shortHash(sealHash);
    const sealDate = document.getElementById('report-seal-date');
    if (sealDate) sealDate.textContent = fmt.date();

    // Add RAPPORT block to chain
    if (!this.generated) {
      STATE.addBlock('RAPPORT', {
        totalCollecte: STATE.totalCollecte,
        totalVotes: STATE.totalVotes,
        winner: STATE.winner,
        sealHash,
        membersCount: Object.keys(STATE.cotisations).length,
      });
      this.generated = true;
      Dashboard.render();
      updateHeaderCounter();
      Transparence.refresh();
    }

    Toast.show('📄 Rapport généré', `Signé blockchain · ${STATE.shortHash(sealHash)}`, 'solar');
  },

  printReport() {
    window.print();
  },
};

/* ══════════════════════════════════════════════════════
   PAGE 5 — ABOUT
══════════════════════════════════════════════════════ */
const About = {
  init() {
    // Static, no dynamic content needed
  },
};

/* ══════════════════════════════════════════════════════
   GLOBAL PAGE CHANGE HANDLER
══════════════════════════════════════════════════════ */
window.addEventListener('page-change', (e) => {
  const { page } = e.detail;
  switch(page) {
    case 0: Dashboard.render();    break;
    case 1: Cotisations.renderChain(); Cotisations.renderStats(); break;
    case 2: Vote.renderOptions(); Vote.buildVoterChips(); Vote.renderResults(); Vote.renderLedger(); break;
    case 3: Transparence.refresh(); break;
    case 4: Rapport.updateStats(); break;
  }
});

/* ══════════════════════════════════════════════════════
   GLOBAL INIT
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Wire page buttons
  window.submitCotisation = () => Cotisations.submit();
  window.submitVote       = () => Vote.submitVote();
  window.generateRapport  = () => { Rapport.generate(); };
  window.printReport      = () => Rapport.printReport();
  window.filterAudit      = (q) => Transparence.renderAuditList(q);

  // Init all pages
  Dashboard.init();
  Cotisations.init();
  Vote.init();
  Transparence.init();
  Rapport.init();
  About.init();

  // Check initial state
  SmartContracts.check();

  setTimeout(() => {
    Toast.show('⛓ Blockchain initialisée', `Bloc genesis #1 créé — Réseau : Polygon Testnet`, 'emerald');
  }, 500);

  console.log('%cCoopEnergie Blockchain Prototype\n%cMIABE Hackathon 2026 · Équipe HackForce · Groupe 19\nTCHONANG · FOPOSSI · MOGUE · DE FEUDJIO',
    'color:#00C17C;font-size:1.4rem;font-weight:800;',
    'color:#F5A623;font-size:.85rem;');
});
