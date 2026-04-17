function extractPerplexityUsage() {
  const data = { loggedIn: true, source: 'content-script', platform: 'perplexity' };

  const bodyText = document.body.innerText || '';

  // Perplexity shows "X Pro searches remaining today" or similar
  const remainMatch = bodyText.match(/(\d+)\s+(?:Pro\s+)?searches?\s+(?:remaining|left)/i);
  const ofMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)\s+(?:Pro\s+)?searches?/i);
  const usedMatch = bodyText.match(/(\d+)\s+(?:of\s+)?(\d+)\s+(?:Pro\s+)?searches?\s+used/i);

  if (ofMatch) {
    const used = parseInt(ofMatch[1]);
    const total = parseInt(ofMatch[2]);
    data.searchesLeft = total - used;
    data.sessionPct = Math.round((used / total) * 100);
  } else if (usedMatch) {
    const used = parseInt(usedMatch[1]);
    const total = parseInt(usedMatch[2]);
    data.searchesLeft = total - used;
    data.sessionPct = Math.round((used / total) * 100);
  } else if (remainMatch) {
    data.searchesLeft = parseInt(remainMatch[1]);
    // Perplexity default is 50/day on Pro
    data.sessionPct = Math.round(((50 - data.searchesLeft) / 50) * 100);
  }

  // Progress bars
  const bars = document.querySelectorAll('[role="progressbar"], [aria-valuenow]');
  bars.forEach(el => {
    const now = parseFloat(el.getAttribute('aria-valuenow'));
    const max = parseFloat(el.getAttribute('aria-valuemax') || 100);
    if (!isNaN(now) && data.sessionPct === undefined) {
      data.sessionPct = Math.round((now / max) * 100);
    }
  });

  data.resetTime = 'daily';

  return data;
}

function send() {
  chrome.runtime.sendMessage({ type: 'USAGE_UPDATE', data: extractPerplexityUsage() });
}

setTimeout(send, 2000);
setInterval(send, 60000);

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(send, 2000);
  }
}).observe(document, { subtree: true, childList: true });
