# Respond in Language 🌐

A Chrome extension that enables real-time language translation for web-based chats. Type in your native language, communicate in any language!

## Features

✨ **Type in Your Native Language** - The overlay lets you compose messages in your comfort zone

🔄 **Automatic Translation** - Messages are translated before sending to match the chat's language

📥 **Incoming Translation** - See translated versions of messages you receive

🎯 **Universal Chat Support** - Works on any web-based chat platform through smart DOM detection

🔒 **Secure API Key Storage** - Your Google Translate API key is encrypted locally

💾 **Smart Caching** - Reduces API costs by caching translations for 24 hours

📊 **Quota Tracking** - Monitor your daily API usage

🎨 **Draggable Overlay** - Position the interface wherever you want

## How It Works

1. **You type** in your native language in the floating overlay (Alt+T to toggle)
2. **Extension translates** your message to the chat's language using Google Translate API
3. **Message is sent** to the chat in the correct language
4. **Incoming messages** are detected and translated back to your native language for easy reading

## Prerequisites

- **Google Cloud Account** - To get a Google Translate API key
- **Chrome Browser** - Version 88 or higher (Manifest V3 support)

## Installation

### 1. Get a Google Translate API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Cloud Translation API**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > API Key**
6. Copy the API key (format: `AIza...`)

**Pricing**: Google offers 500,000 characters/month for free (~$0). After that, it's ~$20 per 1M characters.

### 2. Build the Extension

```bash
# Clone or navigate to the project directory
cd respond_in_language

# Install dependencies (optional, only needed for development)
npm install

# Build the extension
npm run build
```

This creates a `build/` directory with all extension files.

### 3. Add Icons (Important!)

Before loading the extension, you need to add icon files:

1. Create icon images (16x16, 32x32, 48x48, 128x128 pixels)
2. Save them as PNG files in `build/assets/icons/`:
   - `icon16.png`
   - `icon32.png`
   - `icon48.png`
   - `icon128.png`

