const PLATFORMS = {
  claude: {
    name: 'Claude',
    plan: 'Pro · $20/mo',
    iconBg: 'rgba(217,119,87,0.15)',
    iconColor: '#D97757',
    letter: 'C',
    url: 'https://claude.ai'
  },
  chatgpt: {
    name: 'ChatGPT',
    plan: 'Plus · $20/mo',
    iconBg: 'rgba(59,130,246,0.15)',
    iconColor: '#3b82f6',
    letter: 'G',
    url: 'https://chatgpt.com'
  },
  perplexity: {
    name: 'Perplexity',
    plan: 'Pro · $20/mo',
    iconBg: 'rgba(168,85,247,0.15)',
    iconColor: '#a855f7',
    letter: 'P',
    url: 'https://www.perplexity.ai'
  }
};

const UNCONNECTED = ['chatgpt', 'perplexity'];
const ACTIVE = ['claude'];

function isPeakHours() {
  const ptHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getHours();
  return ptHour >= 5 && ptHour < 11;
}

function barColor(pct) {
  if (pct === null) return 'rgba(255,255,255,0.06)';
  if (pct >= 90) return '#ef4444';
  if (pct >= 75) return '#f97316';
  if (pct >= 50) return '#f59e0b';
  return '#22c55e';
}

function badge(pct) {
  if (pct >= 90) return { cls: 'badge-danger', text: 'critical' };
  if (pct >= 75) return { cls: 'badge-orange', text: 'warning' };
  if (pct >= 50) return { cls: 'badge-warn', text: 'moderate' };
  return { cls: 'badge-ok', text: 'good' };
}

function timeUntil(val) {
  if (!val || val === 'daily') return '--';
  const d = new Date(val);
  if (isNaN(d)) return '--';
  const diff = d - Date.now();
  if (diff <= 0) return 'soon';
  const days = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function sinceSync(ts) {
  if (!ts) return 'not synced';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `synced ${s}s ago`;
  if (s < 3600) return `synced ${Math.floor(s / 60)}m ago`;
  return `synced ${Math.floor(s / 3600)}h ago`;
}

function renderClaudeCard(data) {
  const sp = data?.sessionPct ?? null;
  const wp = data?.weeklyPct ?? null;
  const pct = sp ?? wp ?? 0;
  const color = barColor(pct);
  const b = badge(pct);
  const sessionReset = timeUntil(data?.resetTime);
  const weeklyReset = timeUntil(data?.weeklyResetTime);

  return `
    <div class="card">
      <div class="card-top">
        <div class="platform-left">
          <div class="p-icon" style="background:${PLATFORMS.claude.iconBg};color:${PLATFORMS.claude.iconColor}">C</div>
          <div>
            <div class="p-name">Claude</div>
            <div class="p-plan">${data?.plan ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1) : 'Pro'}</div>
          </div>
        </div>
        <div class="pct-display">
          <div class="pct-num" style="color:${color}">${pct}%</div>
          <div class="pct-reset">resets ${sessionReset !== '--' ? 'in ' + sessionReset : '--'}</div>
        </div>
      </div>
      <div class="bar-wrap">
        <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="meta-row">
        <span class="meta-label">5-hour session</span>
        <span class="badge ${b.cls}">${b.text}</span>
      </div>
      <div class="chips">
        <div class="chip">
          <div class="chip-label">Session</div>
          <div class="chip-val">${sp !== null ? sp + '%' : '--'}</div>
        </div>
        <div class="chip">
          <div class="chip-label">Weekly</div>
          <div class="chip-val">${wp !== null ? wp + '%' : '--'}</div>
        </div>
        <div class="chip">
          <div class="chip-label">Resets</div>
          <div class="chip-val">${sessionReset}</div>
        </div>
      </div>
      ${weeklyReset !== '--' ? `<div class="weekly-reset">Weekly resets in ${weeklyReset}</div>` : ''}
    </div>`;
}

function renderConnectButton() {
  return `
    <div class="connect-wrap">
      <button class="btn-connect" id="connectBtn">
        <span class="plus-icon">+</span>
        Connect another platform
      </button>
    </div>
    <div class="drawer" id="drawer">
      <div class="drawer-title">Available platforms</div>
      ${UNCONNECTED.map(key => {
        const p = PLATFORMS[key];
        return `
          <a class="drawer-item" href="${p.url}" target="_blank">
            <div class="d-icon" style="background:${p.iconBg};color:${p.iconColor}">${p.letter}</div>
            <span>${p.name}</span>
            <span class="d-arrow">↗</span>
          </a>`;
      }).join('')}
    </div>`;
}

function renderAll(data) {
  const claudeData = data?.claude;
  const loggedIn = claudeData && !claudeData.error && claudeData.loggedIn;

  let html = '<div class="cards">';

  if (loggedIn) {
    html += renderClaudeCard(claudeData);
  } else {
    html += `
      <div class="empty">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="28" height="28" rx="8" fill="rgba(52,199,138,0.12)"/>
            <path d="M14 7C10.134 7 7 10.134 7 14C7 17.866 10.134 21 14 21C17.866 21 21 17.866 21 14C21 10.134 17.866 7 14 7ZM14 9C16.761 9 19 11.239 19 14C19 16.761 16.761 19 14 19C11.239 19 9 16.761 9 14C9 11.239 11.239 9 14 9Z" fill="#34c78a" opacity="0.4"/>
            <path d="M13 11H15V15H13V11ZM13 16H15V18H13V16Z" fill="#34c78a"/>
          </svg>
        </div>
        <p class="empty-title">Not connected</p>
        <p class="empty-text">Log into Claude in your browser<br>and your usage will appear here automatically.</p>
        <a class="empty-btn" href="https://claude.ai" target="_blank">Open Claude ↗</a>
      </div>`;
  }

  html += '</div>';

  document.getElementById('content').innerHTML = html;

  // Footer
  document.getElementById('lastSync').textContent = sinceSync(data?.lastUpdated);
  document.getElementById('peakTag').style.display = isPeakHours() ? 'inline-flex' : 'none';

  // Pulse
  const age = Date.now() - (data?.lastUpdated || 0);
  const stale = age > 15 * 60 * 1000;
  document.getElementById('pulse').className = 'pulse ' + (stale ? 'stale' : 'live');
  document.getElementById('pulseLabel').textContent = stale ? 'stale' : 'live';
}

// Init
chrome.runtime.sendMessage({ type: 'GET_DATA' }, renderAll);

// Refresh
document.getElementById('refreshBtn').addEventListener('click', function () {
  this.disabled = true;
  this.textContent = 'Syncing...';
  chrome.runtime.sendMessage({ type: 'REFRESH' }, () => {
    chrome.runtime.sendMessage({ type: 'GET_DATA' }, (data) => {
      renderAll(data);
      this.disabled = false;
      this.textContent = 'Refresh';
    });
  });
});
