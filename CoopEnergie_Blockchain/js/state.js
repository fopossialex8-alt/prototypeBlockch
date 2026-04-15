/* ╔══════════════════════════════════════════════════════════════╗
   ║  CoopEnergie — state.js                                     ║
   ║  Central state + blockchain engine                          ║
   ╚══════════════════════════════════════════════════════════════╝ */

'use strict';

/* ── BLOCKCHAIN ENGINE ── */
const BlockchainEngine = {

  /* Simple but realistic pseudo-hash (deterministic for same input) */
  hash(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let h1 = 0xDEADBEEF, h2 = 0x41C6CE57;
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const combined = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return '0x' + Math.abs(combined).toString(16).padStart(8,'0') +
      Math.abs(h1).toString(16).padStart(8,'0') +
      Math.abs(h2).toString(16).padStart(8,'0') +
      Math.abs(h1^h2).toString(16).padStart(8,'0');
  },

  /* Verify chain integrity */
  verify(chain) {
    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const expectedPrev = chain[i-1].hash;
      if (block.prevHash !== expectedPrev) return { valid: false, invalidAt: i };
    }
    return { valid: true };
  },

  /* Mine a new block */
  mineBlock(type, data, prevBlock) {
    const blockNum = prevBlock ? prevBlock.num + 1 : 1;
    const prevHash = prevBlock ? prevBlock.hash : '0x' + '0'.repeat(32);
    const timestamp = new Date().toISOString();
    const blockData = { type, ...data, timestamp, blockNum };
    const hashInput = JSON.stringify(blockData) + prevHash + blockNum;
    const hash = BlockchainEngine.hash(hashInput);
    return {
      num: blockNum,
      type,
      data: blockData,
      hash,
      prevHash,
      timestamp,
      displayTime: new Date().toLocaleString('fr-FR', {
        day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
      }),
      verified: true,
    };
  },
};

/* ── MEMBERS DATA ── */
const MEMBERS = [
  { id:'AM', name:'Amina Mbarga',        color:'#00C17C', role:'Fondatrice',    zone:'Nkolbisson' },
  { id:'JK', name:'Jean Kouam',          color:'#F5A623', role:'Trésorier',     zone:'Bastos' },
  { id:'FN', name:'Fatima Njoya',        color:'#3B8EFF', role:'Membre',        zone:'Biyem-Assi' },
  { id:'PB', name:'Paul Betsem',         color:'#9B59FF', role:'Membre',        zone:'Melen' },
  { id:'MT', name:'Marie Tchoupo',       color:'#FF4560', role:'Secrétaire',    zone:'Mvog-Ada' },
  { id:'SE', name:'Samuel Ebongue',      color:'#FFCB6B', role:'Membre',        zone:'Cité-Verte' },
  { id:'RN', name:'Rose Nganou',         color:'#FF6B6B', role:'Membre',        zone:'Essos' },
  { id:'CK', name:'Christian Kotto',     color:'#4ECDC4', role:'Membre',        zone:'Mendong' },
];

/* ── EQUIPMENT OPTIONS ── */
const EQUIPMENT = {
  A: {
    name:  'Option A — Jinko Solar 400W × 4',
    short: 'Jinko 400W × 4',
    price: 195000,
    supplier: 'Solar Cam Yaoundé',
    desc:  'Kit complet : 4 panneaux 400W, onduleur hybride 5kW, batterie LFP 100Ah',
    specs: '4×400W · Onduleur 5kW · Batterie LFP 100Ah · Autonomie 18h',
    savings: '68 250 FCFA vs achat individuel',
    badge: '⭐ Recommandé',
    color: '#00C17C',
  },
  B: {
    name:  'Option B — Longi Green 350W × 3',
    short: 'Longi 350W × 3',
    price: 145000,
    supplier: 'Enersol Cameroun',
    desc:  'Solution compacte : 3 panneaux 350W, micro-onduleur, batterie AGM 80Ah',
    specs: '3×350W · Micro-onduleur · Batterie AGM 80Ah · Autonomie 12h',
    savings: '50 750 FCFA vs achat individuel',
    badge: '💰 Économique',
    color: '#3B8EFF',
  },
  C: {
    name:  'Option C — Victron 300W + Lithium',
    short: 'Victron 300W + Li',
    price: 230000,
    supplier: 'PowerAfrica CM',
    desc:  'Solution premium européenne : panneaux Victron, batterie lithium 150Ah, monitoring',
    specs: '3×300W · Victron MPPT · Batterie Li 150Ah · App monitoring',
    savings: '80 500 FCFA vs achat individuel',
    badge: '🔋 Premium',
    color: '#F5A623',
  },
};

