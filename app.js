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

  const config = { platforms, days: genDays };
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
    saveScriptsForPersona(persona.id, scripts, weekLabel);

    hide('gen-progress');
    const days  = [...new Set(scripts.map(s => s.day))].length;
    $('gen-success-msg').textContent =
      `${scripts.length} scripts generated — 3 per platform per day across ${days} days. Saved to library.`;
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
  grid.innerHTML = filtered.map((s, idx) => scriptCardHtml(s, idx, personas)).join('');
  bindCardEvents(grid, filtered);
}

function scriptCardHtml(s, idx, personas) {
  const platformCls = s.platform;
  const typeCls     = s.type.toLowerCase().replace(' ', '-');
  const wordCount   = s.script ? s.script.split(/\s+/).length : 0;
  // 3 words/sec = energetic TikTok pace → target 37-47 sec
  const duration    = Math.round(wordCount / 3);
  const preview     = s.script ? s.script.substring(0, 150) + '...' : '';
  const personaName = personas.find(p => p.id === s.personaId)?.name || '';
  const dayLabel    = s.day ? `<span class="client-meta-tag" style="font-size:0.65rem">${s.day} · #${s.slot}</span>` : '';

  return `
    <div class="script-card" data-idx="${idx}">
      <div class="card-header">
        <span class="card-number">${String(s.number || idx + 1).padStart(2, '0')}</span>
        <div class="card-badges">
          ${dayLabel}
          ${personaName ? `<span class="client-meta-tag" style="font-size:0.65rem">${esc(personaName)}</span>` : ''}
          <span class="platform-badge ${platformCls}">${s.platform === 'tiktok' ? 'TikTok' : 'IG Reel'}</span>
          <span class="type-badge ${typeCls}">${s.type}</span>
        </div>
      </div>
      <div class="card-body">
        <div class="card-topic">${esc(s.topic || '')}</div>
        <div class="card-format">${esc(s.format || '')}</div>
        <div class="card-hook">"${esc(s.hookA || '')}"</div>
        <div class="card-preview">${esc(preview)}</div>
      </div>
      <div class="card-footer">
        <span class="word-count">${wordCount} words · ~${duration}s</span>
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
          html += `
            <div class="week-script-cell script-card" data-idx="${scriptIdx}">
              <div class="week-cell-type"><span class="type-badge ${typeCls}">${s.type}</span></div>
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
  const duration    = Math.round(wordCount / 3); // 3 words/sec energetic pace

  $('modalBody').innerHTML = `
    <div class="modal-meta">
      <span class="platform-badge ${platformCls}">
        ${script.platform === 'tiktok' ? 'TikTok' : 'Instagram Reel'}
      </span>
      <span class="type-badge ${typeCls}">${script.type}</span>
      <span class="mix-tag" style="color:var(--text-muted);border-color:var(--border);background:var(--surface-2)">
        ${wordCount} words · ~${duration}s
      </span>
    </div>
    <div class="modal-topic">${esc(script.topic || '')}</div>
    <div class="modal-format">Format: ${esc(script.format || '')}</div>

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
  `;

  $('modal-copy-all').addEventListener('click', function () {
    const full = `${script.hookA}\n\n${script.script}\n\n${script.ctaA}`;
    copyModalBtn(this, full);
  });
  $('modal-copy-hook').addEventListener('click', function () {
    copyModalBtn(this, script.hookA);
  });
  $('modal-copy-hookb').addEventListener('click', function () {
    copyModalBtn(this, script.hookB);
  });
  $('modal-copy-cta').addEventListener('click', function () {
    copyModalBtn(this, script.ctaA);
  });

  $('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
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
