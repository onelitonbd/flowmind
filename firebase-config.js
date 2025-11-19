// Firebase configuration - using CDN instead of modules
// Add this script tag to HTML: <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
// Add this script tag to HTML: <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js"></script>

const firebaseConfig = {
    apiKey: "AIzaSyC1k3LJzTnJ8nCxNU_rR-BuYF-SgElH42M",
    authDomain: "aicodersbd.firebaseapp.com",
    projectId: "aicodersbd",
    storageBucket: "aicodersbd.firebasestorage.app",
    messagingSenderId: "829321156572",
    appId: "1:829321156572:web:42499afc14d3ea525fe119"
};

// Gemini API configuration
const GEMINI_API_KEY = "AIzaSyBi-uSfSnB4NjnF-ENcEpmYwAlveKZgi4w";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

class FirebaseFileManager {
    constructor(userId = 'default-user') {
        this.db = db;
        this.userId = userId;
        this.projectId = 'default-project';
    }
    
    setProject(projectId) {
        this.projectId = projectId;
    }

    async saveFile(fileName, content) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('files').doc(fileName).set({
                    name: fileName,
                    content: content,
                    lastModified: new Date(),
                    type: this.getFileType(fileName)
                });
            return true;
        } catch (error) {
            console.error('Error saving file:', error);
            return false;
        }
    }

    async loadFile(fileName) {
        try {
            const doc = await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('files').doc(fileName).get();
            
            if (doc.exists) {
                return doc.data().content;
            }
            return null;
        } catch (error) {
            console.error('Error loading file:', error);
            return null;
        }
    }

    async loadAllFiles() {
        try {
            const snapshot = await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('files').get();
            
            const files = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                files[data.name] = data.content;
            });
            
            return files;
        } catch (error) {
            console.error('Error loading files:', error);
            return {};
        }
    }

    async deleteFile(fileName) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('files').doc(fileName).delete();
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    async createFolder(folderName) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('folders').doc(folderName).set({
                    name: folderName,
                    created: new Date(),
                    type: 'folder'
                });
            return true;
        } catch (error) {
            console.error('Error creating folder:', error);
            return false;
        }
    }
    
    async getUserProjects() {
        try {
            const snapshot = await this.db.collection('users').doc(this.userId)
                .collection('projects').get();
            
            const projects = [];
            snapshot.forEach((doc) => {
                projects.push(doc.id);
            });
            
            return projects;
        } catch (error) {
            console.error('Error loading projects:', error);
            return [];
        }
    }
    
    async createProject(projectName) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(projectName).set({
                    name: projectName,
                    created: new Date(),
                    structure: { folders: {}, files: {} }
                });
            return true;
        } catch (error) {
            console.error('Error creating project:', error);
            return false;
        }
    }
    
    async loadProjectStructure() {
        try {
            const doc = await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId).get();
            
            if (doc.exists && doc.data().structure) {
                return doc.data().structure;
            }
            return { folders: {}, files: {} };
        } catch (error) {
            console.error('Error loading project structure:', error);
            return { folders: {}, files: {} };
        }
    }
    
    async saveProjectStructure(structure) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .update({ structure: structure });
            return true;
        } catch (error) {
            console.error('Error saving project structure:', error);
            return false;
        }
    }

    async saveChatHistory(messages) {
        try {
            await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('chat').doc('history').set({
                    messages: messages,
                    lastUpdated: new Date()
                });
            return true;
        } catch (error) {
            console.error('Error saving chat history:', error);
            return false;
        }
    }
    
    async loadChatHistory() {
        try {
            const doc = await this.db.collection('users').doc(this.userId)
                .collection('projects').doc(this.projectId)
                .collection('chat').doc('history').get();
            
            if (doc.exists && doc.data().messages) {
                return doc.data().messages;
            }
            return [];
        } catch (error) {
            console.error('Error loading chat history:', error);
            return [];
        }
    }

    getFileType(fileName) {
        const ext = fileName.split('.').pop();
        return ext || 'txt';
    }
}

// Make FirebaseFileManager available globally
window.FirebaseFileManager = FirebaseFileManager;