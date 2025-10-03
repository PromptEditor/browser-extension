// Content script for injecting prompts into LLM interfaces

const platform = detectCurrentPlatform();
let responseObserver = null;
let lastResponse = '';
let currentStatus = 'idle'; // idle, submitting, processing, ready, error
let statusCheckInterval = null;

// Notify background script that this tab is ready
chrome.runtime.sendMessage({ action: 'tabReady', platform: platform });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ success: true, platform: platform });
    return true;
  }
  
  if (request.action === 'getResponse') {
    captureResponse()
      .then(response => {
        sendResponse({ success: true, response: response, platform: platform });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'injectPrompt') {
    injectPrompt(request.prompt, request.autoSend)
      .then(() => {
        sendResponse({ success: true });
        chrome.runtime.sendMessage({
          action: 'injectionComplete',
          platform: platform,
          success: true
        });
        // Start monitoring for response
        if (request.autoSend) {
          startResponseMonitoring();
        }
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
        chrome.runtime.sendMessage({
          action: 'injectionComplete',
          platform: platform,
          success: false,
          error: error.message
        });
        updateStatus('error', error.message);
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'getStatus') {
    sendResponse({
      success: true,
      status: currentStatus,
      platform: platform
    });
    return true;
  }
});

function detectCurrentPlatform() {
  const url = window.location.href;

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

  return 'unknown';
}

async function injectPrompt(prompt, autoSend = true) {
  switch (platform) {
    case 'chatgpt':
      return injectChatGPT(prompt, autoSend);
    case 'claude':
      return injectClaude(prompt, autoSend);
    case 'grok':
      return injectGrok(prompt, autoSend);
    case 'gemini':
      return injectGemini(prompt, autoSend);
    case 'deepseek':
      return injectDeepSeek(prompt, autoSend);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function injectChatGPT(prompt, autoSend = true) {
  // Wait for the textarea to be available
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Try multiple possible selectors for ChatGPT (updated for latest UI)
    const selectors = [
      '#prompt-textarea',
      'textarea[data-id="prompt-textarea"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      'textarea[placeholder*="Type a message"]',
      'div[contenteditable="true"] p',
      'textarea.m-0',
      'textarea[rows="1"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found ChatGPT input element:', selector);
        
        // Handle both textarea and contenteditable
        const isTextarea = element.tagName === 'TEXTAREA';
        
        if (isTextarea) {
          // Focus the element
          element.focus();
          element.click();
          
          // Clear and set value using native setter
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeInputValueSetter.call(element, prompt);
          
          // Trigger React's onChange
          const inputEvent = new Event('input', { bubbles: true });
          element.dispatchEvent(inputEvent);
          
          // Also trigger these events for compatibility
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } else {
          // Handle contenteditable div
          element.focus();
          element.textContent = prompt;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Wait a bit for the UI to update
        await new Promise(resolve => setTimeout(resolve, 200));

        // Only click send if autoSend is true
        if (!autoSend) {
          console.log('Prompt inserted without sending (autoSend=false)');
          return;
        }

        // Find and click the send button - updated selectors
        const sendButtonSelectors = [
          'button[data-testid="send-button"]',
          'button[data-testid="fruitjuice-send-button"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="send"]',
          'form button[type="submit"]',
          'form button:last-child',
          'button.absolute.p-1.rounded-md',
          'button:has(svg[width="32"])',
          'button.text-white'
        ];
        
        for (const btnSelector of sendButtonSelectors) {
          try {
            const sendButton = document.querySelector(btnSelector);
            if (sendButton && !sendButton.disabled) {
              console.log('Found send button:', btnSelector);
              sendButton.click();
              return;
            }
          } catch (e) {
            // Selector might not be valid, continue
          }
        }
        
        console.log('Send button not found, prompt inserted but not sent');
        return;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  throw new Error('ChatGPT input element not found');
}

async function injectClaude(prompt, autoSend = true) {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Claude uses a contenteditable div
    const selectors = [
      'div[contenteditable="true"]',
      'div.ProseMirror',
      'div[aria-label*="Message"]',
      'div[data-placeholder]'
    ];
    
    for (const selector of selectors) {
      const editor = document.querySelector(selector);
      if (editor) {
        // Clear existing content
        editor.innerHTML = '';
        editor.focus();
        
        // Insert the prompt
        editor.textContent = prompt;
        
        // Trigger input event
        const inputEvent = new InputEvent('input', { 
          bubbles: true,
          cancelable: true,
          data: prompt
        });
        editor.dispatchEvent(inputEvent);
        
        // Wait a bit for UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Only click send if autoSend is true
        if (!autoSend) {
          console.log('Prompt inserted without sending (autoSend=false)');
          return;
        }

        // Find and click send button
        const sendButtonSelectors = [
          'button[aria-label*="Send"]',
          'button:has(svg path[d*="M4 12"])', // Send icon
          'button.bg-black',
          'button[type="submit"]'
        ];

        for (const btnSelector of sendButtonSelectors) {
          const sendButton = document.querySelector(btnSelector);
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
            return;
          }
        }

        console.log('Send button not found, prompt inserted but not sent');
        return;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  throw new Error('Claude editor not found');
}

async function injectGrok(prompt, autoSend = true) {
  const maxAttempts = 10;
  let attempts = 0;
  const isGrokDotCom = window.location.href.includes('grok.com');

  while (attempts < maxAttempts) {
    // Different selectors for grok.com vs X/Twitter
    const selectors = isGrokDotCom ? [
      'textarea[name="message"]',
      'textarea[placeholder*="Type your message"]',
      'textarea[placeholder*="Ask Grok"]',
      'textarea[placeholder*="Ask anything"]',
      'textarea.w-full',
      'div[contenteditable="true"]'
    ] : [
      'textarea[placeholder*="Ask anything"]',
      'textarea[placeholder*="Ask Grok"]',
      'textarea.r-1udh08x',
      'div[data-testid="grok-input"] textarea'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Handle both textarea and contenteditable
        const isTextarea = element.tagName === 'TEXTAREA';

        if (isTextarea) {
          element.value = '';
          element.focus();
          element.click();

          // Set value and trigger input events
          element.value = prompt;

          const inputEvent = new Event('input', { bubbles: true });
          element.dispatchEvent(inputEvent);

          const changeEvent = new Event('change', { bubbles: true });
          element.dispatchEvent(changeEvent);
        } else {
          // Handle contenteditable
          element.innerHTML = '';
          element.focus();
          element.textContent = prompt;

          const inputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            data: prompt
          });
          element.dispatchEvent(inputEvent);
        }

        // Wait for UI to update
        await new Promise(resolve => setTimeout(resolve, 200));

        // Only click send if autoSend is true
        if (!autoSend) {
          console.log('Prompt inserted without sending (autoSend=false)');
          return;
        }

        // Different send button selectors for grok.com vs X/Twitter
        const sendButtonSelectors = isGrokDotCom ? [
          'button[type="submit"]:not([aria-label*="Search"])',
          'button[aria-label="Send message"]',
          'button[aria-label="Send"]',
          'button.bg-blue-500',
          'button.bg-primary',
          // Look for button with send/arrow icon, but not search icon
          'button:has(svg path[d*="M2"]):not(:has(svg path[d*="M21"]))',
          'button:has(svg path[d*="m22"]):not(:has(svg circle))',
          // Last resort - find button near the textarea
          'form button[type="submit"]',
          'textarea[name="message"] ~ button'
        ] : [
          'button[aria-label*="Send"]',
          'div[data-testid="grok-send-button"]',
          'button svg path[d*="M2.01"]'
        ];

        for (const btnSelector of sendButtonSelectors) {
          try {
            const buttons = document.querySelectorAll(btnSelector);
            for (const button of buttons) {
              // Skip if it's a search button (has magnifying glass icon or search label)
              const buttonText = button.textContent || '';
              const ariaLabel = button.getAttribute('aria-label') || '';

              if (ariaLabel.toLowerCase().includes('search') ||
                  buttonText.toLowerCase().includes('search')) {
                continue;
              }

              // Check if button is visible and not disabled
              if (!button.disabled && button.offsetParent !== null) {
                console.log('Found send button with selector:', btnSelector);
                button.click();
                return;
              }
            }
          } catch (e) {
            // Selector might not be valid, continue
          }
        }

        // If no send button found, try pressing Enter (works on many chat interfaces)
        console.log('Send button not found, trying Enter key...');

        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        });

        if (isTextarea && element) {
          element.dispatchEvent(enterEvent);
        }

        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }

  throw new Error('Grok input element not found');
}

async function injectGemini(prompt, autoSend = true) {
  const maxAttempts = 10;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    // Gemini uses a rich text editor
    const selectors = [
      'div.ql-editor',
      'div[contenteditable="true"]',
      'div[aria-label*="Enter a prompt"]',
      '.input-area div[contenteditable]'
    ];
    
    for (const selector of selectors) {
      const editor = document.querySelector(selector);
      if (editor) {
        editor.innerHTML = '';
        editor.focus();
        
        // Create a paragraph element for Gemini's editor
        const p = document.createElement('p');
        p.textContent = prompt;
        editor.appendChild(p);
        
        const inputEvent = new InputEvent('input', { 
          bubbles: true,
          cancelable: true,
          data: prompt
        });
        editor.dispatchEvent(inputEvent);
        
        // Wait for UI update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Only click send if autoSend is true
        if (!autoSend) {
          console.log('Prompt inserted without sending (autoSend=false)');
          return;
        }

        // Find send button
        const sendButtonSelectors = [
          'button[aria-label*="Send"]',
          'button[aria-label*="Submit"]',
          'button.send-button',
          'button svg path[d*="M2 21"]' // Send icon
        ];
        
        for (const btnSelector of sendButtonSelectors) {
          const sendButton = document.querySelector(btnSelector);
          if (sendButton && !sendButton.disabled) {
            sendButton.click();
            return;
          }
        }
        
        console.log('Send button not found, prompt inserted but not sent');
        return;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  throw new Error('Gemini editor not found');
}

async function injectDeepSeek(prompt, autoSend = true) {
  const maxAttempts = 10;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // DeepSeek uses a textarea similar to ChatGPT
    const selectors = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Type"]',
      'textarea[placeholder*="Ask"]',
      'textarea#chat-input',
      'textarea.chat-input',
      'div[contenteditable="true"]',
      'textarea[rows="1"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('Found DeepSeek input element:', selector);

        const isTextarea = element.tagName === 'TEXTAREA';

        if (isTextarea) {
          element.focus();
          element.click();

          // Clear and set value
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeInputValueSetter.call(element, prompt);

          // Trigger events
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
          element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        } else {
          // Handle contenteditable
          element.focus();
          element.textContent = prompt;
          element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        if (!autoSend) {
          console.log('Prompt inserted without sending (autoSend=false)');
          return;
        }

        // Try Enter key press first (most reliable for chat interfaces)
        console.log('Attempting to send via Enter key...');
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));

        element.dispatchEvent(new KeyboardEvent('keypress', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));

        element.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));

        console.log('Enter key events dispatched');
        await new Promise(resolve => setTimeout(resolve, 100));

        // If Enter key didn't work, try finding the send button
        const sendButtonSelectors = [
          'button[type="submit"]',
          'button[aria-label*="Send"]',
          'button[aria-label*="send"]',
          'button[data-testid*="send"]',
          'button.send-button',
          'form button:last-child',
          'button:has(svg path)',
          'button svg path'
        ];

        // First try form-based approach
        const form = element.closest('form');
        if (form) {
          const buttons = form.querySelectorAll('button:not([disabled])');
          console.log('DeepSeek: Found buttons in form:', buttons.length);

          if (buttons.length > 0) {
            // Click the last non-disabled button (usually the send button)
            const lastButton = buttons[buttons.length - 1];
            console.log('DeepSeek: Clicking last button in form');
            lastButton.click();
            return;
          }
        }

        // Try selector-based approach
        for (const btnSelector of sendButtonSelectors) {
          try {
            const sendButton = document.querySelector(btnSelector);
            if (sendButton && !sendButton.disabled) {
              console.log('DeepSeek: Found send button with selector:', btnSelector);
              sendButton.click();
              return;
            }
          } catch (e) {
            // Continue
          }
        }

        // Try finding button with parent/sibling relationship to textarea
        const parent = element.parentElement;
        if (parent) {
          const siblingButtons = parent.querySelectorAll('button:not([disabled])');
          console.log('DeepSeek: Found sibling buttons:', siblingButtons.length);
          if (siblingButtons.length > 0) {
            const lastSibling = siblingButtons[siblingButtons.length - 1];
            console.log('DeepSeek: Clicking last sibling button');
            lastSibling.click();
            return;
          }
        }

        console.log('DeepSeek: Send button not found, but Enter key was attempted');
        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }

  throw new Error('DeepSeek input element not found');
}

// Response capture functions
async function captureResponse() {
  switch (platform) {
    case 'chatgpt':
      return captureChatGPTResponse();
    case 'claude':
      return captureClaudeResponse();
    case 'grok':
      return captureGrokResponse();
    case 'gemini':
      return captureGeminiResponse();
    case 'deepseek':
      return captureDeepSeekResponse();
    default:
      throw new Error(`Response capture not supported for platform: ${platform}`);
  }
}

async function captureChatGPTResponse() {
  // Look for the last assistant message
  const selectors = [
    'div[data-message-author-role="assistant"]',
    'div.group.w-full:has(div.empty\\:hidden)',
    'div.markdown.prose',
    'div[class*="assistant"]'
  ];
  
  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const text = lastMessage.innerText || lastMessage.textContent;
      if (text && text.trim()) {
        return text.trim();
      }
    }
  }
  
  throw new Error('No ChatGPT response found');
}

