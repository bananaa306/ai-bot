import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import groq
import json
import re
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Secure CORS - only allow your domain in production
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://yourdomain.com"  # Replace with your actual domain
]

CORS(app, origins=ALLOWED_ORIGINS)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour", "5 per minute"]
)

# Secure API key handling - use environment variable
groq_api_key = os.getenv('GROQ_API_KEY')
if not groq_api_key:
    logger.error("GROQ_API_KEY environment variable not set!")
    logger.error("Please set your Groq API key in Railway environment variables")
    raise ValueError("Missing GROQ_API_KEY environment variable")

logger.info("Groq API key loaded successfully")
client = groq.Groq(api_key=groq_api_key)

# File to store conversation history
HISTORY_FILE = 'web_conversation_history.json'

# Input validation
MAX_MESSAGE_LENGTH = 1000
ALLOWED_CHARS_PATTERN = re.compile(r'^[a-zA-Z0-9\s\.,\?!;:\-\(\)\[\]{}"\'\n\r]+$')

class ConversationStack:
    def __init__(self, max_size=20):
        self.stack = []
        self.max_size = max_size
        self.system_message = {
            "role": "system", 
            "content": "You are a helpful assistant. Provide helpful, accurate, and engaging responses to user questions. Do not provide harmful, illegal, or inappropriate content."
        }
    
    def push(self, message):
        """Add a message to the stack"""
        self.stack.append(message)
        # Keep only the most recent messages
        if len(self.stack) > self.max_size:
            self.stack = [self.system_message] + self.stack[-(self.max_size-1):]
    
    def get_all_messages(self):
        """Get all messages for sending to AI"""
        if not self.stack or self.stack[0]["role"] != "system":
            return [self.system_message] + self.stack
        return self.stack
    
    def save_to_file(self):
        """Save stack to file"""
        try:
            with open(HISTORY_FILE, 'w') as f:
                json.dump(self.stack, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save conversation: {e}")
    
    def load_from_file(self):
        """Load stack from file"""
        try:
            if os.path.exists(HISTORY_FILE):
                with open(HISTORY_FILE, 'r') as f:
                    self.stack = json.load(f)
            else:
                self.stack = [self.system_message]
        except Exception as e:
            logger.error(f"Failed to load conversation: {e}")
            self.stack = [self.system_message]

# Create conversation stack
conversation_stack = ConversationStack()
conversation_stack.load_from_file()

def validate_message(message):
    """Validate user input"""
    if not message or not isinstance(message, str):
        return False, "Message must be a non-empty string"
    
    if len(message) > MAX_MESSAGE_LENGTH:
        return False, f"Message too long (max {MAX_MESSAGE_LENGTH} characters)"
    
    # Basic content filtering
    forbidden_patterns = [
        r'<script',
        r'javascript:',
        r'on\w+\s*=',
        r'eval\s*\(',
        r'document\.',
        r'window\.'
    ]
    
    message_lower = message.lower()
    for pattern in forbidden_patterns:
        if re.search(pattern, message_lower):
            return False, "Message contains potentially harmful content"
    
    return True, None

def analyze_request_complexity(user_prompt):
    """Analyze the user's request to determine appropriate token count"""
    prompt_lower = user_prompt.lower()
    word_count = len(user_prompt.split())
    
    # Cap maximum tokens for cost control
    MAX_TOKENS = 800
    
    # Very short responses (50-100 tokens)
    short_indicators = ['yes', 'no', 'what is', 'define', 'who is', 'when', 'where']
    if any(indicator in prompt_lower for indicator in short_indicators) and word_count < 5:
        return min(150, MAX_TOKENS)
    
    # Medium responses (300-400 tokens)
    medium_indicators = ['explain', 'how to', 'why', 'compare', 'difference', 'summary', 'tell me about', 'talk about', 'describe']
    if any(indicator in prompt_lower for indicator in medium_indicators):
        return min(450, MAX_TOKENS)
    
    # Long responses (500-700 tokens)
    long_indicators = ['write', 'essay', 'detailed', 'comprehensive', 'analysis', 'step by step', 'tutorial', 'discuss']
    if any(indicator in prompt_lower for indicator in long_indicators):
        return min(700, MAX_TOKENS)
    
    # Very long responses (capped at MAX_TOKENS)
    very_long_indicators = ['story', 'article', 'blog post', 'report', 'research', 'complete guide', 'everything about']
    if any(indicator in prompt_lower for indicator in very_long_indicators):
        return MAX_TOKENS
    
    # Special handling for animal/nature topics
    nature_topics = ['animal', 'bird', 'duck', 'cat', 'dog', 'wildlife', 'nature', 'species', 'habitat']
    if any(topic in prompt_lower for topic in nature_topics):
        return min(500, MAX_TOKENS)
    
    # Default based on input length
    if word_count > 50:
        return min(700, MAX_TOKENS)
    elif word_count > 20:
        return min(500, MAX_TOKENS)
    else:
        return min(350, MAX_TOKENS)

def determine_temperature(user_prompt):
    """Determine creativity level based on request type"""
    prompt_lower = user_prompt.lower()
    
    # Low creativity for factual/technical content
    factual_indicators = ['definition', 'fact', 'calculate', 'formula', 'technical', 'scientific', 'data']
    if any(indicator in prompt_lower for indicator in factual_indicators):
        return 0.1
    
    # Medium creativity for explanations
    explanation_indicators = ['explain', 'how', 'why', 'what']
    if any(indicator in prompt_lower for indicator in explanation_indicators):
        return 0.3
    
    # High creativity for creative content (but capped for safety)
    creative_indicators = ['story', 'poem', 'creative', 'imagine', 'invent', 'brainstorm']
    if any(indicator in prompt_lower for indicator in creative_indicators):
        return 0.7  # Reduced from 0.8 for more predictable output
    
    return 0.4  # Default balanced creativity

def generate_response_with_params(user_prompt, max_tokens, temperature):
    """Generate response using Groq AI with specified parameters"""
    try:
        # Add user message to conversation stack
        conversation_stack.push({"role": "user", "content": user_prompt})
        
        logger.info(f"Generating response: {max_tokens} tokens, temperature {temperature}")
        
        response = client.chat.completions.create(
            model='llama-3.1-8b-instant',
            messages=conversation_stack.get_all_messages(),
            max_tokens=max_tokens,
            temperature=temperature,
            timeout=30  # Add timeout
        )
        
        ai_response = response.choices[0].message.content
        
        # Add AI response to conversation stack
        conversation_stack.push({"role": "assistant", "content": ai_response})
        
        # Save conversation history
        conversation_stack.save_to_file()
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating response: {e}")
        return "I apologize, but I'm experiencing technical difficulties. Please try again later."

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Railway"""
    return jsonify({
        'status': 'healthy', 
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'NeuralTalk AI Bot'
    }), 200

@app.route('/')
def index():
    """Serve the main HTML file"""
    try:
        return send_from_directory('.', 'index.html')
    except Exception as e:
        logger.error(f"Error serving index.html: {e}")
        return jsonify({'error': 'Could not load application'}), 500

@app.route('/<path:filename>')
def static_files(filename):
    """Serve static files"""
    try:
        return send_from_directory('.', filename)
    except Exception as e:
        logger.error(f"Error serving {filename}: {e}")
        if filename.endswith('.html'):
            return jsonify({'error': 'Page not found'}), 404
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/chat', methods=['POST'])
@limiter.limit("10 per minute")  # Additional rate limiting for chat endpoint
def chat():
    """API endpoint for chat messages"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid JSON data'}), 400
        
        user_message = data.get('message', '')
        
        # Validate input
        is_valid, error_msg = validate_message(user_message)
        if not is_valid:
            logger.warning(f"Invalid message from {get_remote_address()}: {error_msg}")
            return jsonify({'error': error_msg}), 400
        
        # Get analysis parameters
        frontend_max_tokens = data.get('maxTokens', None)
        frontend_complexity = data.get('complexity', None)
        
        # Use frontend analysis if provided and reasonable, otherwise analyze server-side
        if frontend_max_tokens and frontend_complexity and frontend_max_tokens <= 800:
            max_tokens = min(frontend_max_tokens, 800)  # Cap tokens
            # Adjust temperature based on frontend complexity
            if frontend_complexity == 'simple':
                temperature = 0.1
            elif frontend_complexity == 'medium':
                temperature = 0.3
            else:  # complex
                temperature = 0.4
            
            logger.info(f"Frontend analysis: {max_tokens} tokens, complexity: {frontend_complexity}")
        else:
            # Fallback to server-side analysis
            max_tokens = analyze_request_complexity(user_message)
            temperature = determine_temperature(user_message)
            logger.info(f"Server analysis: {max_tokens} tokens, temperature: {temperature}")
        
        # Generate response with security measures
        response = generate_response_with_params(user_message, max_tokens, temperature)
        
        return jsonify({
            'response': response,
            'status': 'success'
        })
        
    except Exception as e:
        logger.error(f"API Error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/clear', methods=['POST'])
@limiter.limit("5 per minute")
def clear_history():
    """Clear conversation history"""
    try:
        conversation_stack.stack = [conversation_stack.system_message]
        conversation_stack.save_to_file()
        return jsonify({'status': 'success', 'message': 'History cleared'})
    except Exception as e:
        logger.error(f"Clear Error: {e}")
        return jsonify({'error': 'Failed to clear history'}), 500

@app.route('/api/history', methods=['GET'])
@limiter.limit("10 per minute")
def get_history():
    """Get conversation history"""
    try:
        # Don't expose full conversation stack for security
        return jsonify({
            'count': len(conversation_stack.stack),
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"History Error: {e}")
        return jsonify({'error': 'Failed to get history'}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Rate limit exceeded. Please slow down.'}), 429

@app.errorhandler(404)
def not_found_handler(e):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error_handler(e):
    logger.error(f"Internal server error: {e}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Railway automatically sets PORT environment variable
    port = int(os.getenv('PORT', 5003))
    
    # Check if running in production (Railway sets these)
    is_production = (
        os.getenv('FLASK_ENV') == 'production' or 
        os.getenv('RAILWAY_ENVIRONMENT') is not None or
        os.getenv('PORT') is not None
    )
    
    if is_production:
        logger.info(f"Starting in PRODUCTION mode on port {port}")
        # Railway requires binding to 0.0.0.0
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        logger.info(f"Starting in DEVELOPMENT mode on port {port}")
        print("🤖 AI Chat Server Starting...")
        print(f"📡 Server will be available at: http://localhost:{port}")
        print("🌐 Open index.html in your browser to start chatting!")
        print("⚠️  This is DEVELOPMENT mode - not suitable for production!")
        print("=" * 50)
        app.run(host='127.0.0.1', port=port, debug=True)
