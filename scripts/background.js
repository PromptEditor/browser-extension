// Background script for managing communication between web app and content scripts

let connectedTabs = new Map();
let tabStatuses = new Map(); // Track status of each tab

// Listen for messages from the web app
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (request.action === 'injectPrompt') {
      injectPromptToAllTabs(request.prompt, request.targets, request.autoSend)
        .then(results => sendResponse({ success: true, results }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep the message channel open for async response
    }

    if (request.action === 'checkConnection') {
      checkLLMTabs()
        .then(tabs => sendResponse({ success: true, tabs }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (request.action === 'collectResponses') {
      collectResponsesFromTabs(request.targets)
        .then(responses => sendResponse({ success: true, responses }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }

    if (request.action === 'getStatuses') {
      getTabStatuses(request.targets)
        .then(statuses => sendResponse({ success: true, statuses }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  }
);

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'tabReady') {
    connectedTabs.set(sender.tab.id, {
      url: sender.tab.url,
      platform: request.platform,
      status: 'ready'
    });
    sendResponse({ success: true });
  }

  if (request.action === 'injectionComplete') {
    console.log(`Injection complete for tab ${sender.tab.id}:`, request);
  }

  if (request.action === 'statusUpdate') {
    // Store the status update from content script
    tabStatuses.set(sender.tab.id, {
      tabId: sender.tab.id,
      platform: request.platform,
      status: request.status,
      message: request.message,
      timestamp: request.timestamp
    });
    console.log(`Status update from tab ${sender.tab.id}:`, request);
    sendResponse({ success: true });
  }
});

async function checkLLMTabs() {
  const tabs = await chrome.tabs.query({});
  const llmTabs = [];
  
  for (const tab of tabs) {
    const platform = detectPlatform(tab.url);
    if (platform) {
      try {
        // Check if content script is loaded
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        llmTabs.push({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          platform: platform,
          status: response ? 'ready' : 'not-ready'
        });
      } catch (error) {
        // Content script not loaded, inject it
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['scripts/content.js']
          });
          llmTabs.push({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            platform: platform,
            status: 'ready'
          });
        } catch (injectError) {
          llmTabs.push({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            platform: platform,
            status: 'error',
            error: injectError.message
          });
        }
      }
    }
  }
  
  return llmTabs;
}

async function injectPromptToAllTabs(prompt, targets = ['all'], autoSend = true) {
  const tabs = await checkLLMTabs();
  const results = [];

  for (const tab of tabs) {
    if (tab.status !== 'ready') continue;

    if (targets.includes('all') || targets.includes(tab.platform)) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'injectPrompt',
          prompt: prompt,
          autoSend: autoSend
        });
        
        results.push({
          tabId: tab.id,
          platform: tab.platform,
          success: response.success,
          error: response.error
        });
      } catch (error) {
        results.push({
          tabId: tab.id,
          platform: tab.platform,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  return results;
}

async function collectResponsesFromTabs(targets = ['all']) {
  const tabs = await checkLLMTabs();
  const responses = [];
  
  for (const tab of tabs) {
    if (tab.status !== 'ready') continue;
    
    if (targets.includes('all') || targets.includes(tab.platform)) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'getResponse'
        });
        
        if (response.success) {
          responses.push({
            tabId: tab.id,
            platform: tab.platform,
            title: tab.title,
            response: response.response,
            success: true
          });
        } else {
          responses.push({
            tabId: tab.id,
            platform: tab.platform,
            title: tab.title,
            success: false,
            error: response.error
          });
        }
      } catch (error) {
        responses.push({
          tabId: tab.id,
          platform: tab.platform,
          title: tab.title,
          success: false,
          error: error.message
        });
      }
    }
  }
  
  return responses;
}

function detectPlatform(url) {
  if (!url) return null;

  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    return 'chatgpt';
  } else if (url.includes('claude.ai')) {
    return 'claude';
  } else if (url.includes('x.com/i/grok') || url.includes('twitter.com/i/grok') || url.includes('grok.com')) {
    return 'grok';
  } else if (url.includes('gemini.google.com')) {
    return 'gemini';
  } else if (url.includes('chat.deepseek.com')) {
    return 'deepseek';
  }

  return null;
}

async function getTabStatuses(targets = ['all']) {
  const tabs = await checkLLMTabs();
  const statuses = [];

  for (const tab of tabs) {
    if (tab.status !== 'ready') continue;

    if (targets.includes('all') || targets.includes(tab.platform)) {
      // Get stored status or query the tab directly
      const storedStatus = tabStatuses.get(tab.id);

      if (storedStatus) {
        statuses.push(storedStatus);
      } else {
        try {
          const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'getStatus'
          });

          if (response.success) {
            statuses.push({
              tabId: tab.id,
              platform: tab.platform,
              status: response.status,
              message: '',
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          statuses.push({
            tabId: tab.id,
            platform: tab.platform,
            status: 'unknown',
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    }
  }

  return statuses;
}