async function captureClaudeResponse() {
  let responseText = '';
  let hasMainResponse = false;
  let hasArtifacts = false;
  const DEBUG = true; // Enable debug logging

  // First, try to find the main conversation response
  const mainSelectors = [
    'div[data-is-streaming="false"]',
    'div.prose:not([class*="artifact"])',
    'div[class*="message-content"]:not([class*="artifact"])',
    'div.ProseMirror:not([class*="artifact"])',
    'div[class*="assistant"] div[class*="prose"]'
  ];

  for (const selector of mainSelectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      // Get the last assistant message (not user message)
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        // Skip if it's in an artifact container or user message
        if (msg.closest('[class*="artifact"]') ||
            msg.closest('[class*="user"]') ||
            msg.textContent?.includes('Type a message')) {
          continue;
        }

        const text = msg.innerText || msg.textContent;
        if (text && text.trim()) {
          responseText = text.trim();
          hasMainResponse = true;
          break;
        }
      }
      if (hasMainResponse) break;
    }
  }

  // Now look for artifacts (code blocks, documents, etc.)
  // Claude artifacts appear in a right-side panel
  const artifactSelectors = [
    // Right-side panel artifact content
    '[data-testid*="artifact"] pre code',
    '[data-testid*="artifact"] .prose',
    '[data-testid*="artifact-viewer"]',
    '[data-testid*="code-viewer"]',

    // Artifact iframe content (Claude may use iframes)
    'iframe[title*="artifact"] body',
    'iframe[class*="artifact"] body',

    // Right panel specific selectors
    '.fixed.right-0 pre code', // Fixed right panel with code
    '.fixed.right-0 .prose', // Fixed right panel with prose
    'aside pre code', // Aside elements with code
    'aside .prose', // Aside elements with prose

    // Artifact content containers
    'div[class*="artifact"] pre code', // Code in artifacts
    'div[class*="artifact"] div[class*="prose"]', // Text artifacts
    'div[class*="artifact-content"]',
    'div[data-artifact-type] pre',
    'div[data-artifact-type] code',

    // Monaco editor (if Claude uses it for code)
    '.monaco-editor .view-lines',
    '.monaco-editor .view-line',

    // Code mirror editor
    '.cm-content',
    '.cm-line',

    // More specific Claude patterns
    '[role="complementary"] pre code', // Complementary content area
    '[role="complementary"] .prose',
    'div[class*="side-panel"] pre code',
    'div[class*="side-panel"] .prose',
    'div[class*="secondary"] pre code',
    'div[class*="secondary"] .prose',

    // Generic artifact containers
    'div[class*="overflow-auto"] pre code',
    'div[class*="rounded"] pre code'
  ];

  let artifactText = '';

  // First check for iframes that might contain artifacts
  const iframes = document.querySelectorAll('iframe[title*="artifact"], iframe[class*="artifact"], iframe[src*="artifact"]');
  if (DEBUG) console.log('Found iframes:', iframes.length);
  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc) {
        const iframeContent = iframeDoc.body?.innerText || iframeDoc.body?.textContent;
        if (iframeContent && iframeContent.trim()) {
          if (artifactText) {
            artifactText += '\n\n---\n\n';
          }
          artifactText += '[Content from artifact iframe:]\n' + iframeContent.trim();
          hasArtifacts = true;
          if (DEBUG) console.log('Captured iframe content:', iframeContent.substring(0, 100));
        }
      }
    } catch (e) {
      // Cross-origin iframe, can't access
      if (DEBUG) console.log('Cannot access iframe content (cross-origin):', e);
    }
  }

  // Then check all other selectors
  for (const selector of artifactSelectors) {
    const artifacts = document.querySelectorAll(selector);
    for (const artifact of artifacts) {
      // Skip if this is part of the main message we already captured
      if (responseText.includes(artifact.textContent?.trim() || '')) {
        continue;
      }

      const text = artifact.innerText || artifact.textContent;
      if (text && text.trim()) {
        if (artifactText) {
          artifactText += '\n\n---\n\n'; // Separator between multiple artifacts
        }

        // Add artifact header if it's code
        if (artifact.tagName === 'CODE' || artifact.closest('pre')) {
          artifactText += '```\n' + text.trim() + '\n```';
        } else {
          artifactText += text.trim();
        }
        hasArtifacts = true;
      }
    }
  }

  // Try to capture right panel content more aggressively
  const rightPanels = document.querySelectorAll('.fixed.right-0, aside, [role="complementary"]');
  if (DEBUG) console.log('Found right panels:', rightPanels.length);
  for (const panel of rightPanels) {
    // Skip if we already captured this panel's content
    if (artifactText.includes(panel.textContent?.trim() || '')) {
      continue;
    }

    // Look for code or prose content in the panel
    const codeBlocks = panel.querySelectorAll('pre code, .monaco-editor, .cm-content');
    const proseBlocks = panel.querySelectorAll('.prose, [class*="prose"]');

    if (DEBUG && (codeBlocks.length > 0 || proseBlocks.length > 0)) {
      console.log('Found in right panel - code blocks:', codeBlocks.length, 'prose blocks:', proseBlocks.length);
    }

    for (const block of [...codeBlocks, ...proseBlocks]) {
      const text = block.innerText || block.textContent;
      if (text && text.trim() && text.trim().length > 50) { // Minimum length to avoid UI elements
        if (!artifactText.includes(text.trim())) {
          if (artifactText) {
            artifactText += '\n\n---\n\n';
          }
          if (block.tagName === 'CODE' || block.closest('pre')) {
            artifactText += '```\n' + text.trim() + '\n```';
          } else {
            artifactText += text.trim();
          }
          hasArtifacts = true;
          if (DEBUG) console.log('Captured right panel content:', text.substring(0, 100));
        }
      }
    }
  }

  // Also check for artifact preview/title information
  const artifactHeaders = document.querySelectorAll('[class*="artifact-header"], [class*="artifact-title"]');
  let artifactInfo = '';
  for (const header of artifactHeaders) {
    const text = header.innerText || header.textContent;
    if (text && text.trim()) {
      artifactInfo += `[Artifact: ${text.trim()}]\n`;
    }
  }

  // Combine all content
  let fullResponse = '';

  if (hasMainResponse) {
    fullResponse = responseText;
  }

  if (hasArtifacts) {
    if (fullResponse) {
      fullResponse += '\n\n' + (artifactInfo || '[Claude Artifact Content:]\n');
    } else {
      fullResponse = (artifactInfo || '[Claude Artifact Content:]\n');
    }
    fullResponse += artifactText;
  }

  if (!fullResponse) {
    throw new Error('No Claude response found');
  }

  return fullResponse;
}

