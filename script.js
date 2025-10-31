class AIChatBot {
    constructor() {
        this.chatHistory = document.getElementById('chatHistory');
        this.userInput = document.getElementById('userInput');
        this.clearButton = document.getElementById('clearButton');
        this.clearHistoryButton = document.getElementById('clearHistoryButton');
        this.historyToggle = document.getElementById('historyToggle');
        this.historyList = document.getElementById('historyList');
        this.historyContent = document.getElementById('historyContent');
        
        this.conversationHistory = [];
        this.isLoading = false;
        this.isHistoryOpen = false;
        this.showComplexityAnalysis = false; // Set to true for debugging
        
        this.initializeEventListeners();
        this.loadConversationHistory();
    }
    
    initializeEventListeners() {
        // Enter key press
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });
        
        // Clear history button (new one in sidebar)
        this.clearHistoryButton.addEventListener('click', () => this.handleClear());
        
        // History dropdown toggle
        this.historyToggle.addEventListener('click', () => this.toggleHistoryDropdown());
    }
    
    async handleSend() {
        const message = this.userInput.value.trim();
        if (!message || this.isLoading) return;
        
        // Input validation and sanitization
        if (message.length > 1000) {
            this.addSystemMessage('⚠️ Message too long. Please keep it under 1000 characters.');
            return;
        }
        
        // Basic security check for potentially harmful content
        const dangerousPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i];
        if (dangerousPatterns.some(pattern => pattern.test(message))) {
            this.addSystemMessage('⚠️ Message contains potentially harmful content. Please rephrase.');
            return;
        }
        
        // Clear input
        this.userInput.value = '';
        
        // Add user message to chat
        this.addMessage(message, 'user');
        
        // Check for commands
        const command = this.interpretCommand(message);
        
        if (command === 'clear') {
            this.handleClear();
            return;
        } else if (command === 'quit') {
            this.addSystemMessage('Thanks for chatting! Refresh to start again.');
            return;
        }
        
        // Send to AI (simulated)
        await this.sendToAI(message);
    }
    
    interpretCommand(input) {
        const simple = input.toLowerCase().trim();
        if (['c', 'clear', 'reset', 'delete'].includes(simple)) {
            return 'clear';
        } else if (['q', 'quit', 'exit', 'stop', 'bye', 'goodbye'].includes(simple)) {
            return 'quit';
        }
        return 'prompt';
    }
    
    async sendToAI(message) {
        this.setLoading(true);
        
        try {
            // Analyze message complexity
            const complexity = this.analyzeMessageComplexity(message);
            const maxTokens = this.determineMaxTokens(complexity);
            
            // Show complexity analysis as system message (only in debug mode)
            if (this.showComplexityAnalysis) {
                this.addSystemMessage(`📊 Analyzing request: ${complexity} complexity (${maxTokens} tokens)`);
            }
            
            // Add to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: message
            });
            
            // Debug: Log the message being processed
            console.log('Processing message:', message, 'Complexity:', complexity, 'Max tokens:', maxTokens);
            
            // Send to real AI server
            const response = await this.callRealAI(message);
            
            // Debug: Log the response generated
            console.log('Generated response:', response);
            
            // Add AI response
            this.conversationHistory.push({
                role: 'assistant',
                content: response
            });
            
            this.addMessage(response, 'bot');
            this.saveConversationHistory();
            
        } catch (error) {
            console.error('AI Error:', error);
            // Fallback to simulated response if server is down
            const complexity = this.analyzeMessageComplexity(message);
            const fallbackResponse = await this.simulateAIResponse(message);
            this.conversationHistory.push({
                role: 'assistant',
                content: fallbackResponse
            });
            this.addMessage(fallbackResponse, 'bot');
            this.addSystemMessage('Note: Using offline mode. Start server.py for full AI features.');
        } finally {
            this.setLoading(false);
        }
    }
    
    async callRealAI(message) {
        // Input validation on frontend
        if (message.length > 1000) {
            throw new Error('Message too long. Please keep it under 1000 characters.');
        }
        
        // Analyze message complexity and determine appropriate response length
        const complexity = this.analyzeMessageComplexity(message);
        const maxTokens = this.determineMaxTokens(complexity);
        
        // Call the real AI server with dynamic token allocation
        const apiUrl = window.location.hostname === 'localhost' ? 
            'http://localhost:5003/api/chat' : '/api/chat';
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: message,
                maxTokens: maxTokens,
                complexity: complexity
            })
        });
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait before sending another message.');
            } else if (response.status === 400) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Invalid request');
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        }
        
        const data = await response.json();
        return data.response;
    }
    
    // Simulate AI response (replace with actual Groq API call)
    async simulateAIResponse(message) {
        // Analyze message complexity for appropriate response length
        const complexity = this.analyzeMessageComplexity(message);
        const responseLength = this.determineResponseLength(complexity);
        
        // Simulate network delay based on complexity
        const delay = complexity === 'simple' ? 500 : complexity === 'medium' ? 1000 : 1500;
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 500));
        
        const lowerMessage = message.toLowerCase();
        
        // Simple responses for basic questions
        if (complexity === 'simple') {
            if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
                return "Hello! How can I help you?";
            }
            
            if (lowerMessage.includes('yes') || lowerMessage === 'y') {
                return "Great!";
            }
            
            if (lowerMessage.includes('no') || lowerMessage === 'n') {
                return "Okay, no problem.";
            }
            
            if (lowerMessage.includes('thanks') || lowerMessage.includes('thank you')) {
                return "You're welcome!";
            }
            
            if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye')) {
                return "Goodbye! Have a great day!";
            }
            
            if (lowerMessage.includes('ok') || lowerMessage.includes('okay')) {
                return "Understood!";
            }
            
            if (lowerMessage.includes('good') && lowerMessage.includes('morning')) {
                return "Good morning!";
            }
            
            if (lowerMessage.includes('good') && lowerMessage.includes('night')) {
                return "Good night!";
            }
        }
        
        // Medium responses for moderate complexity
        if (complexity === 'medium') {
            if (lowerMessage.includes('how are you')) {
                return "I'm doing well, thanks for asking! I'm here and ready to help with whatever you need.";
            }
            
            if (lowerMessage.includes('weather')) {
                return "I don't have access to current weather data, but I'd be happy to discuss weather patterns or help with weather-related questions.";
            }
            
            if (lowerMessage.includes('time') || lowerMessage.includes('date')) {
                return "I don't have access to real-time information, but you can check your device's clock for the current time and date.";
            }
            
            if (lowerMessage.includes('help')) {
                return "I'm here to help! You can ask me questions, have conversations, or use commands like 'clear' to reset our chat. What would you like assistance with?";
            }
            
            if (lowerMessage.includes('joke') || lowerMessage.includes('funny')) {
                return "Here's a quick one: Why don't scientists trust atoms? Because they make up everything! 😄";
            }
        }
        
        // Detailed responses for complex questions
        if (lowerMessage.includes('javascript') || lowerMessage.includes('js')) {
            return complexity === 'complex' 
                ? "JavaScript is a powerful programming language that's essential for web development. It runs in browsers and on servers (Node.js), enabling interactive websites, mobile apps, and desktop applications. It's known for its flexibility, large ecosystem, and continuous evolution with new features."
                : "JavaScript is a popular programming language used for web development and much more.";
        }
        
        if (lowerMessage.includes('python')) {
            return complexity === 'complex'
                ? "Python is an excellent programming language known for its readability and versatility. It's widely used in web development, data science, artificial intelligence, automation, and scientific computing. Its simple syntax makes it great for beginners, while its powerful libraries make it suitable for complex projects."
                : "Python is a versatile programming language that's great for beginners and powerful for advanced projects.";
        }
        
        if (lowerMessage.includes('ai') || lowerMessage.includes('artificial intelligence')) {
            return complexity === 'complex'
                ? "Artificial Intelligence is a rapidly evolving field that aims to create systems capable of performing tasks that typically require human intelligence. This includes machine learning, natural language processing, computer vision, and robotics. AI applications are transforming industries like healthcare, transportation, and communication."
                : "AI is the development of computer systems that can perform tasks typically requiring human intelligence.";
        }
        
        // Math-related responses with LaTeX
        if (lowerMessage.includes('quadratic formula') || lowerMessage.includes('quadratic equation')) {
            return "The quadratic formula is used to solve equations of the form $ax^2 + bx + c = 0$. The formula is:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$\n\nWhere $a$, $b$, and $c$ are coefficients, and the discriminant $b^2-4ac$ determines the nature of the roots.";
        }
        
        if (lowerMessage.includes('test math') || lowerMessage.includes('math test')) {
            return "Here's a simple math test: $E = mc^2$ and $$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$";
        }
        
        if (lowerMessage.includes('pythagorean theorem') || lowerMessage.includes('pythagorean')) {
            return "The Pythagorean theorem relates the sides of a right triangle:\n\n$$a^2 + b^2 = c^2$$\n\nWhere $c$ is the hypotenuse and $a$ and $b$ are the other two sides.";
        }
        
        if (lowerMessage.includes('integral') || lowerMessage.includes('integration')) {
            return "Integration is a fundamental concept in calculus. For example, the integral of $x^n$ is:\n\n$$\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$$\n\nwhere $C$ is the constant of integration and $n \\neq -1$.";
        }
        
        if (lowerMessage.includes('derivative') || lowerMessage.includes('differentiation')) {
            return "Derivatives measure the rate of change. The power rule states:\n\n$$\\frac{d}{dx}x^n = nx^{n-1}$$\n\nFor example: $\\frac{d}{dx}x^3 = 3x^2$";
        }
        
        if (lowerMessage.includes('limit') || lowerMessage.includes('limits')) {
            return "Limits are fundamental to calculus. A famous limit is:\n\n$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\n\nThis limit is essential for proving the derivative of $\\sin x$.";
        }
        
        if (lowerMessage.includes('euler') || lowerMessage.includes('e^x')) {
            return "Euler's formula is one of the most beautiful equations in mathematics:\n\n$$e^{i\\pi} + 1 = 0$$\n\nIt connects five fundamental mathematical constants: $e$, $i$, $\\pi$, $1$, and $0$.";
        }
        
        if (lowerMessage.includes('cat') || lowerMessage.includes('kitten')) {
            return complexity === 'complex'
                ? "Cats are fascinating creatures with a rich history alongside humans. They've been domesticated for over 9,000 years and are known for their independence, agility, and unique behaviors. Cats communicate through various sounds, body language, and scent marking, making them complex and interesting companions."
                : "Cats are wonderful, independent pets that have been human companions for thousands of years.";
        }
        
        // Default responses based on complexity
        const simpleDefaults = [
            "I see.",
            "That's interesting.",
            "Tell me more.",
            "I understand.",
            "Okay!"
        ];
        
        const mediumDefaults = [
            "That's an interesting topic! What specific aspect would you like to explore?",
            "I'd be happy to discuss that with you. What would you like to know?",
            "That's worth exploring further. Can you tell me more about what interests you?",
            "Interesting question! I'd love to hear your thoughts on this."
        ];
        
        const complexDefaults = [
            "That's a fascinating topic with many dimensions to consider. The subject touches on various aspects that could be explored from different perspectives. What particular angle or aspect interests you most, and would you like me to dive deeper into any specific area?",
            "This is a complex and interesting subject that has multiple layers worth exploring. There are various approaches and viewpoints to consider, each offering unique insights. I'd be happy to discuss this in detail - what specific aspects would you like to focus on?",
            "This topic opens up many interesting avenues for discussion. It's the kind of subject that can be approached from multiple angles, each revealing different insights and perspectives. What draws you to this particular area, and where would you like to start our exploration?"
        ];
        
        if (complexity === 'simple') {
            return simpleDefaults[Math.floor(Math.random() * simpleDefaults.length)];
        } else if (complexity === 'medium') {
            return mediumDefaults[Math.floor(Math.random() * mediumDefaults.length)];
        } else {
            return complexDefaults[Math.floor(Math.random() * complexDefaults.length)];
        }
    }
    
    analyzeMessageComplexity(message) {
        const text = message.toLowerCase().trim();
        const wordCount = text.split(' ').length;
        
        // Simple indicators
        const simplePatterns = [
            /^(hi|hello|hey|yes|no|ok|okay|thanks|bye|good morning|good night)$/,
            /^(y|n)$/
        ];
        
        // Complex indicators
        const complexIndicators = [
            'explain', 'analyze', 'compare', 'contrast', 'evaluate', 'discuss',
            'elaborate', 'describe in detail', 'what are the implications',
            'how does this work', 'why is this important', 'what are the benefits',
            'what are the differences', 'how can i', 'best practices',
            'step by step', 'comprehensive', 'detailed explanation', 'tell me about',
            'talk about', 'everything about'
        ];
        
        // Topics that often need detailed responses
        const detailedTopics = [
            'animal', 'bird', 'duck', 'cat', 'dog', 'wildlife', 'nature', 'species',
            'habitat', 'science', 'history', 'technology', 'programming', 'biology',
            'physics', 'chemistry', 'mathematics', 'geography', 'literature'
        ];
        
        // Question words that often lead to complex responses
        const complexQuestionWords = ['why', 'how', 'what are', 'what is', 'explain'];
        
        // Check for simple patterns first
        if (simplePatterns.some(pattern => pattern.test(text))) {
            return 'simple';
        }
        
        // Check for complex indicators
        if (complexIndicators.some(indicator => text.includes(indicator))) {
            return 'complex';
        }
        
        // Check for topics that typically need detailed responses
        if (detailedTopics.some(topic => text.includes(topic))) {
            return 'complex';
        }
        
        // Check for complex question patterns
        if (complexQuestionWords.some(word => text.startsWith(word)) && wordCount > 3) {
            return 'complex';
        }
        
        // Length-based classification with adjusted thresholds
        if (wordCount <= 2) {
            return 'simple';
        } else if (wordCount <= 6) {
            return 'medium';
        } else {
            return 'complex';
        }
    }
    
    determineMaxTokens(complexity) {
        switch (complexity) {
            case 'simple':
                return 150;  // Increased from 50
            case 'medium':
                return 400;  // Increased from 150
            case 'complex':
                return 600;  // Increased from 300
            default:
                return 400;  // Increased default
        }
    }
    
    determineResponseLength(complexity) {
        // This is used for the simulated responses to guide length
        switch (complexity) {
            case 'simple':
                return 'brief';
            case 'medium':
                return 'moderate';
            case 'complex':
                return 'detailed';
            default:
                return 'moderate';
        }
    }
        

    
    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Process markdown but preserve LaTeX
        const cleanContent = content
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // Bold **text**
            .replace(/\*([^*]+)\*/g, '<em>$1</em>') // Italic *text*
            .replace(/^\* /gm, '• ') // Convert * to bullet points
            .replace(/\n/g, '<br>'); // Convert newlines to <br>
        
        contentDiv.innerHTML = cleanContent;
        
        messageDiv.appendChild(contentDiv);
        this.chatHistory.appendChild(messageDiv);
        
        // Render LaTeX with KaTeX - multiple approaches for reliability
        this.renderMath(contentDiv);
        
        // Scroll to bottom
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
    
    renderMath(element) {
        // Wait for KaTeX to be available
        const tryRender = () => {
            if (typeof renderMathInElement === 'undefined' || typeof katex === 'undefined') {
                console.log('KaTeX not ready yet...');
                return false;
            }
            
            try {
                console.log('Rendering math in element:', element);
                renderMathInElement(element, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ],
                    throwOnError: false,
                    trust: true
                });
                console.log('KaTeX rendering completed successfully');
                return true;
            } catch (error) {
                console.error('KaTeX rendering error:', error);
                return false;
            }
        };
        
        // Try immediately
        if (!tryRender()) {
            // Wait and try again in case KaTeX is still loading
            setTimeout(() => {
                if (!tryRender()) {
                    console.log('KaTeX rendering failed after retry');
                }
            }, 100);
        }
    }
    
    addSystemMessage(content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = content;
        
        this.chatHistory.appendChild(messageDiv);
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }
    
    
    toggleHistoryDropdown() {
        this.isHistoryOpen = !this.isHistoryOpen;
        
        if (this.isHistoryOpen) {
            this.updateHistoryContent();
            this.historyList.classList.add('open');
            this.historyToggle.classList.add('open');
        } else {
            this.historyList.classList.remove('open');
            this.historyToggle.classList.remove('open');
        }
    }
    
    updateHistoryContent() {
        if (this.conversationHistory.length === 0) {
            this.historyContent.innerHTML = '<p style="color: #666; font-style: italic; padding: 10px;">No conversation history yet. Start a conversation!</p>';
            return;
        }
        
        let historyHTML = `<div style="margin-bottom: 15px; padding: 10px; background: rgba(0, 122, 255, 0.1); border-radius: 6px; border-left: 3px solid #007AFF;">
            <strong style="color: #007AFF;">${this.conversationHistory.length} messages</strong> in this conversation
        </div>`;
        
        // Show recent messages in the dropdown
        const recentMessages = this.conversationHistory.slice(-5);
        recentMessages.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'You' : 'AI';
            const content = msg.content.length > 80 ? 
                msg.content.substring(0, 80) + '...' : msg.content;
            
            historyHTML += `
                <div style="margin-bottom: 10px; padding: 8px; background: rgba(40, 40, 40, 0.5); border-radius: 4px; border-left: 2px solid ${msg.role === 'user' ? '#007AFF' : '#666'};">
                    <strong style="color: ${msg.role === 'user' ? '#007AFF' : '#ccc'}; font-size: 11px;">${role}:</strong>
                    <p style="margin: 2px 0 0 0; font-size: 12px; line-height: 1.3; color: #ccc;">${content}</p>
                </div>
            `;
        });
        
        if (this.conversationHistory.length > 5) {
            historyHTML += `<p style="color: #666; font-style: italic; font-size: 11px; text-align: center; margin-top: 10px;">Showing last 5 messages</p>`;
        }
        
        this.historyContent.innerHTML = historyHTML;
    }
    
    handleClear() {
        this.chatHistory.innerHTML = '';
        this.conversationHistory = [];
        this.saveConversationHistory();
        this.addMessage('Hello! I\'m your AI assistant. What would you like to talk about?', 'bot');
        this.addSystemMessage('Conversation history cleared.');
        
        // Update history dropdown if open
        if (this.isHistoryOpen) {
            this.updateHistoryContent();
        }
    }
    
    setLoading(loading) {
        this.isLoading = loading;
        this.userInput.disabled = loading;
        this.userInput.placeholder = loading ? 'AI is thinking...' : 'Type your message and press Enter...';
    }
    
    saveConversationHistory() {
        try {
            localStorage.setItem('aiChatHistory', JSON.stringify(this.conversationHistory));
        } catch (error) {
            console.error('Error saving conversation history:', error);
        }
    }
    
    loadConversationHistory() {
        try {
            const saved = localStorage.getItem('aiChatHistory');
            if (saved) {
                this.conversationHistory = JSON.parse(saved);
                
                // Restore chat display (limit to last 20 for performance)
                const recentHistory = this.conversationHistory.slice(-20);
                this.chatHistory.innerHTML = '';
                
                recentHistory.forEach(msg => {
                    if (msg.role === 'user') {
                        this.addMessage(msg.content, 'user');
                    } else if (msg.role === 'assistant') {
                        this.addMessage(msg.content, 'bot');
                    }
                });
                
                // Only add welcome message if no history exists
                if (recentHistory.length === 0) {
                    this.addMessage('Hello! I\'m your AI assistant. What would you like to talk about?', 'bot');
                }
            } else {
                // Fresh start - add welcome message
                this.addMessage('Hello! I\'m your AI assistant. What would you like to talk about?', 'bot');
            }
        } catch (error) {
            console.error('Error loading conversation history:', error);
            this.addMessage('Hello! I\'m your AI assistant. What would you like to talk about?', 'bot');
        }
    }
}

// Initialize the chat bot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIChatBot();
});
