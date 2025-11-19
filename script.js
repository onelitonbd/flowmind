class FlowMindIDE {
    constructor() {
        this.editor = null;
        this.currentFile = null;
        this.files = {};
        this.firebaseManager = null;
        this.currentProject = null;
        this.currentFolder = null;
        this.projectStructure = { folders: {}, files: {} };
        this.init();
    }

    async init() {
        this.setupEditor();
        this.setupEventListeners();
        await this.initFirebase();
        await this.loadAllFiles();
    }
    
    async initFirebase() {
        try {
            // Check if Firebase is available
            if (typeof firebase === 'undefined') {
                console.error('Firebase not loaded');
                this.loadLocalFiles();
                return;
            }
            
            const userId = 'my-personal-workspace';
            this.firebaseManager = new FirebaseFileManager(userId);
            console.log('Firebase initialized for personal workspace');
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.loadLocalFiles();
        }
    }
    
    async loadAllFiles() {
        if (this.firebaseManager) {
            // Don't auto-load files, wait for project selection
            this.updateFileTree();
        }
    }
    

    
    async loadProject() {
        if (!this.firebaseManager) {
            alert('Firebase not initialized');
            return;
        }
        
        const projects = await this.firebaseManager.getUserProjects();
        
        if (projects.length === 0) {
            alert('No projects found');
            return;
        }
        
        this.showProjectSelector(projects);
    }
    
    showProjectSelector(projects) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'project-modal';
        modal.innerHTML = `
            <div class="project-modal-content">
                <div class="project-modal-header">
                    <h3>Select Project</h3>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="project-list">
                    ${projects.map(project => `
                        <div class="project-item" data-project="${project}">
                            <i class="fas fa-folder"></i>
                            <span>${project}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.close-btn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        modal.querySelectorAll('.project-item').forEach(item => {
            item.addEventListener('click', async () => {
                const projectName = item.dataset.project;
                await this.switchToProject(projectName);
                document.body.removeChild(modal);
            });
        });
    }
    
    async switchToProject(projectName) {
        this.firebaseManager.setProject(projectName);
        this.currentProject = projectName;
        this.currentFolder = null;
        
        // Load project structure and files
        this.projectStructure = await this.firebaseManager.loadProjectStructure();
        this.files = await this.firebaseManager.loadAllFiles();
        
        // Load chat history for this project
        await this.loadChatHistory();
        
        this.showProjectHeader(projectName);
        this.updateFileTree();
        
        // Load first file if available
        const fileNames = Object.keys(this.files);
        if (fileNames.length > 0) {
            this.selectFile(fileNames[0]);
        } else {
            // Clear editor if no files
            if (this.editor) {
                this.editor.setValue('');
            }
            document.getElementById('currentPath').textContent = 'No files';
        }
        
        console.log(`Loaded project: ${projectName}`);
    }
    
    async createNewProject() {
        const projectName = prompt('Enter project name:');
        if (projectName && this.firebaseManager) {
            const success = await this.firebaseManager.createProject(projectName);
            if (success) {
                // Immediately load the new project
                await this.switchToProject(projectName);
                console.log(`Created and loaded project: ${projectName}`);
            }
        }
    }
    
    showProjectHeader(projectName) {
        document.getElementById('projectHeader').style.display = 'block';
        document.getElementById('currentProjectName').textContent = projectName;
    }
    
    updateFileTree() {
        const fileTree = document.getElementById('fileTree');
        if (!this.currentProject) {
            fileTree.innerHTML = '<div class="empty-state">No project selected</div>';
            return;
        }
        
        fileTree.innerHTML = '';
        this.renderTreeStructure(this.projectStructure, fileTree, 0);
    }
    
    renderTreeStructure(structure, container, level, parentPath = '') {
        // Render folders first
        Object.keys(structure.folders || {}).forEach(folderName => {
            const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
            const folderItem = this.createTreeItem(folderName, 'folder', level, folderPath);
            container.appendChild(folderItem);
            
            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            folderItem.appendChild(childContainer);
            
            this.renderTreeStructure(structure.folders[folderName], childContainer, level + 1, folderPath);
        });
        
        // Render files
        Object.keys(structure.files || {}).forEach(fileName => {
            const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
            const fileItem = this.createTreeItem(fileName, 'file', level, filePath);
            container.appendChild(fileItem);
        });
    }
    
    createTreeItem(name, type, level, fullPath = name) {
        const item = document.createElement('div');
        item.className = `tree-item ${type}`;
        item.dataset.level = level;
        item.dataset.name = name;
        item.dataset.type = type;
        item.dataset.fullPath = fullPath;
        
        const expand = document.createElement('span');
        expand.className = 'tree-expand';
        expand.innerHTML = type === 'folder' ? '▶' : '';
        
        const icon = document.createElement('i');
        icon.className = `tree-icon ${type === 'folder' ? 'fas fa-folder' : this.getFileIcon(name)}`;
        
        const label = document.createElement('span');
        label.textContent = name;
        
        item.appendChild(expand);
        item.appendChild(icon);
        item.appendChild(label);
        
        // Add click handlers
        if (type === 'folder') {
            expand.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFolder(item);
            });
            item.addEventListener('click', () => this.selectFolder(fullPath));
        } else {
            item.addEventListener('click', () => this.selectFile(fullPath));
        }
        
        return item;
    }
    
    toggleFolder(folderItem) {
        const expand = folderItem.querySelector('.tree-expand');
        const children = folderItem.querySelector('.tree-children');
        
        if (children.classList.contains('expanded')) {
            children.classList.remove('expanded');
            expand.classList.remove('expanded');
        } else {
            children.classList.add('expanded');
            expand.classList.add('expanded');
        }
    }
    
    selectFolder(folderPath) {
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.closest('.tree-item').classList.add('active');
        this.currentFolder = folderPath;
        console.log(`Selected folder: ${folderPath}`);
    }
    
    loadLocalFiles() {
        const saved = localStorage.getItem('flowmind-files');
        if (saved) {
            this.files = JSON.parse(saved);
        } else {
            this.files = {
                'main.py': '# Welcome to FlowMind!\n# Your AI-powered coding workspace\n\ndef hello_world():\n    print("Hello from FlowMind!")\n\nif __name__ == "__main__":\n    hello_world()'
            };
        }
        this.updateFileExplorer();
        this.selectFile('main.py');
    }

    setupEditor() {
        this.editor = CodeMirror(document.getElementById('codeEditor'), {
            lineNumbers: true,
            theme: 'monokai',
            mode: 'python',
            indentUnit: 4,
            lineWrapping: true,
            autoCloseBrackets: true,
            matchBrackets: true
        });

        this.editor.on('change', () => {
            this.files[this.currentFile] = this.editor.getValue();
        });
    }

    setupEventListeners() {
        // File operations
        const newFile = document.getElementById('newFile');
        const newProject = document.getElementById('newProject');
        const newFileBtn = document.getElementById('newFileBtn');
        const newFolder = document.getElementById('newFolder');
        const loadProject = document.getElementById('loadProject');
        
        if (newFile) newFile.addEventListener('click', () => this.createNewFile());
        if (newProject) newProject.addEventListener('click', () => this.createNewProject());
        if (newFileBtn) newFileBtn.addEventListener('click', () => this.createNewFile());
        if (newFolder) newFolder.addEventListener('click', () => this.createNewFolder());
        if (loadProject) loadProject.addEventListener('click', () => this.loadProject());
        document.getElementById('runCode').addEventListener('click', () => this.runCode());
        document.getElementById('runInTab').addEventListener('click', () => this.runInNewTab());
        document.getElementById('stopCode').addEventListener('click', () => this.stopCode());
        document.getElementById('saveFile').addEventListener('click', () => this.saveFile());
        document.getElementById('formatCode').addEventListener('click', () => this.formatCode());
        const findReplace = document.getElementById('findReplace');
        const settings = document.getElementById('settings');
        
        if (findReplace) findReplace.addEventListener('click', () => this.showFindReplace());
        if (settings) settings.addEventListener('click', () => this.showSettings());
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Gemini chat interactions
        const sendGemini = document.getElementById('sendGemini');
        const geminiInput = document.getElementById('geminiInput');
        const clearChat = document.getElementById('clearChat');
        const clearTerminal = document.getElementById('clearTerminal');
        const toggleAI = document.getElementById('toggleAI');
        
        if (sendGemini) sendGemini.addEventListener('click', () => this.sendGeminiMessage());
        if (geminiInput) {
            geminiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendGeminiMessage();
                }
            });
            
            // Auto-resize textarea
            geminiInput.addEventListener('input', () => {
                geminiInput.style.height = 'auto';
                geminiInput.style.height = Math.min(geminiInput.scrollHeight, 120) + 'px';
            });
        }
        
        if (clearChat) clearChat.addEventListener('click', () => this.clearGeminiChat());
        
        // Additional Gemini controls
        const refreshChat = document.getElementById('refreshChat');
        const aiSettings = document.getElementById('aiSettings');
        
        if (refreshChat) refreshChat.addEventListener('click', () => this.refreshGeminiChat());
        if (aiSettings) aiSettings.addEventListener('click', () => this.showAISettings());
        
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });



        // Terminal
        if (clearTerminal) clearTerminal.addEventListener('click', () => this.clearTerminal());

        // AI panel toggle
        if (toggleAI) toggleAI.addEventListener('click', () => this.toggleAIPanel());

        // Activity bar switching
        const activityItems = document.querySelectorAll('.activity-item');
        if (activityItems.length > 0) {
            activityItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    const panel = e.currentTarget.dataset.panel;
                    this.switchPanel(panel);
                });
            });
        }
        
        // File selection
        document.addEventListener('click', (e) => {
            if (e.target && (e.target.classList.contains('file-item') || e.target.closest('.file-item'))) {
                const fileItem = e.target.closest('.file-item') || e.target;
                if (fileItem && fileItem.dataset && fileItem.dataset.file) {
                    this.selectFile(fileItem.dataset.file);
                }
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.showCommandPalette();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                this.saveFile();
            }
        });
    }

    async createNewFile() {
        if (!this.currentProject) {
            alert('Please create or select a project first');
            return;
        }
        
        const fileName = prompt('Enter file name:');
        if (fileName && !this.files[fileName]) {
            const filePath = this.currentFolder ? `${this.currentFolder}/${fileName}` : fileName;
            
            this.files[filePath] = '';
            await this.saveFileToFirebase(filePath, '');
            
            // Update structure
            if (this.currentFolder) {
                if (!this.projectStructure.folders[this.currentFolder]) {
                    this.projectStructure.folders[this.currentFolder] = { folders: {}, files: {} };
                }
                this.projectStructure.folders[this.currentFolder].files[fileName] = true;
            } else {
                this.projectStructure.files[fileName] = true;
            }
            
            await this.firebaseManager.saveProjectStructure(this.projectStructure);
            this.updateFileTree();
            this.selectFile(filePath);
        }
    }
    
    async createNewFolder() {
        if (!this.currentProject) {
            alert('Please create or select a project first');
            return;
        }
        
        const folderName = prompt('Enter folder name:');
        if (folderName) {
            const folderPath = this.currentFolder ? `${this.currentFolder}/${folderName}` : folderName;
            
            // Update structure
            if (this.currentFolder) {
                if (!this.projectStructure.folders[this.currentFolder]) {
                    this.projectStructure.folders[this.currentFolder] = { folders: {}, files: {} };
                }
                this.projectStructure.folders[this.currentFolder].folders[folderName] = { folders: {}, files: {} };
            } else {
                this.projectStructure.folders[folderName] = { folders: {}, files: {} };
            }
            
            await this.firebaseManager.saveProjectStructure(this.projectStructure);
            this.updateFileTree();
            console.log(`Created folder: ${folderName}`);
        }
    }
    
    addFolderToExplorer(folderName) {
        const fileList = document.getElementById('fileList');
        const folderItem = document.createElement('div');
        folderItem.className = 'file-item folder-item';
        folderItem.innerHTML = `<i class="fas fa-folder file-icon"></i>${folderName}`;
        fileList.appendChild(folderItem);
    }

    addFileToExplorer(fileName) {
        const fileList = document.getElementById('fileList');
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.file = fileName;
        
        const iconClass = this.getFileIcon(fileName);
        fileItem.innerHTML = `<i class="${iconClass} file-icon"></i>${fileName}`;
        
        fileList.appendChild(fileItem);
    }

    getFileIcon(fileName) {
        const ext = fileName.split('.').pop();
        const icons = {
            'py': 'fab fa-python',
            'js': 'fab fa-js-square',
            'html': 'fab fa-html5',
            'css': 'fab fa-css3-alt',
            'json': 'fas fa-file-code',
            'md': 'fab fa-markdown',
            'java': 'fab fa-java',
            'cpp': 'fas fa-file-code',
            'c': 'fas fa-file-code',
            'go': 'fas fa-file-code',
            'rs': 'fas fa-file-code'
        };
        return icons[ext] || 'fas fa-file';
    }

    selectFile(fileName) {
        // Update tree selection
        document.querySelectorAll('.tree-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const fileItem = document.querySelector(`[data-name="${fileName.split('/').pop()}"][data-type="file"]`);
        if (fileItem) {
            fileItem.classList.add('active');
        }

        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        let tab = document.querySelector(`.tab[data-file="${fileName}"]`);
        if (!tab) {
            tab = this.createTab(fileName);
        }
        tab.classList.add('active');

        // Update current file box
        const displayName = fileName.split('/').pop();
        document.getElementById('currentPath').textContent = displayName;
        const iconElement = document.getElementById('currentFileIcon');
        iconElement.className = this.getFileIcon(displayName);

        // Load file content
        this.loadFile(fileName);
    }

    createTab(fileName) {
        const tabsContainer = document.querySelector('.editor-tabs');
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.file = fileName;
        const iconClass = this.getFileIcon(fileName);
        tab.innerHTML = `<i class="${iconClass}"></i> ${fileName}`;
        tabsContainer.appendChild(tab);
        return tab;
    }

    loadFile(fileName) {
        this.currentFile = fileName;
        const content = this.files[fileName] || '';
        this.editor.setValue(content);
        
        // Set editor mode based on file extension
        const ext = fileName.split('.').pop();
        const modes = {
            'py': 'python',
            'js': 'javascript',
            'html': 'htmlmixed',
            'css': 'css',
            'json': 'javascript'
        };
        this.editor.setOption('mode', modes[ext] || 'text');
    }

    runCode() {
        const code = this.editor.getValue();
        const fileName = this.currentFile;
        
        // Show stop button
        document.getElementById('runCode').style.display = 'none';
        document.getElementById('stopCode').style.display = 'flex';
        
        this.addTerminalLine(`<i class="fas fa-play"></i> Running ${fileName}...`, 'info');
        this.updateAIStatus('Running code');
        
        // Simulate code execution
        setTimeout(() => {
            if (fileName.endsWith('.py')) {
                this.simulatePythonExecution(code);
            } else if (fileName.endsWith('.js')) {
                this.simulateJSExecution(code);
            } else {
                this.addTerminalLine('File type not supported for execution', 'error');
            }
            
            // Reset buttons
            document.getElementById('runCode').style.display = 'flex';
            document.getElementById('stopCode').style.display = 'none';
            this.updateAIStatus('Execution complete');
        }, 2000);
    }

    simulatePythonExecution(code) {
        try {
            // Simple simulation - look for print statements
            const printMatches = code.match(/print\s*\(\s*["']([^"']+)["']\s*\)/g);
            if (printMatches) {
                printMatches.forEach(match => {
                    const text = match.match(/["']([^"']+)["']/)[1];
                    this.addTerminalLine(text);
                });
            } else {
                this.addTerminalLine('Code executed successfully');
            }
        } catch (error) {
            this.addTerminalLine(`Error: ${error.message}`, 'error');
        }
    }

    simulateJSExecution(code) {
        try {
            // Capture console.log outputs
            const originalLog = console.log;
            const outputs = [];
            console.log = (...args) => outputs.push(args.join(' '));
            
            eval(code);
            
            console.log = originalLog;
            outputs.forEach(output => this.addTerminalLine(output));
            
            if (outputs.length === 0) {
                this.addTerminalLine('Code executed successfully');
            }
        } catch (error) {
            this.addTerminalLine(`Error: ${error.message}`, 'error');
        }
    }

    addTerminalLine(text, type = '') {
        const terminal = document.getElementById('terminalOutput');
        if (!terminal) {
            console.log(`Terminal: ${text}`);
            return;
        }
        
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        line.innerHTML = `<span style="color: var(--text-secondary); font-size: 11px;">[${timestamp}]</span> ${text}`;
        
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    clearTerminal() {
        document.getElementById('terminalOutput').innerHTML = '<div class="terminal-line">Terminal cleared</div>';
    }

    async sendGeminiMessage() {
        const input = document.getElementById('geminiInput');
        const message = input.value.trim();
        
        if (!message) return;
        if (!this.currentProject) {
            alert('Please select a project first');
            return;
        }
        
        this.addGeminiMessage(message, 'user');
        input.value = '';
        input.style.height = 'auto';
        this.showLoading(true);
        
        try {
            const response = await this.callGeminiAPI(message);
            this.showLoading(false);
            this.addGeminiMessage(response, 'ai');
            await this.processAICommands(response);
            await this.saveChatHistory();
        } catch (error) {
            this.showLoading(false);
            this.addGeminiMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }
    
    addGeminiMessage(text, sender, shouldSave = true) {
        const chat = document.getElementById('geminiChat');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        content.appendChild(messageText);
        messageDiv.appendChild(content);
        
        chat.appendChild(messageDiv);
        chat.scrollTop = chat.scrollHeight;
    }
    
    async callGeminiAPI(prompt) {
        if (!this.currentProject) {
            throw new Error('No project selected');
        }
        
        const currentCode = this.editor ? this.editor.getValue() : '';
        const currentFile = this.currentFile || 'No file selected';
        
        // Build project context
        const projectFiles = Object.keys(this.files).map(fileName => {
            const content = this.files[fileName];
            const preview = content.length > 200 ? content.substring(0, 200) + '...' : content;
            return `${fileName}: ${preview}`;
        }).join('\n\n');
        
        const systemPrompt = `You are a coding assistant for FlowMind IDE.

Project: ${this.currentProject}
Current file: ${currentFile}

Project files:
${projectFiles}

Current file content:
${currentCode}

You can create and edit files within this project only. Commands:
- CREATE_FILE:filename.ext:content (creates new file in current project)
- EDIT_FILE:new_content (edits the currently open file)

User: ${prompt}`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=AIzaSyBi-uSfSnB4NjnF-ENcEpmYwAlveKZgi4w`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });
        
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
    
    async createFileFromAI(fileName, content) {
        if (!this.currentProject) {
            this.addGeminiMessage('Please create or select a project first.', 'ai');
            return false;
        }
        
        this.files[fileName] = content;
        await this.saveFileToFirebase(fileName, content);
        
        if (!this.projectStructure.files) this.projectStructure.files = {};
        this.projectStructure.files[fileName] = true;
        await this.firebaseManager.saveProjectStructure(this.projectStructure);
        
        this.updateFileTree();
        this.selectFile(fileName);
        return true;
    }
    
    async editFileFromAI(content) {
        if (!this.currentFile) {
            this.addGeminiMessage('Please select a file to edit.', 'ai');
            return false;
        }
        
        this.files[this.currentFile] = content;
        await this.saveFileToFirebase(this.currentFile, content);
        this.editor.setValue(content);
        return true;
    }
    
    async processAICommands(response) {
        const createMatch = response.match(/CREATE_FILE:([^:]+):([\s\S]*?)(?=\n\n|$)/);
        const editMatch = response.match(/EDIT_FILE:([\s\S]*?)(?=\n\n|$)/);
        
        if (createMatch) {
            const [, fileName, content] = createMatch;
            await this.createFileFromAI(fileName.trim(), content.trim());
        }
        
        if (editMatch) {
            const [, content] = editMatch;
            await this.editFileFromAI(content.trim());
        }
    }
    
    async loadChatHistory() {
        if (!this.firebaseManager || !this.currentProject) return;
        
        try {
            const chatHistory = await this.firebaseManager.loadChatHistory();
            const chat = document.getElementById('geminiChat');
            
            if (chatHistory && chatHistory.length > 0) {
                chat.innerHTML = '';
                chatHistory.forEach(msg => {
                    this.addGeminiMessage(msg.text, msg.sender, false);
                });
            } else {
                chat.innerHTML = `
                    <div class="chat-message ai-message">
                        <div class="message-content">
                            <div class="message-text">👋 Hi! I'm Gemini, your AI coding assistant for ${this.currentProject}.</div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }
    
    async saveChatHistory() {
        if (!this.firebaseManager || !this.currentProject) return;
        
        try {
            const chat = document.getElementById('geminiChat');
            const messages = [];
            
            chat.querySelectorAll('.chat-message').forEach(msgEl => {
                const text = msgEl.querySelector('.message-text').textContent;
                const sender = msgEl.classList.contains('user-message') ? 'user' : 'ai';
                messages.push({ text, sender, timestamp: Date.now() });
            });
            
            await this.firebaseManager.saveChatHistory(messages);
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }
    
    async clearGeminiChat() {
        const chat = document.getElementById('geminiChat');
        chat.innerHTML = `
            <div class="chat-message ai-message">
                <div class="message-content">
                    <div class="message-text">Chat cleared! I can help you create files, edit code, and answer questions for ${this.currentProject}.</div>
                </div>
            </div>
        `;
        
        if (this.currentProject) {
            await this.saveChatHistory();
        }
    }
    
    handleQuickAction(action) {
        const currentCode = this.editor ? this.editor.getValue() : '';
        
        const prompts = {
            'explain': `Explain this code:\n\n\`\`\`\n${currentCode}\n\`\`\``,
            'optimize': `Optimize this code and use EDIT_FILE to update it:\n\n\`\`\`\n${currentCode}\n\`\`\``,
            'debug': `Debug this code and fix any issues using EDIT_FILE:\n\n\`\`\`\n${currentCode}\n\`\`\``,
            'generate': 'Generate code for: '
        };
        
        const prompt = prompts[action];
        if (prompt) {
            if (action === 'generate') {
                const description = window.prompt('What code would you like me to generate? (I can create a new file)');
                if (description) {
                    this.sendGeminiMessageWithText(prompt + description + '. Use CREATE_FILE to create it.');
                }
            } else {
                this.sendGeminiMessageWithText(prompt);
            }
        }
    }
    
    async sendGeminiMessageWithText(text) {
        this.addGeminiMessage(text, 'user');
        this.showLoading(true);
        
        try {
            const response = await this.callGeminiAPI(text);
            this.showLoading(false);
            this.addGeminiMessage(response, 'ai');
            await this.processAICommands(response);
        } catch (error) {
            this.showLoading(false);
            this.addGeminiMessage('Sorry, I encountered an error. Please try again.', 'ai');
        }
    }
    
    showLoading(show = true) {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    
    refreshGeminiChat() {
        this.clearGeminiChat();
    }
    
    showAISettings() {
        alert('AI Settings coming soon!');
    }

    handleAIResponse(prompt) {
        const responses = {
            'hello': 'Hello! I\'m your AI coding assistant. I can help you write, review, and debug code.',
            'help': 'I can help you with:\n• Generate code from descriptions\n• Review your code for issues\n• Explain complex code\n• Debug errors\n• Suggest improvements',
            'generate': 'What kind of code would you like me to generate? Please describe the functionality you need.',
            'review': 'I\'ll review your current code for potential issues and improvements.',
            'explain': 'I\'ll explain the code in your editor. What specific part would you like me to explain?'
        };
        
        const lowerPrompt = prompt.toLowerCase();
        let response = 'I understand you want help with coding. Could you be more specific about what you need?';
        
        for (const [key, value] of Object.entries(responses)) {
            if (lowerPrompt.includes(key)) {
                response = value;
                break;
            }
        }
        
        this.addAIMessage(response, 'ai');
    }

    handleAITool(action) {
        const actions = {
            'generate': 'What would you like me to generate? Describe the function or feature you need.',
            'review': 'Reviewing your code...\n\nYour code looks good! Here are some suggestions:\n• Consider adding error handling\n• Add docstrings for better documentation',
            'explain': 'This code defines a simple hello_world function that prints a greeting message. The if __name__ == "__main__" block ensures the function runs when the script is executed directly.',
            'debug': 'I\'ll help you debug your code. What error or issue are you experiencing?'
        };
        
        this.addAIMessage(actions[action] || 'Tool activated', 'ai');
    }

    addAIMessage(text, sender, showActions = false) {
        const chat = document.getElementById('aiChat');
        const message = document.createElement('div');
        message.className = `message ${sender}-message`;
        
        // Handle code blocks
        if (text.includes('```')) {
            message.innerHTML = this.formatCodeBlocks(text);
        } else {
            message.textContent = text;
        }
        
        // Add action buttons for AI messages
        if (sender === 'ai' && showActions) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.innerHTML = `
                <button class="action-btn copy-btn">📋 Copy</button>
                <button class="action-btn insert-btn">📝 Insert</button>
            `;
            message.appendChild(actions);
            
            // Add event listeners
            actions.querySelector('.copy-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(text);
            });
            
            actions.querySelector('.insert-btn').addEventListener('click', () => {
                const codeMatch = text.match(/```[\w]*\n([\s\S]*?)\n```/);
                if (codeMatch) {
                    this.editor.setValue(codeMatch[1]);
                }
            });
        }
        
        chat.appendChild(message);
        chat.scrollTop = chat.scrollHeight;
    }
    
    formatCodeBlocks(text) {
        return text.replace(/```([\w]*)\n([\s\S]*?)\n```/g, 
            '<pre><code class="language-$1">$2</code></pre>');
    }
    
    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('themeToggle');
        
        if (body.hasAttribute('data-theme')) {
            body.removeAttribute('data-theme');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            body.setAttribute('data-theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
    
    async saveFile() {
        const content = this.editor.getValue();
        this.files[this.currentFile] = content;
        
        // Save to Firebase
        const success = await this.saveFileToFirebase(this.currentFile, content);
        
        if (success) {
            this.addTerminalLine(`<i class="fas fa-save"></i> Saved ${this.currentFile} to cloud`, 'success');
        } else {
            // Fallback to local storage
            localStorage.setItem('flowmind-files', JSON.stringify(this.files));
            this.addTerminalLine(`<i class="fas fa-save"></i> Saved ${this.currentFile} locally`, 'info');
        }
        
        this.updateAIStatus('File saved');
    }
    
    async saveFileToFirebase(fileName, content) {
        if (this.firebaseManager) {
            return await this.firebaseManager.saveFile(fileName, content);
        }
        return false;
    }
    
    formatCode() {
        const content = this.editor.getValue();
        // Simple formatting - add proper indentation
        const formatted = content.split('\n').map(line => {
            return line.trim();
        }).join('\n');
        this.editor.setValue(formatted);
        this.addTerminalLine('<i class="fas fa-magic"></i> Code formatted', 'success');
    }
    
    showFindReplace() {
        this.editor.execCommand('find');
    }
    
    runInNewTab() {
        const fileName = this.currentFile;
        const code = this.editor.getValue();
        
        if (!fileName) {
            alert('Please select a file first');
            return;
        }
        
        if (fileName.endsWith('.html')) {
            this.runHTMLInNewTab(code);
        } else if (fileName.endsWith('.js')) {
            this.runJSInNewTab(code);
        } else if (fileName.endsWith('.css')) {
            this.runCSSInNewTab(code);
        } else {
            alert('New tab execution only supports HTML, CSS, and JavaScript files');
        }
    }
    
    runHTMLInNewTab(htmlCode) {
        const newTab = window.open('', '_blank');
        newTab.document.write(htmlCode);
        newTab.document.close();
        this.addTerminalLine(`<i class="fas fa-external-link-alt"></i> Opened ${this.currentFile} in new tab`, 'success');
    }
    
    runJSInNewTab(jsCode) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><title>JavaScript Output</title></head>
            <body>
                <h3>JavaScript Console Output:</h3>
                <div id="output" style="font-family: monospace; white-space: pre-wrap; padding: 10px; background: #f5f5f5;"></div>
                <script>
                    const output = document.getElementById('output');
                    const originalLog = console.log;
                    console.log = (...args) => {
                        output.textContent += args.join(' ') + '\n';
                        originalLog(...args);
                    };
                    try {
                        ${jsCode}
                    } catch (error) {
                        output.textContent += 'Error: ' + error.message;
                    }
                </script>
            </body>
            </html>
        `;
        const newTab = window.open('', '_blank');
        newTab.document.write(htmlContent);
        newTab.document.close();
        this.addTerminalLine(`<i class="fas fa-external-link-alt"></i> Opened ${this.currentFile} in new tab`, 'success');
    }
    
    runCSSInNewTab(cssCode) {
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>CSS Preview</title>
                <style>${cssCode}</style>
            </head>
            <body>
                <h1>CSS Preview</h1>
                <p>This is a sample paragraph to show your CSS styles.</p>
                <div class="container">
                    <button>Sample Button</button>
                    <input type="text" placeholder="Sample Input">
                </div>
            </body>
            </html>
        `;
        const newTab = window.open('', '_blank');
        newTab.document.write(htmlContent);
        newTab.document.close();
        this.addTerminalLine(`<i class="fas fa-external-link-alt"></i> Opened ${this.currentFile} CSS preview in new tab`, 'success');
    }
    
    stopCode() {
        document.getElementById('runCode').style.display = 'flex';
        document.getElementById('stopCode').style.display = 'none';
        this.addTerminalLine('<i class="fas fa-stop"></i> Execution stopped', 'info');
    }
    
    showSettings() {
        alert('Settings panel coming soon!');
    }
    
    updateAIStatus(message) {
        const statusElement = document.getElementById('aiStatus');
        const statusText = statusElement.querySelector('span:last-child');
        statusText.textContent = message;
        
        setTimeout(() => {
            statusText.textContent = 'AI Ready';
        }, 2000);
    }
    
    switchPanel(panelName) {
        // Update activity bar
        document.querySelectorAll('.activity-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');
        
        // Update panels
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${panelName}Panel`).classList.add('active');
    }
    
    showCommandPalette() {
        const commands = [
            'Generate Code',
            'Review Code', 
            'Explain Code',
            'Debug Code',
            'New File',
            'Run Code',
            'Clear Terminal'
        ];
        
        const command = prompt('Command Palette:\n' + commands.map((cmd, i) => `${i+1}. ${cmd}`).join('\n'));
        
        if (command) {
            const index = parseInt(command) - 1;
            if (index >= 0 && index < commands.length) {
                const action = commands[index].toLowerCase().replace(' ', '');
                if (['generatecode', 'reviewcode', 'explaincode', 'debugcode'].includes(action)) {
                    this.handleAITool(action.replace('code', ''));
                } else if (action === 'newfile') {
                    this.createNewFile();
                } else if (action === 'runcode') {
                    this.runCode();
                } else if (action === 'clearterminal') {
                    this.clearTerminal();
                }
            }
        }
    }

    toggleAIPanel() {
        const panel = document.querySelector('.ai-panel');
        const button = document.getElementById('toggleAI');
        
        if (panel.style.display === 'none') {
            panel.style.display = 'flex';
            button.textContent = '−';
        } else {
            panel.style.display = 'none';
            button.textContent = '+';
        }
    }
}

// Initialize the IDE when Firebase is ready
function initApp() {
    if (typeof firebase !== 'undefined') {
        new FlowMindIDE();
    } else {
        setTimeout(initApp, 500);
    }
}

document.addEventListener('DOMContentLoaded', initApp);