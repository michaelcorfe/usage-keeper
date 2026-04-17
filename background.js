const THRESHOLD = 75; // notify at this percentage

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ usageData: {}, notified: {} });
  chrome.alarms.create('refreshUsage', { periodInMinutes: 5 });
  fetchAllUsage();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshUsage') fetchAllUsage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_DATA') {
    chrome.storage.local.get(['usageData'], (result) => {
      sendResponse(result.usageData || null);
    });
    return true;
  }
  if (message.type === 'REFRESH') {
    fetchAllUsage().then((data) => sendResponse({ success: true, data }));
    return true;
  }
});

async function fetchAllUsage() {
  const [claude, chatgpt, perplexity] = await Promise.allSettled([
    fetchClaudeUsage(),
    fetchChatGPTUsage(),
    fetchPerplexityUsage()
  ]);

  const usageData = {
    lastUpdated: Date.now(),
    claude:      claude.status      === 'fulfilled' ? claude.value      : { error: true, loggedIn: false },
    chatgpt:     chatgpt.status     === 'fulfilled' ? chatgpt.value     : { error: true, loggedIn: false },
    perplexity:  perplexity.status  === 'fulfilled' ? perplexity.value  : { error: true, loggedIn: false }
  };

  chrome.storage.local.set({ usageData });
  checkThresholds(usageData);
  return usageData;
}

// Fire a notification when a platform crosses 80%, but only once per session window
// Resets the notified flag when usage drops back below threshold (i.e. session reset)
function checkThresholds(usageData) {
  chrome.storage.local.get(['notified'], (result) => {
    const notified = result.notified || {};
    const updates  = {};
    let changed    = false;

    const checks = [
      { key: 'claude_session', name: 'Claude',     pct: usageData.claude?.sessionPct,    detail: 'session limit' },
      { key: 'claude_weekly',  name: 'Claude',     pct: usageData.claude?.weeklyPct,     detail: 'weekly limit'  },
      { key: 'chatgpt',        name: 'ChatGPT',    pct: usageData.chatgpt?.sessionPct,   detail: 'message limit' },
      { key: 'perplexity',     name: 'Perplexity', pct: usageData.perplexity?.sessionPct,detail: 'daily searches'}
    ];

    for (const { key, name, pct, detail } of checks) {
      if (pct === null) continue;

      if (pct >= THRESHOLD && !notified[key]) {
        // Cross threshold -- fire notification
        chrome.notifications.create(`threshold_${key}`, {
          type:    'basic',
          iconUrl: 'icons/icon128.png',
          title:   `${name} at ${pct}%`,
          message: `You've used ${pct}% of your ${detail}. Running low.`,
          priority: 2
        });
        updates[key] = true;
        changed = true;
      } else if (pct < THRESHOLD && notified[key]) {
        // Usage reset -- clear the flag so we can notify again next time
        updates[key] = false;
        changed = true;
      }
    }

    if (changed) {
      chrome.storage.local.set({ notified: { ...notified, ...updates } });
    }
  });
}

async function fetchClaudeUsage() {
  // Step 1: get org ID
  const orgsRes = await fetch('https://claude.ai/api/organizations', {
    credentials: 'include',
    headers: { 'anthropic-client-platform': 'web_claude_ai' }
  });

  if (!orgsRes.ok) return { loggedIn: false };
  const orgs = await orgsRes.json();
  const orgId = orgs?.[0]?.uuid;
  if (!orgId) return { loggedIn: false };

  // Step 2: hit the usage endpoint directly
  const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
    credentials: 'include',
    headers: { 'anthropic-client-platform': 'web_claude_ai' }
  });

  if (!usageRes.ok) return { loggedIn: false };
  const data = await usageRes.json();

  const sessionPct = data?.five_hour?.utilization ?? null;
  const weeklyPct = data?.seven_day?.utilization ?? null;
  const sessionReset = data?.five_hour?.resets_at ?? null;
  const weeklyReset = data?.seven_day?.resets_at ?? null;

  return {
    loggedIn: true,
    sessionPct: sessionPct !== null ? Math.round(sessionPct) : null,
    weeklyPct: weeklyPct !== null ? Math.round(weeklyPct) : null,
    resetTime: sessionReset,
    weeklyResetTime: weeklyReset,
    plan: orgs?.[0]?.plan_type ?? 'Pro',
    source: 'api'
  };
}

async function fetchChatGPTUsage() {
  // Check if logged in
  const res = await fetch('https://chatgpt.com/backend-api/me', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) return { loggedIn: false };

  // Try usage endpoint
  const usageRes = await fetch('https://chatgpt.com/backend-api/usage', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (usageRes.ok) {
    const data = await usageRes.json();
    const used = data?.gpt4?.used ?? null;
    const total = data?.gpt4?.total ?? null;
    return {
      loggedIn: true,
      sessionPct: used !== null && total ? Math.round((used / total) * 100) : null,
      messagesLeft: used !== null && total ? total - used : null,
      resetTime: data?.reset_at ?? null,
      plan: 'Plus',
      source: 'api'
    };
  }

  return { loggedIn: true, sessionPct: null, messagesLeft: null, plan: 'Plus', source: 'unknown', needsTabAccess: true };
}

async function fetchPerplexityUsage() {
  const res = await fetch('https://www.perplexity.ai/api/auth/session', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) return { loggedIn: false };
  const session = await res.json();
  if (!session?.user) return { loggedIn: false };

  const settingsRes = await fetch('https://www.perplexity.ai/rest/user/settings', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });

  if (settingsRes.ok) {
    const data = await settingsRes.json();
    const used = data?.pro_queries_used ?? null;
    const total = data?.pro_queries_limit ?? 50;
    return {
      loggedIn: true,
      sessionPct: used !== null ? Math.round((used / total) * 100) : null,
      searchesLeft: used !== null ? total - used : null,
      resetTime: 'daily',
      plan: 'Pro',
      source: 'api'
    };
  }

  return { loggedIn: true, sessionPct: null, searchesLeft: null, plan: 'Pro', source: 'unknown', needsTabAccess: true };
}