// Helper function to extract full text content from an element, including all children
function extractFullText(element) {
  if (!element) return '';

  // Get all text nodes recursively
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style tags
        if (node.parentElement?.tagName === 'SCRIPT' ||
            node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip timing indicators
        if (node.parentElement?.tagName === 'TIME' ||
            node.parentElement?.className?.includes('duration') ||
            node.parentElement?.className?.includes('time')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let text = '';
  let node;
  while (node = walker.nextNode()) {
    text += node.textContent + ' ';
  }

  // Clean up the text
  text = text.replace(/\s+/g, ' ').trim();

  // Remove standalone timing indicators
  text = text.replace(/^\d+(\.\d+)?s\s+(Expert|Fun|Basic)?\s*/i, '');
  text = text.replace(/\s*\d+(\.\d+)?s\s+(Expert|Fun|Basic)?$/i, '');

  return text;
}

// Helper function to check if text is just timing/metadata
function isTimingOnly(text) {
  if (!text) return true;
  const cleaned = text.trim();
  // Check if it's just a timing indicator or very short metadata
  return cleaned.match(/^\d+(\.\d+)?s\s+(Expert|Fun|Basic)?$/i) ||
         cleaned.length < 10 ||
         cleaned === '== References ==' ||
         cleaned === 'References';
}

// Helper function to check if text is just Grok status/metadata
function isGrokStatusMessage(text) {
  if (!text) return true;

  // Check for common Grok status patterns
  const statusPatterns = [
    /^\d+\s*𝕏\s*posts?\s*\d*\s*web\s*pages?$/i,
    /^\d+\s*posts?\s*\d*\s*pages?$/i,
    /^searching\s*web/i,
    /^analyzing/i,
    /^processing/i,
    /^loading/i,
    /^\d+\s*results?$/i,
    /^fetching/i,
    /^\d+\s*𝕏\s*posts?/i,
    /^\d+\s*web\s*pages?/i
  ];

  return statusPatterns.some(pattern => pattern.test(text.trim()));
}

async function captureGrokResponse() {
  const isGrokDotCom = window.location.href.includes('grok.com');

  // Try to find the most recent Grok message first
  if (isGrokDotCom) {
    // Wait longer for the actual response to appear (not just status messages)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Look for the conversation container first
    const conversationContainers = document.querySelectorAll('main [class*="overflow"], div[class*="flex-col"]');

    for (const container of conversationContainers) {
      // Find all message blocks
      const messageBlocks = container.querySelectorAll('div[class*="rounded"], div[class*="p-"], div[class*="mb-"]');

      // Look for the last Grok/assistant message
      for (let i = messageBlocks.length - 1; i >= 0; i--) {
        const block = messageBlocks[i];

        // Skip user messages (often have different background or contain user indicators)
        if (block.querySelector('img[alt*="user"]') ||
            block.querySelector('[class*="user"]') ||
            block.textContent?.includes('You:')) {
          continue;
        }

        // Look for prose content within this block
        const proseContent = block.querySelector('div.prose, div[class*="prose"], div.markdown');
        if (proseContent) {
          const fullText = extractFullText(proseContent);
          if (fullText && fullText.length > 20 && !isGrokStatusMessage(fullText) && !isTimingOnly(fullText)) {
            console.log('Found Grok response in prose content');
            return fullText;
          }
        }

        // Try to get all text from the block if it looks like an assistant message
        const blockText = extractFullText(block);
        if (blockText && blockText.length > 20 && !isGrokStatusMessage(blockText) && !isTimingOnly(blockText)) {
          console.log('Found Grok response in message block');
          return blockText;
        }
      }
    }
  }

  // Fallback to original selectors
  const selectors = isGrokDotCom ? [
    // Grok.com selectors - prioritize full content containers
    'div.prose:last-of-type', // Last prose block
    'div.markdown:last-of-type', // Last markdown block
    'div[class*="prose"]:not([class*="meta"]):last-of-type',
    'div[class*="markdown"]:not([class*="meta"]):last-of-type',
    'div[class*="message-content"]:not([class*="user"]):last-of-type',
    'div[class*="assistant"] div[class*="content"]',
    'div.whitespace-pre-wrap:not(:has(time)):last-of-type'
  ] : [
    // X/Twitter Grok selectors
    'div[data-testid="grok-message"]',
    'article[role="article"]',
    'div[class*="css-"][class*="r-"]'
  ];

  // Wait a bit for response to render
  await new Promise(resolve => setTimeout(resolve, 1000));

  for (const selector of selectors) {
    try {
      const messages = document.querySelectorAll(selector);
      if (messages.length > 0) {
        // For grok.com, we want the last assistant message
        let targetMessage = null;

        if (isGrokDotCom) {
          // Filter to get only assistant messages (not user messages)
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const text = msg.innerText || msg.textContent || '';

            // Skip if it's likely a user message (contains the prompt we just sent)
            // or if it's empty/too short
            if (text.length > 10 && !text.includes('Type your message')) {
              // Check if this is likely an assistant message
              // Grok responses typically have certain characteristics
              const parentElement = msg.closest('div[class*="flex"]');

              // Assistant messages often don't have user avatars or are in even positions
              if (!parentElement?.querySelector('img[alt*="User"]')) {
                targetMessage = msg;
                break;
              }
            }
          }
        } else {
          // For X/Twitter, just get the last message
          targetMessage = messages[messages.length - 1];
        }

        if (targetMessage) {
          // Use the helper function to extract full text
          const text = extractFullText(targetMessage);

          // Skip if this is just timing/metadata or status message
          if (!isTimingOnly(text) && !isGrokStatusMessage(text)) {
            console.log('Found Grok response with selector:', selector);
            return text;
          }
        }
      }
    } catch (e) {
      console.log('Error with selector:', selector, e);
      // Continue to next selector
    }
  }

  // Try one more approach for grok.com - look for message containers
  if (isGrokDotCom) {
    try {
      // Find all message containers
      const allMessages = document.querySelectorAll('div[class*="overflow-hidden"]');

      for (let i = allMessages.length - 1; i >= 0; i--) {
        const msg = allMessages[i];

        // Use helper to extract full text
        const text = extractFullText(msg);

        // Skip if it's just timing/metadata or status message
        if (isTimingOnly(text) || isGrokStatusMessage(text)) {
          continue;
        }

        // Look for assistant responses (usually longer and don't contain certain UI elements)
        if (!text.includes('Type your message') &&
            !text.includes('Ask Grok') &&
            !text.startsWith('/')) {

          // Additional check: assistant messages often have different styling
          const hasUserIndicator = msg.querySelector('img[src*="user"]') ||
                                  msg.querySelector('[class*="user"]');

          if (!hasUserIndicator) {
            console.log('Found Grok response using message container approach');
            return text;
          }
        }
      }
    } catch (e) {
      console.log('Error with message container approach:', e);
    }
  }

  throw new Error('No Grok response found - response may still be generating');
}

async function captureGeminiResponse() {
  // Look for Gemini's response elements
  const selectors = [
    'div.model-response',
    'div[class*="response-container"]',
    'div.markdown-container',
    'message-content'
  ];
  
  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const text = lastMessage.innerText || lastMessage.textContent;
      if (text && text.trim()) {
        return text.trim();
      }
    }
  }
  
  throw new Error('No Gemini response found');
}

