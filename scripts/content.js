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
  // Look for Claude's response elements
  const selectors = [
    'div[data-is-streaming="false"]',
    'div.prose',
    'div[class*="message-content"]',
    'div.ProseMirror'
  ];
  
  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const text = lastMessage.innerText || lastMessage.textContent;
      if (text && text.trim() && !text.includes('Type a message')) {
        return text.trim();
      }
    }
  }
  
  throw new Error('No Claude response found');
}

async function captureGrokResponse() {
  const isGrokDotCom = window.location.href.includes('grok.com');

  // Different selectors for grok.com vs X/Twitter
  const selectors = isGrokDotCom ? [
    // Grok.com selectors
    'div[class*="message"]:has(div[class*="assistant"])',
    'div[class*="assistant"] div[class*="content"]',
    'div[class*="response"] div[class*="text"]',
    'div.prose',
    'div[class*="markdown"]',
    'div.whitespace-pre-wrap',
    // More generic selectors for grok.com
    'main div[class*="flex-col"] > div:nth-child(even) div[class*="rounded"]',
    'div[class*="bg-gray"]:has(p)',
    'div[class*="assistant-message"]',
    'div[data-role="assistant"]'
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
          const text = targetMessage.innerText || targetMessage.textContent;
          if (text && text.trim() && text.trim().length > 5) {
            console.log('Found Grok response with selector:', selector);
            return text.trim();
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
        const text = msg.innerText || msg.textContent || '';

        // Look for assistant responses (usually longer and don't contain certain UI elements)
        if (text.length > 20 &&
            !text.includes('Type your message') &&
            !text.includes('Ask Grok') &&
            !text.startsWith('/')) {

          // Additional check: assistant messages often have different styling
          const hasUserIndicator = msg.querySelector('img[src*="user"]') ||
                                  msg.querySelector('[class*="user"]');

          if (!hasUserIndicator) {
            console.log('Found Grok response using message container approach');
            return text.trim();
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
      // Gemini shows progress indicators
      return document.querySelector('.loading-indicator') !== null ||
             document.querySelector('[aria-busy="true"]') !== null ||
             document.querySelector('.response-loading') !== null;

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
      // Check for Gemini response
      const geminiResponses = document.querySelectorAll('.model-response, .response-container');
      return geminiResponses.length > 0 &&
             geminiResponses[geminiResponses.length - 1].innerText.length > 10;

    default:
      return false;
  }
}

console.log(`PromptEditor.io Auto-Injector loaded for ${platform}`);