**Quick tip**: Use [icon.kitchen](https://icon.kitchen/) to generate all sizes from a single image.

### 4. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `build/` folder
5. The extension should now appear in your extensions list

### 5. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Click **Open Settings**
3. Enter your **Google Translate API Key**
4. Select your **Native Language**
5. Choose a **Default Chat Language** (fallback if auto-detection fails)
6. Click **Save Settings**

## Usage

### Quick Start

1. Navigate to any web-based chat (WhatsApp Web, Messenger, Slack, etc.)
2. Press **Alt+T** to open the translation overlay
3. Type your message in your native language
4. Click **Send** or press **Ctrl+Enter**
5. Your message is translated and sent automatically!

### Keyboard Shortcuts

- **Alt+T** - Toggle overlay visibility
- **Ctrl+Enter** - Send message from overlay
- **Escape** - Close overlay

### Supported Platforms

The extension uses a **generic adapter** that works with any web-based chat through intelligent DOM detection:

- ✅ WhatsApp Web
- ✅ Facebook Messenger
- ✅ Telegram Web
- ✅ Slack
- ✅ Discord
- ✅ Any other web-based chat!

The extension automatically detects input fields, send buttons, and message containers.

## Configuration Options

### Language Settings

- **Native Language**: The language you type in
- **Default Chat Language**: Fallback if auto-detection fails
- **Auto-detect Chat Language**: Automatically detect the chat's language from message history

### Display Settings

- **Show Original Text**: Display original text alongside translations
- **Theme**: Light or dark theme for the overlay

### API Configuration

- **Google Translate API Key**: Your encrypted API key
- **Daily Quota**: Track usage against your daily limit (default: 500,000 chars)

## Architecture

### Components

```
┌─────────────────────────────────────────┐
│   Background Service Worker            │
│   • Translation Service (API calls)    │
│   • Language Detector                  │
│   • Storage Manager (encrypted)        │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│   Content Script                        │
│   • Generic Chat Adapter (DOM)          │
│   • Message Observer                    │
│   • Overlay Injector                    │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────┴───────────────────────┐
│   Floating Overlay UI                   │
│   • Input Interface                     │
│   • Drag Handler                        │
│   • Translation Display                 │
└─────────────────────────────────────────┘
```

### Key Features

- **Manifest V3** - Latest Chrome extension standard
- **ES6 Modules** - Modern JavaScript with imports/exports
- **Web Crypto API** - Secure API key encryption (AES-GCM)
- **MutationObserver** - Real-time message detection
- **Circuit Breaker Pattern** - Handles API failures gracefully
- **LRU Cache** - Reduces API costs with smart caching

## Development

### Project Structure

```
respond_in_language/
├── manifest.json               # Extension manifest
├── build.js                    # Build script
├── package.json                # Node dependencies
├── src/
│   ├── background/             # Service worker
│   │   ├── service-worker.js
│   │   ├── translation-service.js
│   │   ├── language-detector.js
│   │   └── storage-manager.js
│   ├── content/                # Content scripts
│   │   ├── content-script.js
│   │   └── platform-adapters/
│   │       └── generic-adapter.js
│   ├── overlay/                # Floating UI
│   │   ├── overlay.html
│   │   ├── overlay.css
│   │   └── overlay.js
│   ├── options/                # Settings page
│   │   ├── options.html
│   │   └── options.js
│   ├── popup/                  # Extension popup
│   │   ├── popup.html
│   │   └── popup.js
│   └── shared/                 # Utilities
│       ├── constants.js
│       ├── utils.js
│       └── logger.js
└── build/                      # Build output (gitignored)
```

### Building

```bash
npm run build
```

This copies all files to the `build/` directory.

### Debugging

1. Open Chrome DevTools on any page
2. Go to **Sources** tab
3. Find **Content scripts** or **Service workers**
4. Set breakpoints and inspect

For background worker:
1. Go to `chrome://extensions/`
2. Find "Respond in Language"
3. Click "Service worker" link to open DevTools

## Troubleshooting

### Extension Not Working

1. **Check API Key**: Go to settings and test your API key
2. **Check Permissions**: Extension needs `storage`, `activeTab`, `scripting`
3. **Reload Extension**: Go to `chrome://extensions/` and click reload
4. **Check Console**: Open DevTools and look for errors

### Translations Not Happening

1. **Verify API Key**: Ensure key is valid and has Translation API enabled
2. **Check Quota**: You may have exceeded your daily limit
3. **Inspect Network**: Check if API calls are being made (Network tab)
4. **Check Language Settings**: Ensure native/chat languages are different

### Overlay Not Appearing

1. **Try Shortcut**: Press `Alt+T` to toggle
2. **Check Injection**: Open DevTools > Elements and look for iframe with id `respond-in-language-overlay`
3. **Reload Page**: Sometimes a page reload helps

### Chat Platform Not Supported

The generic adapter should work on most chats, but if it doesn't:
1. Open an issue with the chat platform URL
2. Include screenshots of the chat interface
3. Check browser console for errors

## Privacy & Security

- ✅ **API keys encrypted** using AES-GCM with browser-instance key derivation
- ✅ **Local storage only** - All data stored in Chrome's local storage
- ✅ **No external servers** - Direct communication with Google Translate API
- ✅ **Minimal permissions** - Only requests necessary permissions
- ✅ **No tracking** - No analytics or user tracking

## Cost Estimation

**Google Translate API Pricing**:
- Free tier: 500,000 characters/month
- Paid: ~$20 per 1 million characters

**Average Usage**:
- 50 messages/day × 100 chars/message = 5,000 chars/day
- Monthly: ~150,000 characters (**free tier sufficient**)

**With caching** (24-hour TTL), actual API calls reduced by 50-70%!

## Roadmap

### Current Version (1.0.0)

- ✅ Basic translation (outgoing/incoming)
- ✅ Universal chat support
- ✅ Secure API key storage
- ✅ Smart caching
- ✅ Draggable overlay

### Future Enhancements

- [ ] Real-time video translation (subtitles)
- [ ] Platform-specific adapters (WhatsApp, Messenger optimizations)
- [ ] Offline translation support (local models)
- [ ] Translation history
- [ ] Custom keyboard shortcuts
- [ ] Multi-language conversations (detect per-message)

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

Found a bug or have a feature request?

1. Check existing [GitHub Issues](https://github.com/your-repo/issues)
2. Create a new issue with details
3. Include browser version, error messages, and steps to reproduce

## Acknowledgments

- Built with ❤️ using Chrome Extension Manifest V3
- Powered by Google Cloud Translation API
- Icons from (add your icon source here)

---

**Made for seamless multilingual communication** 🌍💬