async function captureDeepSeekResponse() {
  // DeepSeek response selectors - try multiple approaches
  const selectors = [
    '.ds-markdown pre',           // Pre tag inside ds-markdown
    '.ds-markdown',                // The markdown container itself
    'div.ds-markdown',             // Div with ds-markdown class
    'pre',                         // Any pre tag (fallback)
    'div[data-role="assistant"]',
    'div.assistant-message',
    'div[class*="assistant"]',
    'div.message-content',
    'div.markdown-content',
    'div.prose'
  ];

  // Wait for response to render
  await new Promise(resolve => setTimeout(resolve, 1000));

  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      // Get the last message
      const lastMessage = messages[messages.length - 1];

      // Try to get text content - innerText is better for formatted content
      const text = lastMessage.innerText || lastMessage.textContent;

      if (text && text.trim() && text.trim().length > 10) {
        return text.trim();
      }
    }
  }

  throw new Error('No DeepSeek response found');
}

// Status monitoring functions
function updateStatus(status, message = '') {
  currentStatus = status;
  chrome.runtime.sendMessage({
    action: 'statusUpdate',
    platform: platform,
    status: status,
    message: message,
    timestamp: new Date().toISOString()
  });
}

function startResponseMonitoring() {
  // Clear any existing interval
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }

  updateStatus('submitting', 'Submitting prompt to ' + platform);

  // Platform-specific monitoring
  let checkCount = 0;
  let stuckCount = 0;
  statusCheckInterval = setInterval(() => {
    checkCount++;

    // Check if response is being generated
    if (detectIfProcessing()) {
      updateStatus('processing', 'AI is generating response');
      stuckCount = 0; // Reset stuck counter
    }
    // Check if response is ready
    else if (detectIfResponseReady()) {
      updateStatus('ready', 'Response ready to collect');
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
    // For ChatGPT and Claude, check if stuck
    else if ((platform === 'chatgpt' || platform === 'claude') && checkCount > 5) {
      stuckCount++;
      if (stuckCount > 3) {
        updateStatus('processing', 'Tab activation required - please visit the ' + platform + ' tab');
      }
    }
    // Stop checking after 2 minutes
    else if (checkCount > 120) {
      updateStatus('error', 'Response timeout');
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }

  }, 1000); // Check every second
}

