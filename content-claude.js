function extractClaudeUsage() {
  const data = { loggedIn: true, source: 'content-script', platform: 'claude' };

  const bodyText = document.body.innerText || '';

  // Progress bars with aria attributes
  const progressBars = document.querySelectorAll('[role="progressbar"], [aria-valuenow]');
  const percentages = [];
  progressBars.forEach(el => {
    const now = parseFloat(el.getAttribute('aria-valuenow'));
    const max = parseFloat(el.getAttribute('aria-valuemax') || 100);
    if (!isNaN(now)) percentages.push(Math.round((now / max) * 100));
  });

  if (percentages.length >= 2) {
    data.sessionPct = percentages[0];
    data.weeklyPct = percentages[1];
  } else if (percentages.length === 1) {
    data.sessionPct = percentages[0];
  }

  // Fallback: scan text for percentages
  if (data.sessionPct === undefined) {
    const pcts = [...bodyText.matchAll(/(\d{1,3})%/g)]
      .map(m => parseInt(m[1])).filter(n => n >= 0 && n <= 100);
    if (pcts.length >= 2) { data.sessionPct = pcts[0]; data.weeklyPct = pcts[1]; }
    else if (pcts.length === 1) { data.sessionPct = pcts[0]; }
  }

  // Reset time
  const resetMatch = bodyText.match(/resets?\s+in\s+([0-9]+h?\s*[0-9]*m?)/i);
  if (resetMatch) data.resetTime = resetMatch[1].trim();

  // Try __NEXT_DATA__
  try {
    const nd = document.getElementById('__NEXT_DATA__');
    if (nd) {
      const json = JSON.parse(nd.textContent);
      const pp = json?.props?.pageProps;
      if (pp?.sessionUsage !== undefined) data.sessionPct = Math.round(pp.sessionUsage * 100);
      if (pp?.weeklyUsage !== undefined) data.weeklyPct = Math.round(pp.weeklyUsage * 100);
    }
  } catch(e) {}

  return data;
}

function send() {
  chrome.runtime.sendMessage({ type: 'USAGE_UPDATE', data: extractClaudeUsage() });
}

// Fire on load, then every 60s
setTimeout(send, 2000);
setInterval(send, 60000);

// Fire on SPA navigation
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(send, 2000);
  }
}).observe(document, { subtree: true, childList: true });
