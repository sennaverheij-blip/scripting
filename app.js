// State
let activeFilters = { platform: "all", type: "all" };
let searchQuery = "";

// Init
document.addEventListener("DOMContentLoaded", () => {
  renderStats();
  renderMixBar();
  renderScripts();
  bindFilters();
  bindSearch();
  bindResearchToggle();
  bindModal();
});

// Stats
function renderStats() {
  const tiktokCount = SCRIPTS.filter(s => s.platform === "tiktok").length;
  const igCount = SCRIPTS.filter(s => s.platform === "instagram").length;
  const sellCount = SCRIPTS.filter(s => s.type === "Soft Sell").length;
  const valueCount = SCRIPTS.length - sellCount;

  document.getElementById("stats").innerHTML = `
    <span class="stat-item"><span class="stat-dot" style="background:var(--tiktok)"></span>${tiktokCount} TikTok</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--instagram)"></span>${igCount} Reels</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--value)"></span>${valueCount} Value</span>
    <span class="stat-item"><span class="stat-dot" style="background:var(--soft-sell)"></span>${sellCount} Soft Sell</span>
  `;
}

// Mix Bar
function renderMixBar() {
  const types = {};
  SCRIPTS.forEach(s => {
    const key = s.type;
    types[key] = (types[key] || 0) + 1;
  });

  const el = document.getElementById("mixBar");
  el.innerHTML = Object.entries(types).map(([type, count]) => {
    const cls = type.toLowerCase().replace(" ", "-");
    return `<span class="mix-tag ${cls}">${count}x ${type}</span>`;
  }).join("");
}

// Render script cards
function renderScripts() {
  const filtered = SCRIPTS.filter(s => {
    const matchPlatform = activeFilters.platform === "all" || s.platform === activeFilters.platform;
    const matchType = activeFilters.type === "all" || s.type.toLowerCase() === activeFilters.type;
    const matchSearch = !searchQuery ||
      s.script.toLowerCase().includes(searchQuery) ||
      s.hookA.toLowerCase().includes(searchQuery) ||
      s.hookB.toLowerCase().includes(searchQuery) ||
      s.topic.toLowerCase().includes(searchQuery) ||
      s.format.toLowerCase().includes(searchQuery);
    return matchPlatform && matchType && matchSearch;
  });

  const grid = document.getElementById("scriptsGrid");
  const empty = document.getElementById("emptyState");

  if (filtered.length === 0) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = filtered.map(s => {
    const platformCls = s.platform;
    const typeCls = s.type.toLowerCase().replace(" ", "-");
    const wordCount = s.script.split(/\s+/).length;
    const duration = Math.round(wordCount / 2.5);
    const preview = s.script.substring(0, 150) + "...";

    return `
      <div class="script-card" data-id="${s.number}">
        <div class="card-header">
          <span class="card-number">${String(s.number).padStart(2, "0")}</span>
          <div class="card-badges">
            <span class="platform-badge ${platformCls}">${s.platform === "tiktok" ? "TikTok" : "IG Reel"}</span>
            <span class="type-badge ${typeCls}">${s.type}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="card-topic">${s.topic}</div>
          <div class="card-format">${s.format}</div>
          <div class="card-hook">"${s.hookA}"</div>
          <div class="card-preview">${preview}</div>
        </div>
        <div class="card-footer">
          <span class="word-count">${wordCount} words &middot; ~${duration}s</span>
          <div class="card-actions">
            <button class="action-btn copy-hook-btn" data-hook="${escapeAttr(s.hookA)}" onclick="event.stopPropagation()">Copy Hook</button>
            <button class="action-btn copy-script-btn" data-script="${escapeAttr(s.script)}" onclick="event.stopPropagation()">Copy Script</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Bind card clicks
  grid.querySelectorAll(".script-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = parseInt(card.dataset.id);
      openModal(SCRIPTS.find(s => s.number === id));
    });
  });

  // Bind copy buttons
  grid.querySelectorAll(".copy-hook-btn").forEach(btn => {
    btn.addEventListener("click", () => copyText(btn, btn.dataset.hook));
  });

  grid.querySelectorAll(".copy-script-btn").forEach(btn => {
    btn.addEventListener("click", () => copyText(btn, btn.dataset.script));
  });
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Copy to clipboard
function copyText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
    }, 1500);
  });
}

// Filters
function bindFilters() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      const filter = btn.dataset.filter;

      // Update active state in group
      document.querySelectorAll(`.filter-btn[data-group="${group}"]`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      activeFilters[group] = filter;
      renderScripts();
    });
  });
}

// Search
function bindSearch() {
  const input = document.getElementById("searchInput");
  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = input.value.toLowerCase().trim();
      renderScripts();
    }, 200);
  });
}

// Research toggle
function bindResearchToggle() {
  const toggle = document.getElementById("researchToggle");
  const content = document.getElementById("researchContent");
  const icon = toggle.querySelector(".research-toggle-icon");

  toggle.addEventListener("click", () => {
    content.classList.toggle("open");
    icon.classList.toggle("open");
  });
}

// Modal
function bindModal() {
  const overlay = document.getElementById("modalOverlay");
  const closeBtn = document.getElementById("modalClose");

  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(script) {
  const overlay = document.getElementById("modalOverlay");
  const body = document.getElementById("modalBody");
  const platformCls = script.platform;
  const typeCls = script.type.toLowerCase().replace(" ", "-");
  const wordCount = script.script.split(/\s+/).length;
  const duration = Math.round(wordCount / 2.5);

  body.innerHTML = `
    <div class="modal-meta">
      <span class="platform-badge ${platformCls}">${script.platform === "tiktok" ? "TikTok" : "Instagram Reel"}</span>
      <span class="type-badge ${typeCls}">${script.type}</span>
      <span class="mix-tag" style="color:var(--text-muted);border-color:var(--border);background:var(--surface-2);">${wordCount} words &middot; ~${duration}s</span>
    </div>
    <div class="modal-topic">${script.topic}</div>
    <div class="modal-format">Format: ${script.format}</div>

    <div class="modal-section">
      <div class="modal-section-title">Hooks</div>
      <div class="hook-option">
        <div class="hook-label">Option A</div>
        ${script.hookA}
      </div>
      <div class="hook-option">
        <div class="hook-label">Option B</div>
        ${script.hookB}
      </div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Full Script</div>
      <div class="modal-script">${script.script}</div>
    </div>

    <div class="modal-section">
      <div class="modal-section-title">Calls to Action</div>
      <div class="cta-option">
        <div class="cta-label">CTA Option A</div>
        ${script.ctaA}
      </div>
      <div class="cta-option">
        <div class="cta-label">CTA Option B</div>
        ${script.ctaB}
      </div>
    </div>

    <div class="modal-actions">
      <button class="modal-btn primary" id="modalCopyAll">Copy Full Script</button>
      <button class="modal-btn" id="modalCopyHook">Copy Hook A</button>
      <button class="modal-btn" id="modalCopyCTA">Copy CTA A</button>
    </div>
  `;

  // Bind modal copy buttons
  document.getElementById("modalCopyAll").addEventListener("click", function() {
    const full = `${script.hookA}\n\n${script.script}\n\n${script.ctaA}`;
    copyModalBtn(this, full);
  });

  document.getElementById("modalCopyHook").addEventListener("click", function() {
    copyModalBtn(this, script.hookA);
  });

  document.getElementById("modalCopyCTA").addEventListener("click", function() {
    copyModalBtn(this, script.ctaA);
  });

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function copyModalBtn(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  document.body.style.overflow = "";
}
