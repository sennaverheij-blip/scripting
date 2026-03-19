/**
 * app.js
 * Main UI controller — navigation, client management, generate flow, library.
 */

// ─── STATE ─────────────────────────────────────────────────────────────────────
let activeView        = 'clients';
let libFilters        = { platform: 'all', type: 'all', personaId: 'all' };
let libViewMode       = 'grid';   // 'grid' | 'week'
let libSearch         = '';
let selectedPersonaId = null;   // selected in generate view
let editingPersonaId  = null;   // persona being edited in the form
let currentResearch   = null;   // research results from last run
let genDays           = 5;      // posting days per week for generation
let genFunnel         = 'tof';  // 'tof' | 'mof' | 'bof'
let clientMode        = false;  // true when a client is logged into the portal
let clientModeId      = null;   // persona id of logged-in client

// ─── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkSetup();
  bindNav();
  bindSetupScreen();
  bindClientForm();
  bindGenerateView();
  bindLibrary();
  bindSettings();
  bindModal();
  bindPortal();
  renderClients();
  renderLibrary();
  setWeekDefault();
});

// ─── SETUP SCREEN ─────────────────────────────────────────────────────────────
function checkSetup() {
  if (!getApiKey()) {
    show('setup-screen');
    hide('app-main');
  } else {
    hide('setup-screen');
    show('app-main');
  }
}

function bindSetupScreen() {
  const keyInput = $('setup-api-key');
  const toggleBtn = $('setup-toggle-key');
  const saveBtn = $('setup-save-btn');

  toggleBtn.addEventListener('click', () => togglePasswordField(keyInput, toggleBtn));

  saveBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) { flash(saveBtn, 'Enter your API key first'); return; }
    if (!key.startsWith('sk-ant-')) {
      flash(saveBtn, 'Key should start with sk-ant-');
      return;
    }
    saveSettings({ apiKey: key });
    hide('setup-screen');
    show('app-main');
  });

  keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  // In client mode only library is accessible
  if (clientMode && view !== 'library') return;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const viewEl = document.getElementById('view-' + view);
  const navEl  = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (viewEl) viewEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  activeView = view;

  if (view === 'library')  renderLibrary();
  if (view === 'generate') renderGenerateClientGrid();
  if (view === 'clients')  renderClients();
  if (view === 'settings') renderSettings();
}

// ─── CLIENT FORM ──────────────────────────────────────────────────────────────
function bindClientForm() {
  $('new-client-btn').addEventListener('click', () => openClientForm(null));
  $('new-client-empty-btn').addEventListener('click', () => openClientForm(null));
  $('close-form-btn').addEventListener('click', closeClientForm);
  $('cancel-form-btn').addEventListener('click', closeClientForm);

  $('save-client-btn').addEventListener('click', saveClientForm);
  $('delete-client-btn').addEventListener('click', confirmDeleteClient);

  // File uploads for all 3 doc fields
  document.querySelectorAll('.upload-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.querySelector(`.file-upload-input[data-for="${btn.dataset.target}"]`);
      if (input) input.click();
    });
  });

  document.querySelectorAll('.file-upload-input').forEach(input => {
    input.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await readFileAsText(file);
      const target = $(input.dataset.for);
      if (target) {
        target.value = text;
        updateCharCount(input.dataset.for);
      }
      input.value = '';
    });
  });

  // Char counts for textareas
  ['f-icp', 'f-offer', 'f-tone'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', () => updateCharCount(id));
  });

  // PIN show/hide toggle
  const pinToggle = $('f-pin-toggle');
  const pinInput  = $('f-pin');
  if (pinToggle && pinInput) {
    pinToggle.addEventListener('click', () => togglePasswordField(pinInput, pinToggle));
  }
}

function updateCharCount(fieldId) {
  const field = $(fieldId);
  const map = { 'f-icp': 'icp-count', 'f-offer': 'offer-count', 'f-tone': 'tone-count' };
  const countEl = $(map[fieldId]);
  if (field && countEl) {
    const len = field.value.length;
    countEl.textContent = len > 0 ? len.toLocaleString() + ' chars' : '';
  }
}

function openClientForm(personaId) {
  editingPersonaId = personaId;
  const isNew = !personaId;

  $('form-panel-title').textContent = isNew ? 'New Client' : 'Edit Client';
  setVisible('delete-client-btn', !isNew);

  if (isNew) {
    $('f-name').value = '';
    $('f-niche').value = '';
    $('f-icp').value = '';
    $('f-offer').value = '';
    $('f-tone').value = '';
    $('f-tiktok').checked = true;
    $('f-instagram').checked = true;
    $('f-count').value = '8';
    $('f-language').value = 'English';
    $('f-pin').value = '';
  } else {
    const p = getPersona(personaId);
    if (!p) return;
    $('f-name').value = p.name || '';
    $('f-niche').value = p.niche || '';
    $('f-icp').value = p.icpDoc || '';
    $('f-offer').value = p.offerDoc || '';
    $('f-tone').value = p.toneDoc || '';
    $('f-tiktok').checked = p.platforms?.tiktok !== false;
    $('f-instagram').checked = p.platforms?.instagram !== false;
    $('f-count').value = String(p.scriptsPerWeek || 8);
    $('f-language').value = p.language || 'English';
    $('f-pin').value = p.clientPin || '';
  }

  ['f-icp', 'f-offer', 'f-tone'].forEach(updateCharCount);
  show('client-form-overlay');
  setTimeout(() => $('f-name').focus(), 50);
}

function closeClientForm() {
  hide('client-form-overlay');
  editingPersonaId = null;
}

function saveClientForm() {
  const name  = $('f-name').value.trim();
  const niche = $('f-niche').value.trim();

  if (!name)  { highlightError('f-name',  'Client name is required'); return; }
  if (!niche) { highlightError('f-niche', 'Niche is required'); return; }

  const persona = {
    id:             editingPersonaId,
    name,
    niche,
    icpDoc:         $('f-icp').value.trim(),
    offerDoc:       $('f-offer').value.trim(),
    toneDoc:        $('f-tone').value.trim(),
    platforms:      { tiktok: $('f-tiktok').checked, instagram: $('f-instagram').checked },
    scriptsPerWeek: parseInt($('f-count').value) || 8,
    language:       $('f-language').value || 'English',
    clientPin:      $('f-pin').value.trim() || null,
  };

  savePersona(persona);
  closeClientForm();
  renderClients();
}