function detectIfProcessing() {
  switch (platform) {
    case 'chatgpt':
      // ChatGPT shows typing indicator or generating message
      return document.querySelector('.result-streaming') !== null ||
             document.querySelector('[data-testid="typing-indicator"]') !== null ||
             document.querySelector('.text-token-text-primary:has(.animate-pulse)') !== null ||
             document.querySelector('button[aria-label*="Stop generating"]') !== null;

    case 'claude':
      // Claude shows a loading/streaming indicator
      return document.querySelector('[data-is-streaming="true"]') !== null ||
             document.querySelector('.animate-pulse') !== null ||
             document.querySelector('button[aria-label*="Stop"]') !== null;

    case 'grok':
      // Grok shows loading states
      return document.querySelector('.loading') !== null ||
             document.querySelector('[class*="animate"]') !== null ||
             document.querySelector('[aria-busy="true"]') !== null;

    case 'gemini':
      // Gemini shows progress indicators - check for various loading states
      return document.querySelector('[data-test-id="model-response-text"][aria-busy="true"]') !== null ||
             document.querySelector('.loading-indicator') !== null ||
             document.querySelector('[aria-busy="true"]') !== null ||
             document.querySelector('.response-loading') !== null ||
             document.querySelector('button[aria-label*="Stop"]') !== null ||
             document.querySelector('[class*="loading"]') !== null ||
             document.querySelector('[class*="generating"]') !== null;

    case 'deepseek':
      // DeepSeek shows loading/generating indicators - check multiple states
      const hasStopButton = document.querySelector('button[aria-label*="Stop"]') !== null ||
                            document.querySelector('button[title*="Stop"]') !== null ||
                            document.querySelector('button[class*="stop"]') !== null;
      const hasLoadingIndicator = document.querySelector('.loading') !== null ||
                                   document.querySelector('[class*="loading"]') !== null ||
                                   document.querySelector('.generating') !== null ||
                                   document.querySelector('[class*="generating"]') !== null ||
                                   document.querySelector('[aria-busy="true"]') !== null;
      const hasStreamingText = document.querySelector('[class*="streaming"]') !== null ||
                               document.querySelector('[data-streaming="true"]') !== null;

      return hasStopButton || hasLoadingIndicator || hasStreamingText;

    default:
      return false;
  }
}

