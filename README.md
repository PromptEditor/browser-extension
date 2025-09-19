# PromptEditor.io Browser Extension

A powerful Chrome extension that enables seamless prompt submission from PromptEditor.io to multiple AI platforms simultaneously.

## 🎯 Overview

The PromptEditor.io Browser Extension acts as a bridge between your prompt editor and various AI chat interfaces, allowing you to submit the same prompt to multiple platforms with a single click. Perfect for comparing AI responses, testing prompt variations, or managing conversations across different LLMs.

## 🚀 Supported Platforms

- **ChatGPT** - chat.openai.com, chatgpt.com
- **Claude** - claude.ai
- **Grok** - grok.com (X/Twitter's AI)
- **Gemini** - gemini.google.com

## 📦 Installation

### Step 1: Install the Extension

1. Download or clone the `browser-extension` folder from this repository
2. Open Chrome (or any Chromium-based browser like Edge, Brave)
3. Navigate to `chrome://extensions/`
4. Enable **"Developer mode"** using the toggle in the top right corner
5. Click **"Load unpacked"**
6. Select the `browser-extension` folder from your file system
7. The extension will be installed and assigned a unique Extension ID

### Step 2: Connect to PromptEditor.io

1. Copy the **Extension ID** shown on the extension card (looks like: `abcdefghijklmnopqrstuvwxyz`)
2. Open [PromptEditor.io](https://prompteditor.io) in your browser
3. Click the **⚡ Zap icon** in the editor to open the Auto Submit panel
4. Paste your Extension ID in the connection field
5. Click **Connect** - you should see "Extension connected successfully!"

## 💡 How to Use

### Basic Workflow

1. **Write your prompt** in the PromptEditor.io editor
2. **Open AI platforms** in separate browser tabs (ChatGPT, Claude, Grok, Gemini)
3. **Open Auto Submit panel** by clicking the ⚡ icon in the editor
4. **Scan for tabs** - Click "Scan" to detect available AI platform tabs
5. **Select targets** - Check/uncheck platforms you want to submit to
6. **Submit prompt** - Click "Submit Prompt" to send your text to all selected platforms

### Advanced Features

#### Real-time Progress Tracking
- Monitor submission status for each platform
- See when AI responses are ready
- Track processing states in real-time

#### Response Collection
- Click "Collect Responses" to gather all AI outputs
- Import responses directly back into your editor
- Compare responses side-by-side

#### Selective Targeting
- Use checkboxes to choose specific platforms
- Submit to all platforms or just selected ones
- Disable platforms that aren't ready

## ✨ Key Features

### 🔄 Multi-Platform Submission
Submit the same prompt to multiple AI platforms simultaneously, saving time and ensuring consistency across different models.

### 📊 Status Monitoring
Real-time status indicators show you:
- Which tabs are ready for submission
- Current processing state of each platform
- When responses are available for collection

### 🎯 Smart Detection
The extension automatically detects:
- Available AI platform tabs in your browser
- Platform readiness state
- Text input areas for each platform

### 🔒 Privacy-First Design
- All communication happens locally in your browser
- No external servers or third-party services involved
- Your prompts never leave your machine except to the AI platforms you choose
- Extension only activates on explicitly supported domains

## 🛠️ Troubleshooting

### Extension Not Detected

**Problem:** PromptEditor.io doesn't recognize the extension

**Solutions:**
- Verify the Extension ID is correctly copied and pasted
- Refresh the PromptEditor.io page after installing the extension
- Ensure the extension is enabled in `chrome://extensions/`
- Check that you're using a supported browser (Chrome, Edge, Brave)

### Tabs Not Found

**Problem:** AI platform tabs aren't detected when scanning

**Solutions:**
- Ensure AI platform tabs are fully loaded before scanning
- Log in to the AI platforms if required
- Navigate to the main chat interface (not settings or other pages)
- Click "Scan" again to refresh the available tabs list

### Submission Not Working

**Problem:** Prompts aren't being submitted to the platforms

**Solutions:**
- Refresh the AI platform tab and try again
- Check that you're on the chat interface, not a different page
- Verify the platform shows as "ready" (green status)
- For ChatGPT/Claude: You may need to visit the tab to complete processing

### Platform-Specific Issues

**ChatGPT & Claude:**
- May require visiting their tabs to complete processing
- Look for the warning message in the submission progress section

**Grok:**
- Ensure you're logged into X/Twitter
- Navigate directly to grok.com

**Gemini:**
- Make sure you're signed into your Google account
- Use the main Gemini interface at gemini.google.com

## 🔧 Development

### Project Structure
```
browser-extension/
├── manifest.json          # Extension configuration
├── scripts/
│   ├── background.js      # Background service worker
│   └── content.js        # Content script for AI platforms
└── icons/                # Extension icons
```

### Making Changes

1. Edit files in the `browser-extension` folder
2. Navigate to `chrome://extensions/`
3. Click the **↻ refresh** icon on the extension card
4. Test your changes on the supported platforms

### Testing Tips
- Use Chrome DevTools to debug content scripts
- Check the service worker logs in the extension's background page
- Test with different prompt lengths and formats
- Verify behavior across all supported platforms

## 📋 Permissions

The extension requires permissions for:
- `tabs` - To detect and interact with AI platform tabs
- `scripting` - To submit prompts to the platforms
- Specific domain access for each supported platform

## 🤝 Contributing

Contributions are welcome! If you'd like to add support for new platforms or improve existing features:

1. Fork the repository
2. Create a feature branch
3. Test thoroughly across all platforms
4. Submit a pull request with a clear description

## 📄 License

This extension is part of the PromptEditor.io project and is released under the MIT License.

## 🔗 Links

- [PromptEditor.io](https://prompteditor.io) - Main application
- [GitHub Repository](https://github.com/prompteditor/prompteditor) - Source code
- [Report Issues](https://github.com/prompteditor/prompteditor/issues) - Bug reports and feature requests

---

Made with ❤️ by the PromptEditor.io team