function confirmDeleteClient() {
  if (!editingPersonaId) return;
  const p = getPersona(editingPersonaId);
  if (!p) return;
  if (!confirm(`Delete "${p.name}" and all their scripts? This cannot be undone.`)) return;
  deletePersona(editingPersonaId);
  closeClientForm();
  renderClients();
  renderLibrary();
}

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function renderClients() {
  const personas = loadPersonas();
  const grid     = $('clients-grid');
  const empty    = $('clients-empty');

  if (personas.length === 0) {
    grid.innerHTML = '';
    show('clients-empty');
    return;
  }

  hide('clients-empty');
  grid.innerHTML = personas.map(p => {
    const scripts    = loadScriptsForPersona(p.id);
    const initials   = getInitials(p.name);
    const tiktok     = p.platforms?.tiktok !== false;
    const instagram  = p.platforms?.instagram !== false;
    const platforms  = [tiktok && 'TikTok', instagram && 'Instagram'].filter(Boolean).join(' · ');
    const scriptInfo = scripts.length > 0
      ? `${scripts.length} scripts · Last generated ${formatDate(scripts[scripts.length - 1].generatedAt)}`
      : 'No scripts yet';

    return `
      <div class="client-card" data-id="${p.id}">
        <button class="client-card-generate" data-id="${p.id}" title="Generate content">Generate ◎</button>
        <div class="client-card-avatar">${initials}</div>
        <div class="client-card-name">${esc(p.name)}</div>
        <div class="client-card-niche">${esc(p.niche)}</div>
        <div class="client-card-meta">
          ${platforms ? `<span class="client-meta-tag">${platforms}</span>` : ''}
          <span class="client-meta-tag">${p.scriptsPerWeek || 8} scripts/wk</span>
          ${p.language && p.language !== 'English' ? `<span class="client-meta-tag">${p.language}</span>` : ''}
          ${p.clientPin ? '<span class="client-meta-tag">🔒 Portal</span>' : ''}
          ${p.icpDoc ? '<span class="client-meta-tag">ICP ✓</span>' : ''}
          ${p.offerDoc ? '<span class="client-meta-tag">Offer ✓</span>' : ''}
          ${p.toneDoc ? '<span class="client-meta-tag">Tone ✓</span>' : ''}
        </div>
        <div class="client-card-scripts">${scriptInfo}</div>
      </div>
    `;
  }).join('');

  // Edit on card click
  grid.querySelectorAll('.client-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.client-card-generate')) return; // let generate button handle
      openClientForm(card.dataset.id);
    });
  });

  // Generate button
  grid.querySelectorAll('.client-card-generate').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      goGenerateForClient(btn.dataset.id);
    });
  });
}

function goGenerateForClient(personaId) {
  selectedPersonaId = personaId;
  switchView('generate');
  renderGenerateClientGrid();
  showGenerateConfig();
}

