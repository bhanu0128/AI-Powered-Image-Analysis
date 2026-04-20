# 🤖 AI Image Analyzer Pro

Advanced image analysis powered by PixelInsight Engine.


## ⚡ Quick Start (2 Minutes)

1. **Get API Key**: [aistudio.google.com](https://aistudio.google.com)
2. **Update `config.js`**: Replace API key
3. **Run**: `python -m http.server 8000`
4. **Open**: [http://localhost:8000](http://localhost:8000)

## 📸 Upload Images

**Best for:**
- Product photos
- Business cards
- Receipts
- Screenshots
- Any clear image

**Formats:** JPG, PNG, GIF, WebP (Max 20MB)

## 🎯 What You Get

For each image:
- **ID** - Unique identifier
- **Name** - Product/item name  
- **Section** - Category
- **Description** - Full details
- **+ 3 Similar suggestions**
- **+ Metadata** (time, confidence, size)

## 🎮 Features

| Feature | Use |
|---------|-----|
| 📋 **Paste** | Paste from clipboard |
| 📷 **Camera** | Use device camera |
| 🔗 **URL** | Image from URL |
| 🔄 **Rotate** | Rotate image 90° |
| 🔍 **Zoom** | Zoom in/out |
| ❤️ **Favorite** | Star results |
| 📋 **Copy** | Copy to clipboard |
| ⬇️ **Download** | Save as JSON |
| 📋 **History** | View past analyses |
| ⚙️ **Settings** | Customize app |
| 🌙 **Dark Mode** | Toggle theme |

## 📊 Tech Stack

- Vanilla JavaScript (ES6)
- CSS3 with animations
- PixelInsight Engine (Advanced AI)
- Browser LocalStorage
- Python HTTP server

## 💡 Tips

✅ **Good lighting, centered subject, sharp focus, clean background**  
❌ **Avoid: Blurry, dark, cluttered, tiny images**

## 🔒 Security

- API key stored locally only
- All data in browser storage
- No server-side processing
- No personal data tracking

## 📁 Files

```
├── index.html       (UI)
├── style.css        (Styling - 2100 lines)
├── script.js        (Logic - 1100 lines)
├── config.js        (API key)
└── README.md        (This)
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| No results | Check API key in config.js |
| Upload fails | Ensure image format, <20MB |
| History not saving | Enable localStorage |
| API errors | Get new key from aistudio.google.com |

## 📱 Browser Support

Chrome, Firefox, Safari, Edge (latest) + mobile browsers

---

**Ready? Upload an image and start analyzing! 🚀**
