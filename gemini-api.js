class GeminiAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    }

    async generateCode(prompt, language = 'python') {
        const systemPrompt = `You are an expert ${language} developer. Generate clean, efficient code based on the user's request. Only return the code without explanations unless asked.`;
        
        return await this.makeRequest(`${systemPrompt}\n\nUser request: ${prompt}`);
    }

    async reviewCode(code, language = 'python') {
        const prompt = `Review this ${language} code for bugs, security issues, and improvements:\n\n${code}\n\nProvide specific feedback and suggestions.`;
        
        return await this.makeRequest(prompt);
    }

    async explainCode(code, language = 'python') {
        const prompt = `Explain this ${language} code in simple terms:\n\n${code}\n\nBreak down what each part does.`;
        
        return await this.makeRequest(prompt);
    }

    async debugCode(code, error, language = 'python') {
        const prompt = `Help debug this ${language} code that's producing an error:\n\nCode:\n${code}\n\nError:\n${error}\n\nProvide the fix and explanation.`;
        
        return await this.makeRequest(prompt);
    }

    async makeRequest(prompt) {
        try {
            const response = await fetch(`${this.baseURL}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Gemini API Error:', error);
            return `Error: ${error.message}. Please check your API key and try again.`;
        }
    }
}

// Enhanced FlowMind IDE with Gemini integration
class EnhancedFlowMindIDE extends FlowMindIDE {
    constructor() {
        super();
        this.gemini = null;
        this.setupGeminiAPI();
    }

    setupGeminiAPI() {
        // Get API key from user or environment
        const apiKey = localStorage.getItem('gemini_api_key') || prompt('Enter your Gemini API key:');
        
        if (apiKey) {
            this.gemini = new GeminiAPI(apiKey);
            localStorage.setItem('gemini_api_key', apiKey);
            this.addAIMessage('Gemini API connected successfully!', 'ai');
        } else {
            this.addAIMessage('No API key provided. Using demo mode.', 'ai');
        }
    }

    async handleAIResponse(prompt) {
        if (!this.gemini) {
            super.handleAIResponse(prompt);
            return;
        }

        this.addAIMessage('Thinking...', 'ai');

        try {
            const response = await this.gemini.makeRequest(prompt);
            this.replaceLastAIMessage(response);
        } catch (error) {
            this.replaceLastAIMessage(`Error: ${error.message}`);
        }
    }

    async handleAITool(action) {
        if (!this.gemini) {
            super.handleAITool(action);
            return;
        }

        const code = this.editor.getValue();
        const language = this.getLanguageFromFile(this.currentFile);

        this.addAIMessage('Processing...', 'ai');

        try {
            let response;
            switch (action) {
                case 'generate':
                    const prompt = window.prompt('What code would you like me to generate?');
                    if (prompt) {
                        response = await this.gemini.generateCode(prompt, language);
                    }
                    break;
                case 'review':
                    response = await this.gemini.reviewCode(code, language);
                    break;
                case 'explain':
                    response = await this.gemini.explainCode(code, language);
                    break;
                case 'debug':
                    const error = window.prompt('What error are you seeing?');
                    if (error) {
                        response = await this.gemini.debugCode(code, error, language);
                    }
                    break;
            }

            if (response) {
                this.replaceLastAIMessage(response);
                
                // If it's code generation, offer to insert the code
                if (action === 'generate' && response.includes('```')) {
                    setTimeout(() => {
                        if (confirm('Would you like to insert this code into your editor?')) {
                            const codeMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
                            if (codeMatch) {
                                this.editor.setValue(codeMatch[1]);
                            }
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            this.replaceLastAIMessage(`Error: ${error.message}`);
        }
    }

    getLanguageFromFile(fileName) {
        const ext = fileName.split('.').pop();
        const languages = {
            'py': 'python',
            'js': 'javascript',
            'html': 'html',
            'css': 'css',
            'java': 'java',
            'cpp': 'c++',
            'c': 'c',
            'go': 'go',
            'rs': 'rust'
        };
        return languages[ext] || 'python';
    }

    replaceLastAIMessage(text) {
        const messages = document.querySelectorAll('.ai-message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage) {
            lastMessage.textContent = text;
        }
    }
}

// Use enhanced version if available
if (typeof FlowMindIDE !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        new EnhancedFlowMindIDE();
    });
}