// ─── GENERATE VIEW ────────────────────────────────────────────────────────────
function renderGenerateClientGrid() {
  const personas = loadPersonas();
  const grid     = $('gen-client-grid');
  const noMsg    = $('gen-no-clients');

  if (personas.length === 0) {
    grid.innerHTML = '';
    show('gen-no-clients');
    hide('gen-step-config');
    return;
  }

  hide('gen-no-clients');
  grid.innerHTML = personas.map(p => `
    <div class="gen-client-item ${selectedPersonaId === p.id ? 'selected' : ''}"
         data-id="${p.id}">
      <div class="gen-client-item-name">${esc(p.name)}</div>
      <div class="gen-client-item-niche">${esc(p.niche)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.gen-client-item').forEach(item => {
    item.addEventListener('click', () => {
      selectedPersonaId = item.dataset.id;
      grid.querySelectorAll('.gen-client-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      showGenerateConfig();
    });
  });

  if (selectedPersonaId && personas.find(p => p.id === selectedPersonaId)) {
    showGenerateConfig();
  }
}

function showGenerateConfig() {
  if (!selectedPersonaId) return;
  const p = getPersona(selectedPersonaId);
  if (!p) return;

  const bar = $('gen-selected-bar');
  bar.innerHTML = `
    <div class="sel-bar-avatar">${getInitials(p.name)}</div>
    <div>
      <div class="sel-bar-name">${esc(p.name)}</div>
      <div class="sel-bar-niche">${esc(p.niche)}</div>
    </div>
    <button class="sel-bar-change" id="change-client-btn">Change</button>
  `;

  show('gen-step-config');
  updateScriptsCalc(p);

  $('change-client-btn').addEventListener('click', () => {
    selectedPersonaId = null;
    hide('gen-step-config');
    renderGenerateClientGrid();
  });
}

const FUNNEL_LABELS = { tof: 'Top of Funnel', mof: 'Mid Funnel', bof: 'Bottom of Funnel' };

function updateScriptsCalc(persona) {
  const p = persona || getPersona(selectedPersonaId);
  if (!p) return;
  const platforms = [
    p.platforms?.tiktok !== false && 'TikTok',
    p.platforms?.instagram !== false && 'Instagram',
  ].filter(Boolean);
  const numPlatforms = platforms.length || 2;
  const total = 3 * numPlatforms * genDays;
  const calcEl = $('scripts-calc-bar');
  if (calcEl) {
    calcEl.innerHTML =
      `3 scripts &times; ${numPlatforms} platform${numPlatforms > 1 ? 's' : ''} &times; ${genDays} days = <strong>${total} scripts</strong>` +
      `<span class="calc-duration">≈ 40–50 sec each</span>`;
  }
}

function bindGenerateView() {
  $('gen-go-create')?.addEventListener('click', e => {
    e.preventDefault();
    openClientForm(null);
    switchView('clients');
  });

  // Days toggle buttons
  document.querySelectorAll('.days-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.days-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      genDays = parseInt(btn.dataset.days);
      updateScriptsCalc();
    });
  });

  // Funnel toggle buttons
  document.querySelectorAll('.funnel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.funnel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      genFunnel = btn.dataset.funnel;
    });
  });

  $('generate-btn').addEventListener('click', startGeneration);
  $('go-library-btn').addEventListener('click', () => switchView('library'));
  $('gen-again-btn').addEventListener('click', resetGenerateView);
  $('gen-retry-btn').addEventListener('click', startGeneration);

  $('collapse-research').addEventListener('click', function () {
    const out = $('research-output');
    const collapsed = out.style.display === 'none';
    out.style.display = collapsed ? '' : 'none';
    this.textContent = collapsed ? 'Hide' : 'Show';
  });
}

function setWeekDefault() {
  const inp = $('gen-week');
  if (inp) {
    inp.value = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }
}

async function startGeneration() {
  const apiKey = getApiKey();
  if (!apiKey) {
    alert('Please add your Anthropic API key in Settings first.');
    switchView('settings');
    return;
  }

  if (!selectedPersonaId) {
    alert('Please select a client first.');
    return;
  }

  const persona = getPersona(selectedPersonaId);
  if (!persona) return;

  const weekLabel = $('gen-week').value.trim();

  // Build platforms list from persona preferences
  const platforms = [
    persona.platforms?.tiktok !== false && 'tiktok',
    persona.platforms?.instagram !== false && 'instagram',
  ].filter(Boolean);
  if (!platforms.length) platforms.push('tiktok', 'instagram');

  const config = { platforms, days: genDays, funnel: genFunnel };
  const totalScripts = 3 * platforms.length * genDays;

  // ── Enter loading state ───────────────────────────────────────────────────
  hide('gen-step-config');
  hide('gen-success');
  hide('gen-error');
  hide('gen-research-panel');
  show('gen-progress');
  $('generate-btn').disabled = true;

  // Build dynamic progress steps
  const totalBatches = platforms.reduce((s, _) => s + Math.ceil((3 * genDays) / 10), 0);
  renderProgressSteps(platforms, genDays);
  setProgressStep('prog-research', 'active');

  currentResearch = null;
  let batchsDone = 0;

  try {
    const { research, scripts } = await runContentAgent(
      persona,
      config,
      apiKey,
      status => { $('progress-status').textContent = status; },
      // onResearch callback
      r => {
        currentResearch = r;
        setProgressStep('prog-research', 'done');
        setProgressStep('prog-gen-0', 'active');
        renderResearchSummary(r);
        show('gen-research-panel');
      },
      // onProgress callback (completedBatches, totalBatches)
      (done, total) => {
        batchsDone = done;
        // Mark batch steps
        for (let i = 0; i < done - 1; i++) setProgressStep(`prog-gen-${i}`, 'done');
        setProgressStep(`prog-gen-${done - 1}`, 'done');
        if (done < total) setProgressStep(`prog-gen-${done}`, 'active');
        else setProgressStep('prog-save', 'active');
      },
    );

    setProgressStep('prog-save', 'done');
    // Stamp funnel on every script before saving
    scripts.forEach(s => { s.funnel = genFunnel; });
    saveScriptsForPersona(persona.id, scripts, weekLabel);

    hide('gen-progress');
    const days  = [...new Set(scripts.map(s => s.day))].length;
    const fLabel = FUNNEL_LABELS[genFunnel] || genFunnel;
    $('gen-success-msg').textContent =
      `${scripts.length} ${fLabel} scripts generated — 3 per platform per day across ${days} days. Saved to library.`;
    show('gen-success');

    renderLibrary();
    renderClients();

  } catch (err) {
    hide('gen-progress');
    $('gen-error-msg').textContent = err.message || 'Unexpected error. Please try again.';
    show('gen-error');
    console.error('[ContentAgent] Generation failed:', err);
  } finally {
    $('generate-btn').disabled = false;
  }
}

function renderProgressSteps(platforms, days) {
  const stepsEl = $('progress-steps-list');
  if (!stepsEl) return;

  const steps = [
    { id: 'prog-research', label: 'Deep research: niche trends & best practices' },
  ];

  platforms.forEach((p, pi) => {
    const label = p === 'tiktok' ? 'TikTok' : 'Instagram';
    const scriptsForPlatform = 3 * days;
    const numBatches = Math.ceil(scriptsForPlatform / 10);
    for (let b = 0; b < numBatches; b++) {
      const globalIdx = pi * numBatches + b;
      const rem = scriptsForPlatform - b * 10;
      const cnt = Math.min(10, rem);
      steps.push({
        id: `prog-gen-${globalIdx}`,
        label: `${label}: generate ${cnt} scripts (batch ${b + 1}/${numBatches})`,
      });
    }
  });

  steps.push({ id: 'prog-save', label: 'Save to library' });

  stepsEl.innerHTML = steps.map(s => `
    <div class="prog-step pending" id="${s.id}">
      <div class="prog-dot"></div>
      <span>${s.label}</span>
    </div>
  `).join('');
}

function resetGenerateView() {
  hide('gen-success');
  hide('gen-error');
  hide('gen-research-panel');
  hide('gen-progress');
  show('gen-step-config');
}

function setProgressStep(id, state) {
  const el = $(id);
  if (!el) return;
  el.className = 'prog-step ' + state;
}

function renderResearchSummary(research) {
  const out = $('research-output');
  const blocks = [];

  if (research.summary) {
    blocks.push(`
      <div class="research-block research-summary-block">
        <div class="research-block-title">Strategy Summary</div>
        <p>${esc(research.summary)}</p>
      </div>
    `);
  }

  if (research.trendingTopics?.length) {
    blocks.push(researchList('Trending Topics', research.trendingTopics));
  }
  if (research.painPoints?.length) {
    blocks.push(researchList('Key Pain Points', research.painPoints));
  }
  if (research.contentAngles?.length) {
    blocks.push(researchList('Content Angles', research.contentAngles));
  }
  if (research.bestFormats?.length) {
    blocks.push(researchList('Best Formats', research.bestFormats.map(f => `${f.name} — ${f.why}`)));
  }
  if (research.platformInsights?.tiktok?.length) {
    blocks.push(researchList('TikTok Insights', research.platformInsights.tiktok));
  }
  if (research.platformInsights?.instagram?.length) {
    blocks.push(researchList('Instagram Insights', research.platformInsights.instagram));
  }

  out.innerHTML = blocks.join('');
}

function researchList(title, items) {
  return `
    <div class="research-block">
      <div class="research-block-title">${title}</div>
      <ul>${items.map(i => `<li>${esc(String(i))}</li>`).join('')}</ul>
    </div>
  `;
}

// ─── LIBRARY ──────────────────────────────────────────────────────────────────
function bindLibrary() {
  document.querySelectorAll('#view-library .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`#view-library .filter-btn[data-group="${group}"]`)
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libFilters[group] = btn.dataset.filter;
      renderLibrary();
    });
  });

  const searchInput = $('searchInput');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      libSearch = searchInput.value.toLowerCase().trim();
      renderLibrary();
    }, 200);
  });

  $('lib-go-generate').addEventListener('click', () => switchView('generate'));

  // View mode toggle
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libViewMode = btn.dataset.mode;
      renderLibrary();
    });
  });
}

