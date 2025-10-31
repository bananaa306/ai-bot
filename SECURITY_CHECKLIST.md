# Security Requirements for Production Deployment

## CRITICAL - Must Fix Before Going Public

### 1. Environment Variables Setup
Create a `.env` file (DO NOT commit to git):
```bash
GROQ_API_KEY=your_actual_api_key_here
FLASK_ENV=production
SECRET_KEY=your_secret_key_here
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 2. Install Required Packages
```bash
pip install flask-limiter python-dotenv
```

### 3. Git Security
Add to `.gitignore`:
```
.env
*.key
web_conversation_history.json
__pycache__/
```

### 4. Production Deployment Checklist

#### Server Configuration:
- [ ] Use HTTPS (SSL certificate)
- [ ] Set up reverse proxy (nginx/apache)
- [ ] Configure firewall rules
- [ ] Use production WSGI server (gunicorn/uWSGI)
- [ ] Set up monitoring and logging
- [ ] Configure automatic backups

#### Application Security:
- [ ] Remove API key from code
- [ ] Set up environment variables
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Add input validation
- [ ] Set up error handling
- [ ] Disable debug mode
- [ ] Add authentication (if needed)

#### Infrastructure:
- [ ] Use managed database (instead of JSON file)
- [ ] Set up CDN for static files
- [ ] Configure load balancing (if needed)
- [ ] Set up health checks
- [ ] Configure log rotation

### 5. Production Deployment Commands

#### Using Docker (Recommended):
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "secure_server:app"]
```

#### Using Gunicorn:
```bash
pip install gunicorn
gunicorn --workers 4 --bind 0.0.0.0:5000 secure_server:app
```

### 6. Additional Security Measures

#### Content Security Policy (CSP):
Add to your HTML:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;">
```

#### API Key Rotation:
- Rotate your Groq API key regularly
- Monitor API usage for anomalies
- Set up usage alerts

#### Monitoring:
- Set up application monitoring (New Relic, DataDog)
- Configure log analysis
- Set up uptime monitoring
- Monitor for security threats

### 7. Legal Considerations
- [ ] Add Terms of Service
- [ ] Add Privacy Policy
- [ ] Consider GDPR compliance
- [ ] Add rate limiting notice
- [ ] Consider content filtering

### 8. Performance Optimization
- [ ] Enable gzip compression
- [ ] Set up caching headers
- [ ] Optimize static file serving
- [ ] Consider using Redis for sessions
- [ ] Set up database connection pooling

## Current Security Score: 2/10 ⚠️

Your application is **NOT READY** for public deployment. Please implement the security measures above before going live.

## Quick Fix for Development Testing:
1. Move API key to environment variable
2. Install flask-limiter
3. Use the secure_server.py instead of server.py
4. Test with limited access only
