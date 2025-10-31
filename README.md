# NeuralTalk AI Chatbot

A secure AI chatbot with beautiful mathematical formula rendering using KaTeX and Groq API.

## Features

- 🤖 AI-powered conversations with Groq API
- 📐 Beautiful LaTeX math rendering with KaTeX  
- 🛡️ Advanced security with rate limiting and input validation
- 🎨 Professional "NeuralTalk" interface with history sidebar
- 📱 Responsive design

## Deployment

This app is ready for Railway deployment:

1. Connect your GitHub repository to Railway
2. Set environment variables:
   - `GROQ_API_KEY`: Your Groq API key
   - `FLASK_ENV`: Set to `production`
3. Deploy!

## Environment Variables

Required:
- `GROQ_API_KEY`: Your Groq API key
- `FLASK_ENV`: `production` for live deployment

Optional:
- `ALLOWED_ORIGINS`: Comma-separated list of allowed domains

## Security Features

- ✅ Rate limiting (200/day, 50/hour, 5/minute)
- ✅ Input validation and XSS protection
- ✅ Environment-based configuration
- ✅ Secure error handling
- ✅ CORS protection

## Local Development

```bash
pip install -r requirements.txt
python secure_server.py
```

Open `index.html` in your browser.