// Popup script for extension interface

document.addEventListener('DOMContentLoaded', () => {
  loadTabs();
  
  document.getElementById('refresh-btn').addEventListener('click', loadTabs);
});

async function loadTabs() {
  const statusEl = document.getElementById('status-text');
  const tabsList = document.getElementById('tabs-list');
  
  statusEl.textContent = 'Scanning for LLM tabs...';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'checkConnection' });
    
    if (response.success && response.tabs.length > 0) {
      statusEl.textContent = `Found ${response.tabs.length} LLM tab(s)`;
      
      tabsList.innerHTML = '';
      response.tabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = `tab-item ${tab.status}`;
        
        const platformBadge = document.createElement('span');
        platformBadge.className = 'platform-badge';
        platformBadge.textContent = tab.platform.toUpperCase();
        
        const tabTitle = document.createElement('span');
        tabTitle.textContent = tab.title.substring(0, 30) + (tab.title.length > 30 ? '...' : '');
        
        tabItem.appendChild(platformBadge);
        tabItem.appendChild(tabTitle);
        
        tabsList.appendChild(tabItem);
      });
    } else {
      statusEl.textContent = 'No LLM tabs found';
      tabsList.innerHTML = '<div class="empty-state">Open ChatGPT, Claude, Grok, or Gemini in a tab</div>';
    }
  } catch (error) {
    statusEl.textContent = 'Error checking tabs';
    console.error('Error:', error);
  }
}