function renderLibrary() {
  const allScripts  = loadAllScripts();
  const personas    = loadPersonas();

  // Rebuild persona filter group
  renderPersonaFilters(personas);

  // Filter scripts
  const filtered = allScripts.filter(s => {
    const matchPersona   = libFilters.personaId === 'all' || s.personaId === libFilters.personaId;
    const matchPlatform  = libFilters.platform === 'all' || s.platform === libFilters.platform;
    const matchType      = libFilters.type === 'all' || s.type.toLowerCase() === libFilters.type;
    const matchSearch    = !libSearch || [s.topic, s.hookA, s.hookB, s.script, s.format]
      .some(f => f && f.toLowerCase().includes(libSearch));
    return matchPersona && matchPlatform && matchType && matchSearch;
  });

  // Stats
  const tiktokCount  = filtered.filter(s => s.platform === 'tiktok').length;
  const igCount      = filtered.filter(s => s.platform === 'instagram').length;
  const sellCount    = filtered.filter(s => s.type === 'Soft Sell').length;
  const valueCount   = filtered.length - sellCount;
  $('lib-stats').innerHTML = `
    <span class="stat-item"><span class="stat-dot" style="background:var(--tiktok)"></span>${tiktokCount} TikTok</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--instagram)"></span>${igCount} Reels</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--value)"></span>${valueCount} Value</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--soft-sell)"></span>${sellCount} Soft Sell</span>
  `;

  // Mix bar
  const types = {};
  filtered.forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });
  $('mixBar').innerHTML = Object.entries(types).map(([type, count]) => {
    const cls = type.toLowerCase().replace(' ', '-');
    return `<span class="mix-tag ${cls}">${count}x ${type}</span>`;
  }).join('');

  // Scripts grid
  const grid  = $('scriptsGrid');
  const empty = $('lib-empty');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    show('lib-empty');
    return;
  }

  hide('lib-empty');

  if (libViewMode === 'week') {
    renderWeekView(filtered, personas);
  } else {
    renderGridView(filtered, personas);
  }
}

function renderGridView(filtered, personas) {
  const grid = $('scriptsGrid');
  grid.className = 'scripts-grid';
  const allMetrics = loadAllMetrics();
  grid.innerHTML = filtered.map((s, idx) => scriptCardHtml(s, idx, personas, allMetrics)).join('');
  bindCardEvents(grid, filtered);
}

function scriptCardHtml(s, idx, personas, allMetrics) {
  const platformCls = s.platform;
  const typeCls     = s.type.toLowerCase().replace(' ', '-');
  const wordCount   = s.script ? s.script.split(/\s+/).length : 0;
  const duration    = Math.round(wordCount / 3);
  const preview     = s.script ? s.script.substring(0, 150) + '...' : '';
  const personaName = personas.find(p => p.id === s.personaId)?.name || '';
  const dayLabel    = s.day ? `<span class="client-meta-tag" style="font-size:0.65rem">${s.day} · #${s.slot}</span>` : '';
  const metrics     = s.id ? (allMetrics || {})[s.id] : null;

  // Format icons for content types available
  const hasOutline   = Array.isArray(s.outline) && s.outline.length;
  const hasCarousel  = s.carousel?.slides?.length;
  const hasScreenTxt = Array.isArray(s.screenText) && s.screenText.length;
  const formatIcons  = [
    hasOutline   && '<span class="content-icon" title="Outline">≡</span>',
    hasScreenTxt && '<span class="content-icon" title="On-Screen Text">T</span>',
    hasCarousel  && '<span class="content-icon" title="Carousel">⧉</span>',
  ].filter(Boolean).join('');

  const funnelLabels = { tof: 'TOF', mof: 'MOF', bof: 'BOF' };
  const funnelTag = s.funnel
    ? `<span class="funnel-badge funnel-${s.funnel}">${funnelLabels[s.funnel] || s.funnel.toUpperCase()}</span>`
    : '';

  const metricsTag = metrics
    ? `<span class="metrics-pill">${metrics.views ? formatViews(metrics.views) + ' views' : '📊 Tracked'}</span>`
    : '';

  return `
    <div class="script-card" data-idx="${idx}">
      <div class="card-header">
        <span class="card-number">${String(s.number || idx + 1).padStart(2, '0')}</span>
        <div class="card-badges">
          ${dayLabel}
          ${personaName ? `<span class="client-meta-tag" style="font-size:0.65rem">${esc(personaName)}</span>` : ''}
          <span class="platform-badge ${platformCls}">${s.platform === 'tiktok' ? 'TikTok' : 'IG Reel'}</span>
          <span class="type-badge ${typeCls}">${s.type}</span>
          ${funnelTag}
        </div>
      </div>
      <div class="card-body">
        <div class="card-topic">${esc(s.topic || '')}</div>
        <div class="card-format">${esc(s.format || '')} ${formatIcons}</div>
        <div class="card-hook">"${esc(s.hookA || '')}"</div>
        <div class="card-preview">${esc(preview)}</div>
      </div>
      <div class="card-footer">
        <span class="word-count">${wordCount}w · ~${duration}s ${metricsTag}</span>
        <div class="card-actions">
          <button class="action-btn copy-hook-btn"
            data-hook="${escAttr(s.hookA || '')}"
            onclick="event.stopPropagation()">Copy Hook</button>
          <button class="action-btn copy-script-btn"
            data-script="${escAttr(s.script || '')}"
            onclick="event.stopPropagation()">Copy Script</button>
        </div>
      </div>
    </div>
  `;
}

