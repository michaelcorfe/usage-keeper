function extractChatGPTUsage() {
  const data = { loggedIn: true, source: 'content-script', platform: 'chatgpt' };

  const bodyText = document.body.innerText || '';

  // ChatGPT shows message limits like "X messages left" or "X/Y messages"
  const leftMatch = bodyText.match(/(\d+)\s+messages?\s+left/i);
  const ofMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)\s+messages?/i);
  const limitMatch = bodyText.match(/(\d+)\s+(?:GPT-4|Plus)?\s*messages?\s+(?:remaining|left)/i);

  if (ofMatch) {
    const used = parseInt(ofMatch[1]);
    const total = parseInt(ofMatch[2]);
    data.messagesLeft = total - used;
    data.sessionPct = Math.round((used / total) * 100);
  } else if (leftMatch) {
    data.messagesLeft = parseInt(leftMatch[1]);
  } else if (limitMatch) {
    data.messagesLeft = parseInt(limitMatch[1]);
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

  // Reset time
  const resetMatch = bodyText.match(/resets?\s+(?:at|in)\s+([^\n.]+)/i);
  if (resetMatch) data.resetTime = resetMatch[1].trim().substring(0, 20);

  return data;
}

function send() {
  chrome.runtime.sendMessage({ type: 'USAGE_UPDATE', data: extractChatGPTUsage() });
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