function detectIfResponseReady() {
  switch (platform) {
    case 'chatgpt':
      // Check for completed message without streaming
      const chatGptMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
      if (chatGptMessages.length > 0) {
        const lastMessage = chatGptMessages[chatGptMessages.length - 1];
        // Check if not streaming and has content
        const isStreaming = lastMessage.querySelector('.result-streaming') !== null;
        const hasContent = lastMessage.innerText && lastMessage.innerText.length > 10;
        return !isStreaming && hasContent;
      }
      return false;

    case 'claude':
      // Check for completed Claude message
      const claudeMessages = document.querySelectorAll('[data-is-streaming="false"]');
      return claudeMessages.length > 0 &&
             claudeMessages[claudeMessages.length - 1].innerText.length > 10;

    case 'grok':
      // Check for Grok response
      const isGrokDotCom = window.location.href.includes('grok.com');
      if (isGrokDotCom) {
        const messages = document.querySelectorAll('div[class*="message"], div[class*="assistant"]');
        return messages.length > 0 &&
               messages[messages.length - 1].innerText.length > 10;
      } else {
        return document.querySelector('[data-testid="grok-message"]') !== null;
      }

    case 'gemini':
      // Check for Gemini response - must NOT be processing AND have content
      const isGeminiProcessing = document.querySelector('[data-test-id="model-response-text"][aria-busy="true"]') !== null ||
                                  document.querySelector('button[aria-label*="Stop"]') !== null ||
                                  document.querySelector('[aria-busy="true"]') !== null ||
                                  document.querySelector('[class*="loading"]') !== null;

      if (isGeminiProcessing) {
        return false; // Still processing, not ready
      }

      const geminiResponses = document.querySelectorAll('.model-response, .response-container, [data-test-id="model-response-text"]');
      return geminiResponses.length > 0 &&
             geminiResponses[geminiResponses.length - 1].innerText.length > 10;

    case 'deepseek':
      // Check for DeepSeek response - must NOT be processing AND have content
      const isDeepSeekProcessing = document.querySelector('button[aria-label*="Stop"]') !== null ||
                                    document.querySelector('button[title*="Stop"]') !== null ||
                                    document.querySelector('button[class*="stop"]') !== null ||
                                    document.querySelector('[class*="loading"]') !== null ||
                                    document.querySelector('[class*="generating"]') !== null ||
                                    document.querySelector('[class*="streaming"]') !== null ||
                                    document.querySelector('[aria-busy="true"]') !== null;

      if (isDeepSeekProcessing) {
        return false; // Still processing, not ready
      }

      const deepseekMessages = document.querySelectorAll('div[data-role="assistant"], div.assistant-message, div[class*="assistant"]');
      return deepseekMessages.length > 0 &&
             deepseekMessages[deepseekMessages.length - 1].innerText.length > 10;

    default:
      return false;
  }
}

console.log(`PromptEditor.io Auto-Submit loaded for ${platform}`);