function formatViews(n) {
  if (!n || isNaN(n)) return '';
  n = Number(n);
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function bindCardEvents(container, scripts) {
  container.querySelectorAll('.script-card').forEach((card, idx) => {
    card.addEventListener('click', () => openScriptModal(scripts[idx]));
  });
  container.querySelectorAll('.copy-hook-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn, btn.dataset.hook));
  });
  container.querySelectorAll('.copy-script-btn').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn, btn.dataset.script));
  });
}

// ─── WEEK VIEW ─────────────────────────────────────────────────────────────────
function renderWeekView(filtered, personas) {
  const grid = $('scriptsGrid');
  const allMetrics = loadAllMetrics();
  grid.className = 'week-view-grid';

  // Find all unique days in the scripts
  const allDays = [...new Set(filtered.map(s => s.day).filter(Boolean))];
  // Sort by WEEK_DAYS order (from agent.js, but we can replicate)
  const dayOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const days = dayOrder.filter(d => allDays.includes(d));

  // If no day data, fall back to grid view
  if (!days.length) {
    renderGridView(filtered, personas);
    return;
  }

  const platforms = ['tiktok', 'instagram'].filter(p => filtered.some(s => s.platform === p));

  // Build a lookup: day → platform → slot → script
  const byDayPlatformSlot = {};
  filtered.forEach(s => {
    if (!s.day) return;
    if (!byDayPlatformSlot[s.day]) byDayPlatformSlot[s.day] = {};
    if (!byDayPlatformSlot[s.day][s.platform]) byDayPlatformSlot[s.day][s.platform] = {};
    byDayPlatformSlot[s.day][s.platform][s.slot || 1] = s;
  });

  // Collect ALL filtered scripts in order for click-index mapping
  const orderedScripts = [];

  let html = `
    <div class="week-header">
      <div class="week-platform-label"></div>
      ${days.map(d => `<div class="week-day-label">${d}</div>`).join('')}
    </div>
  `;

  platforms.forEach(platform => {
    const platLabel = platform === 'tiktok' ? 'TikTok' : 'IG Reel';
    const platCls   = platform;

    html += `<div class="week-platform-row">
      <div class="week-platform-label"><span class="platform-badge ${platCls}">${platLabel}</span></div>`;

    // 3 slots per day
    for (let slot = 1; slot <= 3; slot++) {
      if (slot === 1) {
        // Start a new row group (the 3 slots stacked within each day)
      }
    }

    // We'll render slot by slot as rows
    html += `<div class="week-slots-group">`;
    for (let slot = 1; slot <= 3; slot++) {
      html += `<div class="week-slot-row">
        <div class="week-slot-label">#${slot}</div>`;

      days.forEach(day => {
        const s = byDayPlatformSlot[day]?.[platform]?.[slot];
        if (s) {
          const scriptIdx = orderedScripts.length;
          orderedScripts.push(s);
          const wordCount = s.script ? s.script.split(/\s+/).length : 0;
          const duration  = Math.round(wordCount / 3);
          const typeCls   = s.type.toLowerCase().replace(' ', '-');
          const hasM      = s.id && allMetrics[s.id];
          html += `
            <div class="week-script-cell script-card" data-idx="${scriptIdx}">
              <div class="week-cell-type">
                <span class="type-badge ${typeCls}">${s.type}</span>
                ${hasM ? `<span class="metrics-pill" style="margin-left:4px">📊</span>` : ''}
              </div>
              <div class="week-cell-format">${esc(s.format || '')}</div>
              <div class="week-cell-hook">"${esc(s.hookA || '')}"</div>
              <div class="week-cell-meta">${wordCount}w · ~${duration}s</div>
              <div class="week-cell-actions">
                <button class="action-btn copy-hook-btn" data-hook="${escAttr(s.hookA || '')}" onclick="event.stopPropagation()">Hook</button>
                <button class="action-btn copy-script-btn" data-script="${escAttr(s.script || '')}" onclick="event.stopPropagation()">Script</button>
              </div>
            </div>`;
        } else {
          html += `<div class="week-script-cell week-cell-empty">—</div>`;
        }
      });

      html += `</div>`; // week-slot-row
    }
    html += `</div>`; // week-slots-group

    html += `</div>`; // week-platform-row
  });

  grid.innerHTML = html;

  // Bind events using orderedScripts
  bindCardEvents(grid, orderedScripts);
}

function renderPersonaFilters(personas) {
  const group = $('persona-filter-group');
  if (!group) return;

  // In client mode, show only the client's name as a non-interactive label
  if (clientMode && clientModeId) {
    const p = personas.find(x => x.id === clientModeId);
    group.innerHTML = p
      ? `<span class="filter-btn active" style="cursor:default">${esc(p.name)}</span>`
      : '';
    return;
  }

  // Preserve active state
  const current = libFilters.personaId;

  group.innerHTML = [
    { id: 'all', name: 'All Clients' },
    ...personas,
  ].map(p => `
    <button class="filter-btn ${current === p.id ? 'active' : ''}"
      data-filter="${p.id}" data-group="personaId">
      ${esc(p.name)}
    </button>
  `).join('');

  group.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      libFilters.personaId = btn.dataset.filter;
      renderLibrary();
    });
  });
}