/* ── CENTRAL STATE ── */
const STATE = {
  /* Coopérative */
  coop: {
    name: 'Groupe Lumière Nkolbisson',
    objectif: 250000,
    zone: 'Yaoundé — Nkolbisson, Cameroun',
    created: new Date().toLocaleDateString('fr-FR'),
  },

  /* Blockchain */
  chain: [],          // all blocks
  cotisations: {},    // memberId → { total, count, blocks[] }
  votes: {},          // memberId → optionKey
  voteCounts: { A:0, B:0, C:0 },
  totalCollecte: 0,

  /* UI */
  selectedMember: MEMBERS[0],
  selectedVoter:  MEMBERS[0],
  selectedOption: null,
  payMode: 'mtn',

  /* Derived */
  get pct() { return Math.min(100, Math.round(this.totalCollecte / this.coop.objectif * 100)); },
  get totalVotes() { return Object.values(this.voteCounts).reduce((a,b)=>a+b,0); },
  get quorumReached() { return this.totalVotes >= 4; },
  get winner() {
    if (!this.quorumReached) return null;
    const sorted = Object.entries(this.voteCounts).sort((a,b)=>b[1]-a[1]);
    return sorted[0][0];
  },
  get lastBlock() { return this.chain.length ? this.chain[this.chain.length-1] : null; },

  /* Add block to chain */
  addBlock(type, data) {
    const block = BlockchainEngine.mineBlock(type, data, this.lastBlock);
    this.chain.push(block);
    return block;
  },

  /* Cotisation */
  recordCotisation(member, amount, payMode, note='') {
    const data = {
      member: member.name,
      memberId: member.id,
      memberZone: member.zone,
      amount,
      payMode,
      note,
      coopName: this.coop.name,
    };
    const block = this.addBlock('COTISATION', data);
    if (!this.cotisations[member.id]) {
      this.cotisations[member.id] = { total:0, count:0, blocks:[], member };
    }
    this.cotisations[member.id].total += amount;
    this.cotisations[member.id].count++;
    this.cotisations[member.id].blocks.push(block.num);
    this.totalCollecte += amount;
    return block;
  },

  /* Vote */
  recordVote(voter, optionKey) {
    if (this.votes[voter.id]) return null;
    const data = {
      voter: voter.name,
      voterId: voter.id,
      voterZone: voter.zone,
      choice: optionKey,
      equipment: EQUIPMENT[optionKey].name,
      coopName: this.coop.name,
    };
    const block = this.addBlock('VOTE', data);
    this.votes[voter.id] = optionKey;
    this.voteCounts[optionKey]++;
    return block;
  },

  /* Chain integrity check */
  verifyIntegrity() {
    return BlockchainEngine.verify(this.chain);
  },

  /* Short hash display */
  shortHash(h) {
    if (!h) return '—';
    return h.slice(0,8)+'…'+h.slice(-6);
  },
};

/* ── INIT: Genesis block ── */
(function initGenesis() {
  STATE.addBlock('GENESIS', {
    coopName: STATE.coop.name,
    objectif: STATE.coop.objectif,
    zone: STATE.coop.zone,
    members: MEMBERS.length,
    protocol: 'CoopEnergie v1.0',
    network: 'Polygon Testnet',
  });
})();