// ─── SCRIPT MODAL ─────────────────────────────────────────────────────────────
function bindModal() {
  $('modalClose').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', e => {
    if (e.target === $('modalOverlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function openScriptModal(script) {
  const platformCls = script.platform;
  const typeCls     = script.type.toLowerCase().replace(' ', '-');
  const wordCount   = script.script ? script.script.split(/\s+/).length : 0;
  const duration    = Math.round(wordCount / 3);
  const existingMetrics = script.id ? loadMetrics(script.id) : null;

  const hasOutline   = Array.isArray(script.outline) && script.outline.length;
  const hasScreenTxt = Array.isArray(script.screenText) && script.screenText.length;
  const hasCarousel  = script.carousel?.slides?.length;

  // ── Build tab list ──────────────────────────────────────────────────────────
  const tabs = [
    { id: 'script',   label: 'Script' },
    { id: 'outline',  label: 'Outline',   hidden: !hasOutline },
    { id: 'screen',   label: 'On-Screen', hidden: !hasScreenTxt },
    { id: 'carousel', label: 'Carousel',  hidden: !hasCarousel },
    { id: 'metrics',  label: existingMetrics ? '📊 Metrics' : 'Add Metrics' },
  ].filter(t => !t.hidden);

  // ── Carousel HTML ───────────────────────────────────────────────────────────
  const carouselHtml = hasCarousel ? `
    <div class="carousel-cover">
      <div class="carousel-cover-label">Cover Slide</div>
      <div class="carousel-cover-text">${esc(script.carousel.cover || '')}</div>
      <button class="modal-btn copy-inline" data-copy="${escAttr(script.carousel.cover || '')}">Copy</button>
    </div>
    <div class="carousel-slides">
      ${script.carousel.slides.map((sl, i) => `
        <div class="carousel-slide">
          <div class="slide-number">Slide ${i + 2}</div>
          <div class="slide-headline">${esc(sl.headline || '')}</div>
          <div class="slide-body">${esc(sl.body || '')}</div>
          <button class="modal-btn copy-inline" data-copy="${escAttr((sl.headline || '') + '\n\n' + (sl.body || ''))}">Copy slide</button>
        </div>
      `).join('')}
    </div>
    <div class="carousel-cta-slide">
      <div class="carousel-cover-label">CTA Slide</div>
      <div class="carousel-cover-text">${esc(script.carousel.cta || '')}</div>
      <button class="modal-btn copy-inline" data-copy="${escAttr(script.carousel.cta || '')}">Copy</button>
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="copy-carousel-all">Copy All Carousel Copy</button>
    </div>
  ` : '<p class="empty-tab">No carousel copy — regenerate this client\'s content to get carousel slides.</p>';

  // ── Outline HTML ────────────────────────────────────────────────────────────
  const outlineHtml = hasOutline ? `
    <div class="outline-list">
      ${script.outline.map((pt, i) => `
        <div class="outline-item">
          <span class="outline-num">${i + 1}</span>
          <span class="outline-text">${esc(pt)}</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="copy-outline">Copy Outline</button>
    </div>
  ` : '<p class="empty-tab">No outline — regenerate this client\'s content to get bullet outlines.</p>';

  // ── On-Screen Text HTML ─────────────────────────────────────────────────────
  const screenHtml = hasScreenTxt ? `
    <p class="tab-desc">Text overlays to display during the video. Use these as captions or bold text that appears on screen.</p>
    <div class="screen-text-list">
      ${script.screenText.map((line, i) => `
        <div class="screen-text-item">
          <div class="screen-text-line">${esc(line)}</div>
          <button class="modal-btn copy-inline" data-copy="${escAttr(line)}">Copy</button>
        </div>
      `).join('')}
    </div>
    <div class="modal-actions">
      <button class="modal-btn primary" id="copy-screen-all">Copy All Screen Text</button>
    </div>
  ` : '<p class="empty-tab">No on-screen text — regenerate this client\'s content to get text overlays.</p>';

  // ── Metrics HTML ─────────────────────────────────────────────────────────────
  const m = existingMetrics || {};
  const metricsHtml = `
    ${existingMetrics ? renderMetricsDisplay(existingMetrics, script.platform) : ''}
    <div class="metrics-form">
      <div class="metrics-form-title">${existingMetrics ? 'Update Metrics' : 'Log Post Performance'}</div>
      <p class="tab-desc">Track how this script performs when posted. Helps identify what content to double down on.</p>
      <div class="metrics-inputs">
        <div class="metric-input-row">
          <label>Views</label>
          <input type="number" id="m-views" class="form-input metric-inp" placeholder="0" value="${m.views || ''}">
        </div>
        <div class="metric-input-row">
          <label>Likes</label>
          <input type="number" id="m-likes" class="form-input metric-inp" placeholder="0" value="${m.likes || ''}">
        </div>
        <div class="metric-input-row">
          <label>Comments</label>
          <input type="number" id="m-comments" class="form-input metric-inp" placeholder="0" value="${m.comments || ''}">
        </div>
        <div class="metric-input-row">
          <label>Shares</label>
          <input type="number" id="m-shares" class="form-input metric-inp" placeholder="0" value="${m.shares || ''}">
        </div>
        <div class="metric-input-row">
          <label>Saves</label>
          <input type="number" id="m-saves" class="form-input metric-inp" placeholder="0" value="${m.saves || ''}">
        </div>
        <div class="metric-input-row">
          <label>Retention %</label>
          <input type="number" id="m-retention" class="form-input metric-inp" placeholder="0–100" min="0" max="100" value="${m.retention || ''}">
        </div>
      </div>
      <div class="form-group" style="margin-top:12px">
        <label>Notes</label>
        <textarea id="m-notes" class="form-textarea" rows="2" placeholder="e.g. Went viral on day 2, hook B performed better...">${m.notes || ''}</textarea>
      </div>
      <div class="metrics-form-actions">
        <button class="btn-primary" id="save-metrics-btn">Save Metrics</button>
        ${existingMetrics ? `<button class="btn-danger" id="delete-metrics-btn">Remove</button>` : ''}
      </div>
    </div>
  `;

  // ── Assemble modal ──────────────────────────────────────────────────────────
  $('modalBody').innerHTML = `
    <div class="modal-header-block">
      <div class="modal-meta">
        <span class="platform-badge ${platformCls}">
          ${script.platform === 'tiktok' ? 'TikTok' : 'Instagram Reel'}
        </span>
        <span class="type-badge ${typeCls}">${script.type}</span>
        <span class="mix-tag" style="color:var(--text-muted);border-color:var(--border);background:var(--surface-2)">
          ${wordCount} words · ~${duration}s
        </span>
        ${existingMetrics ? `<span class="metrics-pill">📊 ${existingMetrics.views ? formatViews(existingMetrics.views) + ' views' : 'Tracked'}</span>` : ''}
      </div>
      <div class="modal-topic">${esc(script.topic || '')}</div>
      <div class="modal-format">Format: ${esc(script.format || '')}</div>
    </div>

    <div class="modal-tabs">
      ${tabs.map((t, i) => `
        <button class="modal-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>
      `).join('')}
    </div>

    <div class="tab-panel active" id="panel-script">
      <div class="modal-section">
        <div class="modal-section-title">Hooks</div>
        <div class="hook-option">
          <div class="hook-label">Hook A</div>
          ${esc(script.hookA || '')}
        </div>
        <div class="hook-option">
          <div class="hook-label">Hook B</div>
          ${esc(script.hookB || '')}
        </div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Full Script</div>
        <div class="modal-script">${esc(script.script || '')}</div>
      </div>
      <div class="modal-section">
        <div class="modal-section-title">Calls to Action</div>
        <div class="cta-option">
          <div class="cta-label">CTA A</div>
          ${esc(script.ctaA || '')}
        </div>
        <div class="cta-option">
          <div class="cta-label">CTA B</div>
          ${esc(script.ctaB || '')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn primary" id="modal-copy-all">Copy Full Script</button>
        <button class="modal-btn" id="modal-copy-hook">Copy Hook A</button>
        <button class="modal-btn" id="modal-copy-hookb">Copy Hook B</button>
        <button class="modal-btn" id="modal-copy-cta">Copy CTA A</button>
      </div>
    </div>

    <div class="tab-panel" id="panel-outline">${outlineHtml}</div>
    <div class="tab-panel" id="panel-screen">${screenHtml}</div>
    <div class="tab-panel" id="panel-carousel">${carouselHtml}</div>
    <div class="tab-panel" id="panel-metrics">${metricsHtml}</div>
  `;

  // ── Tab switching ───────────────────────────────────────────────────────────
  $('modalBody').querySelectorAll('.modal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $('modalBody').querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
      $('modalBody').querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('panel-' + btn.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // ── Script tab actions ──────────────────────────────────────────────────────
  $('modal-copy-all')?.addEventListener('click', function () {
    copyModalBtn(this, `${script.hookA}\n\n${script.script}\n\n${script.ctaA}`);
  });
  $('modal-copy-hook')?.addEventListener('click', function () { copyModalBtn(this, script.hookA); });
  $('modal-copy-hookb')?.addEventListener('click', function () { copyModalBtn(this, script.hookB); });
  $('modal-copy-cta')?.addEventListener('click', function () { copyModalBtn(this, script.ctaA); });

  // ── Outline copy ─────────────────────────────────────────────────────────────
  $('copy-outline')?.addEventListener('click', function () {
    const text = (script.outline || []).map((p, i) => `${i + 1}. ${p}`).join('\n');
    copyModalBtn(this, text);
  });

  // ── Screen text copy ─────────────────────────────────────────────────────────
  $('copy-screen-all')?.addEventListener('click', function () {
    copyModalBtn(this, (script.screenText || []).join('\n'));
  });

  // ── Carousel copy ─────────────────────────────────────────────────────────────
  $('copy-carousel-all')?.addEventListener('click', function () {
    if (!script.carousel) return;
    const { cover, slides, cta } = script.carousel;
    const lines = [
      `COVER: ${cover}`,
      '',
      ...(slides || []).map((sl, i) => `SLIDE ${i + 2}:\n${sl.headline}\n${sl.body}`),
      '',
      `CTA: ${cta}`,
    ];
    copyModalBtn(this, lines.join('\n'));
  });

  // Inline copy buttons (carousel/screen text)
  $('modalBody').querySelectorAll('.copy-inline').forEach(btn => {
    btn.addEventListener('click', function () { copyModalBtn(this, this.dataset.copy); });
  });

  // ── Metrics save / delete ────────────────────────────────────────────────────
  $('save-metrics-btn')?.addEventListener('click', function () {
    if (!script.id) return;
    const metrics = {
      views:     parseMetricInput('m-views'),
      likes:     parseMetricInput('m-likes'),
      comments:  parseMetricInput('m-comments'),
      shares:    parseMetricInput('m-shares'),
      saves:     parseMetricInput('m-saves'),
      retention: parseMetricInput('m-retention'),
      notes:     ($('m-notes')?.value || '').trim(),
    };
    saveMetrics(script.id, metrics);
    const orig = this.textContent;
    this.textContent = 'Saved!';
    setTimeout(() => { this.textContent = orig; }, 1500);
    renderLibrary(); // refresh card badges
  });

  $('delete-metrics-btn')?.addEventListener('click', function () {
    if (!script.id) return;
    deleteMetrics(script.id);
    renderLibrary();
    closeModal();
  });

  $('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// ── Metrics display helper ────────────────────────────────────────────────────
function renderMetricsDisplay(m, platform) {
  const views     = Number(m.views) || 0;
  const likes     = Number(m.likes) || 0;
  const comments  = Number(m.comments) || 0;
  const shares    = Number(m.shares) || 0;
  const saves     = Number(m.saves) || 0;
  const retention = Number(m.retention) || 0;

  const engagements = likes + comments + shares + saves;
  const er = views > 0 ? ((engagements / views) * 100).toFixed(1) : null;

  // Platform benchmarks
  const retentionBench = platform === 'instagram' ? 50 : 45;
  const erBench        = platform === 'instagram' ? 2  : 3;

  function perf(val, good, unit = '') {
    if (!val) return '';
    const cls = val >= good ? 'metric-good' : val >= good * 0.6 ? 'metric-ok' : 'metric-low';
    return `<span class="${cls}">${val}${unit}</span>`;
  }

  return `
    <div class="metrics-display">
      <div class="metrics-display-title">Performance</div>
      <div class="metrics-stats-grid">
        ${views    ? `<div class="metric-stat"><div class="metric-stat-val">${formatViews(views)}</div><div class="metric-stat-label">Views</div></div>` : ''}
        ${likes    ? `<div class="metric-stat"><div class="metric-stat-val">${formatViews(likes)}</div><div class="metric-stat-label">Likes</div></div>` : ''}
        ${comments ? `<div class="metric-stat"><div class="metric-stat-val">${formatViews(comments)}</div><div class="metric-stat-label">Comments</div></div>` : ''}
        ${shares   ? `<div class="metric-stat"><div class="metric-stat-val">${formatViews(shares)}</div><div class="metric-stat-label">Shares</div></div>` : ''}
        ${saves    ? `<div class="metric-stat"><div class="metric-stat-val">${formatViews(saves)}</div><div class="metric-stat-label">Saves</div></div>` : ''}
        ${er       ? `<div class="metric-stat"><div class="metric-stat-val">${perf(parseFloat(er), erBench, '%')}</div><div class="metric-stat-label">Eng. Rate</div></div>` : ''}
        ${retention ? `<div class="metric-stat"><div class="metric-stat-val">${perf(retention, retentionBench, '%')}</div><div class="metric-stat-label">Retention</div></div>` : ''}
      </div>
      ${m.notes ? `<div class="metrics-notes">${esc(m.notes)}</div>` : ''}
    </div>
  `;
}

function parseMetricInput(id) {
  const el = $(id);
  if (!el || el.value === '') return null;
  const n = Number(el.value);
  return isNaN(n) ? null : n;
}

function closeModal() {
  $('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function bindSettings() {
  const keyInput  = $('settings-api-key');
  const toggleBtn = $('settings-toggle-key');
  const saveBtn   = $('save-key-btn');

  toggleBtn.addEventListener('click', () => togglePasswordField(keyInput, toggleBtn));

  saveBtn.addEventListener('click', () => {
    const key = keyInput.value.trim();
    if (!key) { flash(saveBtn, 'Enter an API key'); return; }
    saveSettings({ apiKey: key });
    const msg = $('key-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
    hide('setup-screen');
    show('app-main');
  });

  $('clear-data-btn').addEventListener('click', () => {
    if (!confirm('Delete ALL clients and scripts? This cannot be undone.')) return;
    clearAllData();
    renderClients();
    renderLibrary();
    renderGenerateClientGrid();
    alert('All data cleared.');
  });
}

function renderSettings() {
  const key = getApiKey();
  $('settings-api-key').value = key ? key : '';
}

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────
function bindPortal() {
  $('open-portal-btn').addEventListener('click', openPortalLogin);
  $('portal-close-btn').addEventListener('click', closePortalLogin);
  $('portal-overlay').addEventListener('click', e => {
    if (e.target === $('portal-overlay')) closePortalLogin();
  });
  $('portal-login-btn').addEventListener('click', attemptPortalLogin);
  $('portal-pin-input').addEventListener('keydown', e => { if (e.key === 'Enter') attemptPortalLogin(); });
  $('client-logout-btn').addEventListener('click', exitClientMode);

  $('portal-client-select').addEventListener('change', function () {
    const personaId = this.value;
    const p = personaId ? getPersona(personaId) : null;
    const pinGroup = $('portal-pin-group');
    if (p && p.clientPin) {
      pinGroup.style.display = '';
      $('portal-pin-input').value = '';
      $('portal-pin-input').focus();
    } else {
      pinGroup.style.display = 'none';
    }
    hide('portal-error');
  });
}

function openPortalLogin() {
  const personas = loadPersonas().filter(p => p.clientPin);
  const sel = $('portal-client-select');
  sel.innerHTML = '<option value="">— Select a client —</option>' +
    personas.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('portal-pin-group').style.display = 'none';
  $('portal-pin-input').value = '';
  hide('portal-error');
  show('portal-overlay');

  if (personas.length === 0) {
    $('portal-login-btn').disabled = true;
    $('portal-login-btn').title = 'No clients have a portal PIN set';
  } else {
    $('portal-login-btn').disabled = false;
    $('portal-login-btn').title = '';
  }
}

function closePortalLogin() {
  hide('portal-overlay');
}

function attemptPortalLogin() {
  const personaId = $('portal-client-select').value;
  if (!personaId) {
    flash($('portal-login-btn'), 'Select a client first');
    return;
  }
  const p = getPersona(personaId);
  if (!p) return;

  if (p.clientPin) {
    const entered = $('portal-pin-input').value;
    if (entered !== p.clientPin) {
      show('portal-error');
      $('portal-pin-input').value = '';
      $('portal-pin-input').focus();
      return;
    }
  }

  closePortalLogin();
  enterClientMode(personaId);
}

function enterClientMode(personaId) {
  clientMode   = true;
  clientModeId = personaId;

  const p = getPersona(personaId);

  // Show banner, hide agency nav items
  $('client-mode-name').textContent = p?.name || 'Client';
  show('client-mode-banner');

  // Hide agency-only nav buttons
  document.querySelectorAll('.nav-btn:not(.nav-settings)').forEach(btn => {
    if (btn.dataset.view !== 'library') btn.classList.add('hidden');
  });
  $('open-portal-btn').classList.add('hidden');

  // Force library view, filtered to this client
  libFilters.personaId = personaId;
  switchView('library');
}

function exitClientMode() {
  clientMode   = false;
  clientModeId = null;

  hide('client-mode-banner');

  // Restore nav
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('hidden'));
  $('open-portal-btn').classList.remove('hidden');

  // Reset persona filter
  libFilters.personaId = 'all';
  switchView('clients');
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

function show(id) {
  const el = $(id);
  if (el) el.classList.remove('hidden');
}

function hide(id) {
  const el = $(id);
  if (el) el.classList.add('hidden');
}

function setVisible(id, visible) {
  visible ? show(id) : hide(id);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0].toUpperCase()).slice(0, 2).join('');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

function copyModalBtn(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function togglePasswordField(input, btn) {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.textContent = isPassword ? 'Hide' : 'Show';
}

function highlightError(fieldId, msg) {
  const el = $(fieldId);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 2000);
  // Brief tooltip via title
  const prev = el.placeholder;
  el.placeholder = msg;
  setTimeout(() => { el.placeholder = prev; }, 2000);
}

function flash(btn, msg) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.style.opacity = '0.7';
  setTimeout(() => { btn.textContent = orig; btn.style.opacity = ''; }, 2000);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}
