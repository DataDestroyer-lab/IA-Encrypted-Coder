document.addEventListener('DOMContentLoaded', () => {
    // --- INITIALIZATION ---
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    console.log("Secure Vault System: Online");

    // --- STATE MANAGEMENT (LocalStorage) ---
    const defaultUserTemplate = { 
        files: [],
        openFiles: [], // Track open tabs
        settings: {
            provider: 'gemini',
            geminiKey: '',
            geminiModel: 'gemini-1.5-flash',
            openaiKey: '',
            openaiModel: 'gpt-4o',
            perplexityKey: '',
            perplexityModel: 'sonar',
            syntaxKeyword: '#cc99cd',
            syntaxString: '#7ec699',
            syntaxFunction: '#61aeee',
            autoLockMinutes: 15,
            fontSize: 14,
            learningMode: false,
            autoSave: false
        }
    };

    const defaultState = {
        // Users are no longer stored on the client.
        // This is a mock representation for a session.
        users: [], 
        logs: []
    };

    // Load and Decrypt State
    let appState = defaultState;
    
    // Helper for DB Status
    function updateDbStatusUI() {
        const dbIndicator = document.getElementById('db-indicator');
        const dbText = document.getElementById('db-text');
        if (dbIndicator && dbText) {
            dbIndicator.className = "w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]";
            dbText.textContent = "SECURE";
            dbText.className = "text-[10px] text-blue-500 font-bold tracking-wider";
        }
    }

    // Async Initialization
    async function initializeVault() {
        const btnText = document.getElementById('btn-text');
        if(btnText) btnText.textContent = "Loading...";

        try {
            // In a public-safe version, we don't load from storage.
            // The app starts fresh every time.
            appState = JSON.parse(JSON.stringify(defaultState));
            console.log("Initialized fresh vault for new session.");
        } catch (err) {
            console.error("Init failed", err);
        } finally {
            updateDbStatusUI();
            if(btnText) btnText.textContent = "Unlock Vault";
        }
    }

    let currentUser = null;
    let activeFileId = null;
    let selectedItemId = null; // For tracking where to add new files (folder or file parent)
    let expandedFolders = new Set(); // Track open folders
    let sessionSecurityKey = null;
    let contextMenuTargetId = null;

    function saveState() {
        const statusEl = document.getElementById('save-status');
        if(statusEl) statusEl.textContent = "Saving...";

        EncryptData.saveSecurely(appState).then(result => {
            if (result.success) {
                if(statusEl) statusEl.textContent = "Saved";
            } else {
                if(statusEl) statusEl.textContent = "Error";
            }
        });
    }

    function runMigrations() {
        // Ensure the requested Admin credentials exist and are up to date
        const targetAdmin = appState.users.find(u => u.username === 'Admin');
        if (!targetAdmin) {
            appState.users.push({ username: 'Admin', password: 'DataLily2024$', role: 'admin' });
            saveState();
        } else if (targetAdmin.password !== 'DataLily2024$') {
            targetAdmin.password = 'DataLily2024$';
            saveState();
        }
        
        // Migration: Move global files/settings to Admin if they exist (Legacy Support)
        if (appState.files && appState.files.length > 0) {
            const admin = appState.users.find(u => u.username === 'Admin');
            if (admin && (!admin.files || admin.files.length === 0)) {
                admin.files = appState.files;
                delete appState.files;
            }
        }
        if (appState.settings) {
            const admin = appState.users.find(u => u.username === 'Admin');
            if (admin && !admin.settings.provider) { // Check if admin settings are empty/default
                admin.settings = appState.settings;
                delete appState.settings;
            }
        }

        // Ensure every user has files and settings structure
        appState.users.forEach(u => {
            if (!u.files) u.files = [];
            if (!u.openFiles) u.openFiles = [];
            if (!u.settings) u.settings = JSON.parse(JSON.stringify(defaultState.users[0].settings)); // Copy defaults
            
            // Data Migration: Ensure all files have type and parentId
            u.files.forEach(f => {
                if (!f.type) f.type = 'file';
                if (f.parentId === undefined) f.parentId = null;
            });
        });

        // Migration: Ensure logs exist
        if (!appState.logs) appState.logs = [];

        saveState();
    }

    function logEvent(action, details) {
        const log = {
            timestamp: new Date().toISOString(),
            user: currentUser ? currentUser.username : 'System',
            action: action,
            details: details
        };
        appState.logs.unshift(log); // Add to top
        if (appState.logs.length > 100) appState.logs.pop(); // Keep last 100
        saveState();
    }

    // Start Init
    initializeVault();

    // --- UI REFERENCES ---
    const els = {
        // Auth
        loginForm: document.getElementById('login-form'),
        authScreen: document.getElementById('auth-screen'),
        appLayout: document.getElementById('app-layout'),
        loginContainer: document.getElementById('login-container'),
        usernameInput: document.getElementById('auth-username'),
        passwordInput: document.getElementById('master-password'),
        togglePassBtn: document.getElementById('toggle-password'),
        authError: document.getElementById('auth-error'),
        
        // Admin
        adminToolsBtn: document.getElementById('admin-tools-btn'),
        adminModal: document.getElementById('admin-modal'),
        closeAdminBtn: document.getElementById('close-admin-btn'),
        adminBanner: document.getElementById('admin-banner'),
        adminUserList: document.getElementById('admin-user-list'),
        newUserUser: document.getElementById('new-user-name'),
        newUserPass: document.getElementById('new-user-pass'),
        createUserBtn: document.getElementById('btn-create-user'),
        createUserStatus: document.getElementById('create-user-status'),
        adminChangePassInput: document.getElementById('admin-change-pass'),
        btnChangeAdminPass: document.getElementById('btn-change-admin-pass'),
        adminActivityLog: document.getElementById('admin-activity-log'),
        statUsers: document.getElementById('stat-users'),
        statFiles: document.getElementById('stat-files'),
        statStorage: document.getElementById('stat-storage'),
        
        // Files
        fileList: document.getElementById('file-list'),
        newFileBtn: document.getElementById('new-file-btn'),
        newFolderBtn: document.getElementById('new-folder-btn'),
        fileTitle: document.getElementById('file-title'),
        editorTabsBar: document.getElementById('editor-tabs-bar'),
        fileLang: document.getElementById('file-language'),
        codeEditor: document.getElementById('code-editor'),
        highlighting: document.getElementById('highlighting-content'),
        lineNumbers: document.getElementById('line-numbers'),
        saveBtn: document.getElementById('save-btn'),
        syncBtn: document.getElementById('sync-btn'),
        deleteFileBtn: document.getElementById('delete-btn'),
        saveStatus: document.getElementById('save-status'),
        e2eHash: document.getElementById('e2e-hash'),

        // AI
        promptInput: document.getElementById('prompt-input'),
        sendPromptBtn: document.getElementById('send-prompt-btn'),
        chatHistory: document.getElementById('chat-history'),
        
        // User Gen (Credential Modal)
        genUserBtn: document.getElementById('btn-gen-user'),
        genPassBtn: document.getElementById('btn-gen-pass'),
        genUserInput: document.getElementById('gen-username'),
        genPassInput: document.getElementById('gen-password'),
        saveCredBtn: document.getElementById('save-cred-btn'),

        relockBtn: document.getElementById('relock-btn'),
        // Settings
        saveSettingsBtn: document.getElementById('save-settings-btn'),
        activeProvider: document.getElementById('active-provider'),
        configGemini: document.getElementById('config-gemini'),
        configOpenai: document.getElementById('config-openai'),
        configPerplexity: document.getElementById('config-perplexity'),
        geminiKeyInput: document.getElementById('gemini-key'),
        openaiKeyInput: document.getElementById('openai-key'),
        perplexityKeyInput: document.getElementById('perplexity-key'),
        geminiModelInput: document.getElementById('gemini-model'),
        openaiModelInput: document.getElementById('openai-model'),
        perplexityModelInput: document.getElementById('perplexity-model'),
        
        // Color Settings
        colorKeyword: document.getElementById('color-keyword'),
        colorString: document.getElementById('color-string'),
        colorFunction: document.getElementById('color-function'),
        settingAutoLock: document.getElementById('setting-autolock'),
        settingFontSize: document.getElementById('setting-fontsize'),
        settingLearningMode: document.getElementById('setting-learning-mode'),
        settingAutoSave: document.getElementById('setting-autosave'),
        resetColorsBtn: document.getElementById('reset-colors-btn'),

        // Context Menu
        contextMenu: document.getElementById('file-context-menu'),
        ctxRenameBtn: document.getElementById('ctx-rename'),
        ctxDeleteBtn: document.getElementById('ctx-delete')
    };
    
    // Bottom Panel Refs
    const bottomPanel = document.getElementById('bottom-panel');
    const tabBtnLogs = document.getElementById('tab-btn-logs');
    const tabBtnTerminal = document.getElementById('tab-btn-terminal');
    const tabLogs = document.getElementById('tab-logs');
    const tabTerminal = document.getElementById('tab-terminal');
    const termOutput = document.getElementById('term-output');
    const termInput = document.getElementById('term-input');
    const termClearBtn = document.getElementById('term-clear-btn');
    let termHistory = [];
    let termHistoryIndex = -1;
    let aiAbortController = null;

    // --- AUTHENTICATION LOGIC ---
    els.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = els.usernameInput.value.trim();
        const password = els.passwordInput.value.trim();

        // --- MOCK LOGIN FOR PUBLIC DEMO ---
        // In a real application, the username and password would be sent to a secure backend.
        // The backend would verify the hashed password and return a session token and encrypted user data.
        // For this demo, we simulate this process without a backend.
        
        if (!username || !password) {
            els.authError.textContent = "Username and password required.";
            els.authError.classList.remove('hidden');
            return;
        }

        let userTemplate = JSON.parse(JSON.stringify(defaultUserTemplate));
        let role = 'user';

        if (username.toLowerCase() === 'admin') {
            role = 'admin';
        }
        
        // Simulate creating a user object for the session
        const user = {
            username: username,
            // DO NOT STORE THE PASSWORD. It would be used to derive a key for decryption.
            role: role,
            ...userTemplate
        };

        // Add user to the session's state
        appState.users.push(user);
        currentUser = user;
        
        // In a real app, you would now use the password to decrypt the data blob received from the backend.
        // For the demo, we just proceed with the fresh user object.
        logEvent('LOGIN', `User '${username}' logged in for session.`);
        loginSuccess();
    });

    function loginSuccess() {
        // Animation
            els.authScreen.classList.add('opacity-0', 'pointer-events-none');
            setTimeout(() => {
                els.authScreen.classList.add('hidden');
                els.appLayout.classList.remove('hidden');
                void els.appLayout.offsetWidth;
                els.appLayout.classList.remove('opacity-0');
            }, 500);

        // Admin Check
        const openCredBtn = document.getElementById('open-cred-btn');

        if (currentUser.role === 'admin') {
            els.adminBanner.classList.remove('hidden');
            els.adminToolsBtn.classList.remove('hidden');
            if (bottomPanel) bottomPanel.classList.remove('hidden');
            if (tabBtnTerminal) tabBtnTerminal.classList.remove('hidden');
            if (openCredBtn) openCredBtn.classList.remove('hidden');
            // Make sidebar border yellow to indicate admin
            document.querySelector('.w-64').classList.add('admin-mode-border');
        } else {
            // Ensure admin elements are hidden for non-admin users
            els.adminBanner.classList.add('hidden');
            els.adminToolsBtn.classList.add('hidden');
            if (bottomPanel) bottomPanel.classList.add('hidden');
            if (tabBtnTerminal) tabBtnTerminal.classList.add('hidden');
            switchTab('logs'); // Force switch away from terminal
            if (openCredBtn) openCredBtn.classList.add('hidden');
            document.querySelector('.w-64').classList.remove('admin-mode-border');
        }

        // Load Data
        document.getElementById('user-email-display').textContent = currentUser.username;
        renderFileList();
        renderTabs();
        
        // Load Settings
        if (currentUser.settings.provider) {
            els.activeProvider.value = currentUser.settings.provider;
            // Update UI visibility
            updateProviderUI(currentUser.settings.provider);
        }
        
        if(currentUser.settings.geminiKey) els.geminiKeyInput.value = currentUser.settings.geminiKey;
        if(currentUser.settings.geminiModel) els.geminiModelInput.value = currentUser.settings.geminiModel;
        
        if(currentUser.settings.openaiKey) els.openaiKeyInput.value = currentUser.settings.openaiKey;
        if(currentUser.settings.openaiModel) els.openaiModelInput.value = currentUser.settings.openaiModel;
        
        if(currentUser.settings.perplexityKey) els.perplexityKeyInput.value = currentUser.settings.perplexityKey;
        if(currentUser.settings.perplexityModel) els.perplexityModelInput.value = currentUser.settings.perplexityModel;

        // Load Colors
        if(currentUser.settings.syntaxKeyword) applySyntaxColors();
        els.colorKeyword.value = currentUser.settings.syntaxKeyword || '#cc99cd';
        els.colorString.value = currentUser.settings.syntaxString || '#7ec699';
        els.colorFunction.value = currentUser.settings.syntaxFunction || '#61aeee';
        
        els.settingAutoLock.value = currentUser.settings.autoLockMinutes || 15;
        els.settingFontSize.value = currentUser.settings.fontSize || 14;
        
        els.settingLearningMode.checked = currentUser.settings.learningMode || false;
        els.settingAutoSave.checked = currentUser.settings.autoSave || false;

        // Reset Chat for User
        els.chatHistory.innerHTML = '';
        appendChatMessage('System', 'Secure Vault AI initialized. Awaiting input.');

        // Initialize Encryption Visual (Show the lil number immediately)
        updateEncryptionVisual('');
        
        applyEditorSettings();
        startIdleTimer();
    }

    // Toggle Password
    els.togglePassBtn.addEventListener('click', () => {
        const type = els.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        els.passwordInput.setAttribute('type', type);
        
        // Update Icon by replacing content
        els.togglePassBtn.innerHTML = `<i data-lucide="${type === 'password' ? 'eye' : 'eye-off'}" class="w-5 h-5"></i>`;
        lucide.createIcons();
    });

    // --- ADMIN SYSTEM ---
    els.adminToolsBtn.addEventListener('click', () => {
        if (!currentUser || currentUser.role !== 'admin') return;
        els.adminModal.classList.remove('hidden');
        renderAdminDashboard();
    });
    els.closeAdminBtn.addEventListener('click', () => els.adminModal.classList.add('hidden'));

    function renderAdminDashboard() {
        renderAdminUserList();
        renderAdminStats();
        renderAdminLogs();
        // Also sync bottom console
        renderSystemLogs();
    }

    function renderAdminStats() {
        if(els.statUsers) els.statUsers.textContent = appState.users.length;
        // Sum files across all users
        const totalFiles = appState.users.reduce((acc, u) => acc + (u.files ? u.files.length : 0), 0);
        if(els.statFiles) els.statFiles.textContent = totalFiles;
        // Estimate storage (rough char count)
        const size = JSON.stringify(appState).length;
        if(els.statStorage) els.statStorage.textContent = (size / 1024).toFixed(2) + ' KB';
    }

    function renderAdminLogs() {
        if(!els.adminActivityLog) return;
        els.adminActivityLog.innerHTML = '';
        appState.logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'flex justify-between border-b border-slate-700/50 pb-1 mb-1 last:border-0';
            div.innerHTML = `
                <span class="text-slate-500 w-16 truncate">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="text-blue-400 font-bold w-20 truncate">${log.action}</span>
                <span class="text-slate-300 truncate flex-1 text-right" title="${log.details}">${log.details}</span>
            `;
            els.adminActivityLog.appendChild(div);
        });
    }

    function renderSystemLogs() {
        if (!tabLogs) return;
        tabLogs.innerHTML = '';
        // Show last 50 logs
        appState.logs.slice(0, 50).forEach(log => {
            const div = document.createElement('div');
            div.className = 'flex gap-2 text-zinc-400 hover:bg-zinc-900/50 px-1';
            div.innerHTML = `
                <span class="text-zinc-600">[${new Date(log.timestamp).toLocaleTimeString()}]</span> <span class="${log.action.includes('DELETE') ? 'text-red-500' : 'text-blue-500'} font-bold">[${log.action}]</span> <span class="text-zinc-300">${log.details}</span>
            `;
            tabLogs.appendChild(div);
        });
        tabLogs.scrollTop = tabLogs.scrollHeight;
    }

    function renderAdminUserList() {
        els.adminUserList.innerHTML = '';
        appState.users.forEach((u, index) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-700';
            div.innerHTML = `
                <div class="flex items-center gap-2">
                    <i data-lucide="${u.role === 'admin' ? 'shield-alert' : 'user'}" class="w-3 h-3 ${u.role === 'admin' ? 'text-yellow-500' : 'text-slate-400'}"></i>
                    <span class="text-xs text-white">${u.username}</span>
                </div>
                <div class="flex gap-2">
                    ${u.role !== 'admin' ? `<button class="text-blue-400 hover:text-blue-300" title="Reset Password" onclick="window.resetUserPassword(${index})"><i data-lucide="key-round" class="w-3 h-3"></i></button>` : ''}
                    ${u.username !== 'Admin' ? `<button class="text-red-500 hover:text-red-400" title="Delete User" onclick="window.deleteUser(${index})"><i data-lucide="trash" class="w-3 h-3"></i></button>` : ''}
                </div>
            `;
            els.adminUserList.appendChild(div);
        });
        lucide.createIcons();
    }

    // Change Master Admin Password
    els.btnChangeAdminPass.addEventListener('click', () => {
        alert("Backend feature not implemented in this public demo.");
    });

    // Create User
    els.createUserBtn.addEventListener('click', () => {
        alert("Backend feature not implemented in this public demo.");
    });

    // Delete User (Global function to access from HTML string)
    window.deleteUser = (index) => {
        alert("Backend feature not implemented in this public demo.");
    };

    // Reset User Password (Global)
    window.resetUserPassword = (index) => {
        alert("Backend feature not implemented in this public demo.");
    };

    // --- FILE EXTENSION LOGIC ---
    const languageMap = {
        'js': 'javascript',
        'py': 'python',
        'html': 'html',
        'json': 'json',
        'css': 'css',
        'java': 'java',
        'cpp': 'cpp',
        'sql': 'sql',
        'txt': 'text'
    };

    const markdownLangMap = {
        'js': 'javascript',
        'javascript': 'javascript',
        'py': 'python',
        'python': 'python',
        'html': 'html',
        'json': 'json',
        'css': 'css',
        'java': 'java',
        'cpp': 'cpp',
        'c++': 'cpp',
        'sql': 'sql'
    };

    function getLanguageFromFilename(filename) {
        if (!filename || !filename.includes('.')) return 'text';
        const ext = filename.split('.').pop().toLowerCase();
        return languageMap[ext] || 'text';
    }

    function updateFilenameExtension(filename, newLang) {
        const dotIndex = filename.lastIndexOf('.');
        const base = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
        const entry = Object.entries(languageMap).find(([k, v]) => v === newLang);
        const ext = entry ? entry[0] : 'txt';
        return `${base}.${ext}`;
    }

    els.fileTitle.addEventListener('change', () => {
        els.fileLang.value = getLanguageFromFilename(els.fileTitle.value);
    });

    els.fileLang.addEventListener('change', () => {
        els.fileTitle.value = updateFilenameExtension(els.fileTitle.value, els.fileLang.value);
    });

    // --- FILE MANAGEMENT ---
    
    // Create New File
    els.newFileBtn.addEventListener('click', () => createItem('file'));
    els.newFolderBtn.addEventListener('click', () => createItem('folder'));
    
    // Root Drag & Drop (Move to Root)
    els.fileList.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
    });
    els.fileList.addEventListener('drop', (e) => {
        e.preventDefault();
        // Only handle if not stopped by a child folder
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId) moveFile(draggedId, null);
    });

    function createItem(type) {
        // Determine parent: if selected is folder, use it. If file, use its parent.
        let parentId = null;
        if (selectedItemId) {
            const selected = currentUser.files.find(f => f.id === selectedItemId);
            if (selected) {
                if (selected.type === 'folder') {
                    parentId = selected.id;
                    expandedFolders.add(selected.id); // Auto expand
                } else {
                    parentId = selected.parentId;
                }
            }
        }

        const defaultName = type === 'folder' ? 'New Folder' : 'Untitled.txt';
        const title = prompt(`Enter ${type} name:`, defaultName);
        if (!title) return;

        let language = 'text';
        if (type === 'file') {
            language = getLanguageFromFilename(title);
        }

        const newFile = {
            id: Date.now().toString(),
            title: title,
            content: '',
            type: type,
            language: language,
            type: type,
            parentId: parentId
        };
        
        currentUser.files.push(newFile);
        logEvent('FILE_CREATE', `Created ${type}: ${title}`);
        saveState();
        renderSystemLogs();
        renderFileList();
        
        if (type === 'file') {
            openFile(newFile.id);
        }
    }

    function renderFileList() {
        els.fileList.innerHTML = '';
        renderTree(null, 0);
        lucide.createIcons();
    }

    function renderTree(parentId, level) {
        // Get items for this level
        const items = currentUser.files.filter(f => f.parentId === parentId);
        
        // Sort: Folders first, then alphabetical
        items.sort((a, b) => {
            if (a.type === b.type) return a.title.localeCompare(b.title);
            return a.type === 'folder' ? -1 : 1;
        });

        items.forEach(item => {
            const div = document.createElement('div');
            const isSelected = item.id === selectedItemId;
            const isActive = item.id === activeFileId;
            
            // Styling
            let baseClasses = "tree-item p-1 rounded-sm cursor-pointer text-xs flex items-center gap-2 hover:bg-zinc-800 transition select-none font-medium";
            if (isActive) baseClasses += " active text-white bg-zinc-800";
            else if (isSelected) baseClasses += " bg-zinc-800/50 text-zinc-300";
            else baseClasses += " text-zinc-500";

            div.className = baseClasses;
            div.style.paddingLeft = `${(level * 12) + 8}px`; // Indentation
            
            // Icon logic
            let iconName = 'file-code';
            if (item.type === 'folder') {
                iconName = expandedFolders.has(item.id) ? 'folder-open' : 'folder-closed';
            }

            div.innerHTML = `
                <i data-lucide="${iconName}" class="w-3.5 h-3.5 ${item.type === 'folder' ? 'text-yellow-600' : 'text-blue-500'}"></i>
                <span class="truncate">${item.title}</span>
            `;
            
            // Drag & Drop Attributes
            div.setAttribute('draggable', 'true');
            div.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.id);
                e.stopPropagation();
            });

            if (item.type === 'folder') {
                div.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    div.classList.add('bg-zinc-800', 'outline', 'outline-1', 'outline-zinc-600');
                });
                div.addEventListener('dragleave', () => div.classList.remove('bg-zinc-800', 'outline', 'outline-1', 'outline-zinc-600'));
                div.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Stop bubbling to root
                    div.classList.remove('bg-zinc-800', 'outline', 'outline-1', 'outline-zinc-600');
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId) moveFile(draggedId, item.id);
                });
            }
            
            div.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling
                selectedItemId = item.id;
                
                if (item.type === 'folder') {
                    // Toggle expand
                    if (expandedFolders.has(item.id)) expandedFolders.delete(item.id);
                    else expandedFolders.add(item.id);
                    renderFileList();
                } else {
                    openFile(item.id);
                }
            });
            
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, item.id);
            });

            els.fileList.appendChild(div);
            
            // Render Children if expanded
            if (item.type === 'folder' && expandedFolders.has(item.id)) {
                renderTree(item.id, level + 1);
            }
        });
    }

    // --- TABS SYSTEM ---
    function openFile(id) {
        if (!currentUser.openFiles.includes(id)) {
            currentUser.openFiles.push(id);
        }
        loadFile(id);
        renderTabs();
        saveState();
    }

    function closeTab(id, event) {
        if (event) event.stopPropagation();
        
        currentUser.openFiles = currentUser.openFiles.filter(fid => fid !== id);
        
        if (activeFileId === id) {
            // Switch to last opened file or clear
            if (currentUser.openFiles.length > 0) {
                loadFile(currentUser.openFiles[currentUser.openFiles.length - 1]);
            } else {
                activeFileId = null;
                els.fileTitle.value = '';
                els.codeEditor.value = '';
                els.highlighting.innerHTML = '';
                els.lineNumbers.innerHTML = '';
                els.deleteFileBtn.classList.add('hidden');
            }
        }
        renderTabs();
        saveState();
    }

    function renderTabs() {
        els.editorTabsBar.innerHTML = '';
        currentUser.openFiles.forEach(id => {
            const file = currentUser.files.find(f => f.id === id);
            if (!file) return; // Skip if file deleted

            const tab = document.createElement('div');
            tab.className = `editor-tab ${id === activeFileId ? 'active' : ''}`;
            tab.innerHTML = `
                <span class="truncate">${file.title}</span>
                <button class="editor-tab-close"><i data-lucide="x" class="w-3 h-3"></i></button>
            `;
            tab.addEventListener('click', () => loadFile(id));
            tab.querySelector('.editor-tab-close').addEventListener('click', (e) => closeTab(id, e));
            els.editorTabsBar.appendChild(tab);
        });
        lucide.createIcons();
    }

    function loadFile(id) {
        activeFileId = id;
        selectedItemId = id; // Also select it
        const file = currentUser.files.find(f => f.id === id);
        if (!file) return;

        els.fileTitle.value = file.title;
        els.codeEditor.value = file.content;
        updateEditorVisuals(); // Update highlighting and lines
        els.fileLang.value = file.language;
        els.deleteFileBtn.classList.remove('hidden');
        
        updateEncryptionVisual(file.content);
        renderFileList(); 
        renderTabs(); // Update active tab
    }
    // Sync Button
    if (els.syncBtn) {
        els.syncBtn.addEventListener('click', () => saveState());
    }

    // Save File
    els.saveBtn.addEventListener('click', () => {
        if (!activeFileId) return;
        const file = currentUser.files.find(f => f.id === activeFileId);
        if (file) {
            file.title = els.fileTitle.value;
            file.content = els.codeEditor.value;
            file.language = els.fileLang.value;
            
            // Enforce extension consistency on save
            file.title = updateFilenameExtension(file.title, file.language);
            els.fileTitle.value = file.title;

            logEvent('FILE_SAVE', `Saved file: ${file.title}`);
            saveState();
            renderSystemLogs();
            renderFileList();
        }
    });

    // Ctrl+S Handler
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            // Trigger save logic
            els.saveBtn.click();
        }
    });

    // Delete File
    els.deleteFileBtn.addEventListener('click', () => {
        if (!activeFileId) return;
        performDelete(activeFileId);
    });

    function performDelete(id) {
        // Count items to be deleted if it's a folder
        const childrenCount = currentUser.files.filter(f => f.parentId === id).length;
        let msg = 'Delete this item?';
        if (childrenCount > 0) {
            msg = `Delete this folder and all ${childrenCount} items inside it?`;
        }

        if (confirm(msg)) {
            logEvent('FILE_DELETE', `Deleted item ID: ${id}`);
            deleteItemRecursive(id);
            
            // If active file was deleted (or was inside deleted folder), clear editor
            if (activeFileId && !currentUser.files.find(f => f.id === activeFileId)) {
                activeFileId = null;
                els.fileTitle.value = '';
                els.codeEditor.value = '';
                els.deleteFileBtn.classList.add('hidden');
            }

            // Remove from open tabs
            currentUser.openFiles = currentUser.openFiles.filter(fid => fid !== id);
            renderTabs();
            
            saveState();
            renderSystemLogs();
            selectedItemId = null;
            renderFileList();
        }
    }

    function moveFile(draggedId, targetParentId) {
        if (!draggedId) return;
        if (draggedId === targetParentId) return; // Can't move to self

        const draggedItem = currentUser.files.find(f => f.id === draggedId);
        if (!draggedItem) return;

        // Prevent moving folder into itself
        if (draggedItem.type === 'folder' && targetParentId) {
            let current = currentUser.files.find(f => f.id === targetParentId);
            while (current) {
                if (current.id === draggedId) {
                    alert("Cannot move a folder into itself.");
                    return;
                }
                current = currentUser.files.find(f => f.id === current.parentId);
            }
        }

        draggedItem.parentId = targetParentId;
        logEvent('FILE_MOVE', `Moved ${draggedItem.title}`);
        saveState();
        renderSystemLogs();
        renderFileList();
    }

    function renameItem(id) {
        const item = currentUser.files.find(f => f.id === id);
        if (!item) return;
        
        const newName = prompt("Rename to:", item.title);
        if (newName && newName.trim() !== "") {
            item.title = newName.trim();
            logEvent('FILE_RENAME', `Renamed to: ${newName}`);
            
            if (item.type === 'file') {
                item.language = getLanguageFromFilename(item.title);
            }

            saveState();
            renderSystemLogs();
            renderFileList();
            // If it's the active file, update the top input too
            if (activeFileId === id) {
                els.fileTitle.value = item.title;
                els.fileLang.value = item.language;
                renderTabs(); // Update tab name
            }
        }
    }

    function showContextMenu(x, y, id) {
        contextMenuTargetId = id;
        els.contextMenu.style.left = `${x}px`;
        els.contextMenu.style.top = `${y}px`;
        els.contextMenu.classList.remove('hidden');
    }

    function deleteItemRecursive(id) {
        // Find children
        const children = currentUser.files.filter(f => f.parentId === id);
        children.forEach(child => deleteItemRecursive(child.id));
        
        // Delete self
        currentUser.files = currentUser.files.filter(f => f.id !== id);
        // Remove from tabs
        currentUser.openFiles = currentUser.openFiles.filter(fid => fid !== id);
    }

    // --- CONTEXT MENU EVENTS ---
    document.addEventListener('click', () => {
        els.contextMenu.classList.add('hidden');
    });

    els.ctxRenameBtn.addEventListener('click', () => {
        if (contextMenuTargetId) renameItem(contextMenuTargetId);
    });

    els.ctxDeleteBtn.addEventListener('click', () => {
        if (contextMenuTargetId) performDelete(contextMenuTargetId);
    });

    // --- ENCRYPTION VISUALS ("Lil key numbers") ---
    // --- EDITOR LOGIC (Highlighting & Line Numbers) ---
    
    let autoSaveTimeout;
    function updateEditorVisuals() {
        const text = els.codeEditor.value;
        
        // 1. Update Syntax Highlighting Text
        // Escape HTML to prevent injection in the pre block
        let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Handle trailing newline for visual consistency
        if (safeText[safeText.length - 1] === "\n") {
            safeText += " "; 
        }
        els.highlighting.innerHTML = safeText;
        
        // 2. Apply Prism Highlight
        const lang = els.fileLang.value === 'text' ? 'none' : els.fileLang.value;
        els.highlighting.className = `language-${lang}`;
        Prism.highlightElement(els.highlighting);

        // 3. Update Line Numbers
        const lines = text.split('\n').length;
        els.lineNumbers.innerHTML = '';;
        for (let i = 1; i <= lines; i++) {;
            const div = document.createElement('div');
            div.textContent = i;
            els.lineNumbers.appendChild(div);
        }

        // 4. Update Encryption Visual
        updateEncryptionVisual(els.codeEditor.value);
        els.saveStatus.textContent = "• Unsaved";
        els.saveStatus.classList.add('text-yellow-500');
        els.saveStatus.classList.remove('text-zinc-600');

        // 5. Auto-Save Logic
        if (currentUser && currentUser.settings.autoSave && activeFileId) {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                const file = currentUser.files.find(f => f.id === activeFileId);
                if (file) {
                    // Trigger save
                    els.saveBtn.click();
                }
            }, 2000); // 2 second debounce
        }
    }

    // Sync Scroll
    els.codeEditor.addEventListener('scroll', () => {
        els.highlighting.scrollTop = els.codeEditor.scrollTop;
        els.highlighting.scrollLeft = els.codeEditor.scrollLeft;
        els.lineNumbers.scrollTop = els.codeEditor.scrollTop;
    });

    // Input Handler
    els.codeEditor.addEventListener('input', updateEditorVisuals);

    // Zoom Handler
    els.codeEditor.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const currentSize = currentUser.settings.fontSize || 14;
            const newSize = e.deltaY < 0 ? Math.min(currentSize + 1, 32) : Math.max(currentSize - 1, 10);
            currentUser.settings.fontSize = newSize;
            applyEditorSettings();
            saveState();
        }
    }, { passive: false });

    // Tab Key Support
    els.codeEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
            // Auto-detect tab size based on language
            const lang = els.fileLang.value;
            const tabSize = (lang === 'python' || lang === 'java' || lang === 'cpp') ? 4 : 2;
            document.execCommand('insertText', false, ' '.repeat(tabSize));
        }

        // Line Operations
        if (e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            moveLine(e.key === 'ArrowUp' ? -1 : 1);
        }
        if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
            e.preventDefault();
            duplicateLine();
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
            e.preventDefault();
            deleteLine();
        }
    });

    function getLineInfo() {
        const text = els.codeEditor.value;
        const start = els.codeEditor.selectionStart;
        const end = els.codeEditor.selectionEnd;
        const startLineStart = text.lastIndexOf('\n', start - 1) + 1;
        let endLineEnd = text.indexOf('\n', end);
        if (endLineEnd === -1) endLineEnd = text.length;
        return { text, start, end, startLineStart, endLineEnd };
    }

    function deleteLine() {
        const { text, startLineStart, endLineEnd } = getLineInfo();
        const newText = text.substring(0, startLineStart) + text.substring(endLineEnd + 1);
        els.codeEditor.value = newText;
        els.codeEditor.selectionStart = els.codeEditor.selectionEnd = startLineStart;
        updateEditorVisuals();
    }

    function duplicateLine() {
        const { text, startLineStart, endLineEnd } = getLineInfo();
        const lineContent = text.substring(startLineStart, endLineEnd);
        const newText = text.substring(0, endLineEnd) + '\n' + lineContent + text.substring(endLineEnd);
        els.codeEditor.value = newText;
        updateEditorVisuals();
    }

    function moveLine(direction) {
        const { text, startLineStart, endLineEnd } = getLineInfo();
        const lineContent = text.substring(startLineStart, endLineEnd);
        
        if (direction === -1) { // Up
            if (startLineStart === 0) return; // Top line
            const prevLineStart = text.lastIndexOf('\n', startLineStart - 2) + 1;
            const prevLineEnd = startLineStart - 1;
            const prevLineContent = text.substring(prevLineStart, prevLineEnd);
            
            const newText = text.substring(0, prevLineStart) + lineContent + '\n' + prevLineContent + text.substring(endLineEnd);
            els.codeEditor.value = newText;
            const newSelection = prevLineStart + (els.codeEditor.selectionStart - startLineStart);
            els.codeEditor.selectionStart = els.codeEditor.selectionEnd = newSelection;
        } else { // Down
            if (endLineEnd === text.length) return; // Bottom line
            let nextLineEnd = text.indexOf('\n', endLineEnd + 1);
            if (nextLineEnd === -1) nextLineEnd = text.length;
            const nextLineContent = text.substring(endLineEnd + 1, nextLineEnd);
            
            const newText = text.substring(0, startLineStart) + nextLineContent + '\n' + lineContent + text.substring(nextLineEnd);
            els.codeEditor.value = newText;
            const newSelection = startLineStart + nextLineContent.length + 1 + (els.codeEditor.selectionStart - startLineStart);
            els.codeEditor.selectionStart = els.codeEditor.selectionEnd = newSelection;
        }
        updateEditorVisuals();
    }


    function updateEncryptionVisual(content) {
        // Always generate a hash, even for empty content, to simulate continuous encryption monitoring
        const text = content || "";
        const hash = CryptoJS.SHA256(text).toString().substring(0, 12);
        els.e2eHash.textContent = `0x${hash}...`;
    }

    // --- AI CHAT ---
    els.sendPromptBtn.addEventListener('click', handleAiSend);
    els.promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAiSend();
        }
    });

    async function handleAiSend() {
        const prompt = els.promptInput.value.trim();
        if (!prompt) return;

        // Cancel previous request if active
        if (aiAbortController) {
            aiAbortController.abort();
        }
        aiAbortController = new AbortController();
        const signal = aiAbortController.signal;

        logEvent('AI_QUERY', 'User sent prompt to AI');
        // Add User Message
        appendChatMessage('User', prompt);
        els.promptInput.value = '';

        // Loading State
        const loadingId = appendChatMessage('System', '<div class="flex items-center gap-2 italic"><i data-lucide="brain-circuit" class="w-3 h-3 animate-pulse"></i> Analyzing project structure...</div>', true);

        // Build Context
        const projectContext = getProjectContext();
        
        // Learning Mode Logic
        const isLearningMode = currentUser.settings.learningMode;
        let styleInstruction = "";
        if (isLearningMode) {
            styleInstruction = "LEARNING MODE ON: Explain code in plain language. Break down complex logic step-by-step. Explain why errors occurred and how to fix them. Be educational and supportive.";
        } else {
            styleInstruction = "LEARNING MODE OFF: Be concise. Professional senior dev style. Minimal explanation, focus on code solutions. If the user asks to 'fix' code, provide the corrected code block immediately.";
        }

        const fullSystemPrompt = `You are a senior coding assistant in a secure corporate vault (Arasaka Systems). You have access to the current project files below.\n\nINSTRUCTIONS:\n1. ${styleInstruction}\n2. When providing code fixes or suggestions, wrap them in markdown code blocks (e.g., \`\`\`javascript ... \`\`\`).\n3. Do NOT assume a new file is needed unless explicitly asked. Default to providing code snippets to be inserted into the active file.\n4. If a new file is absolutely necessary, explain why first.\n\nPROJECT FILES:\n${projectContext}`;

        const provider = currentUser.settings.provider || 'gemini';
        let apiKey, url, body;

        // Configure Request based on Provider
        if (provider === 'gemini') {
            apiKey = currentUser.settings.geminiKey;
            if (!apiKey) {
                updateChatMessage(loadingId, "Please configure your Google Gemini API Key in Settings.");
                return;
            }
            url = `https://generativelanguage.googleapis.com/v1beta/models/${currentUser.settings.geminiModel || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
            body = {
                contents: [{ parts: [{ text: fullSystemPrompt + "\n\nUser Query: " + prompt }] }]
            };
        } else if (provider === 'openai') {
            apiKey = currentUser.settings.openaiKey;
            if (!apiKey) {
                updateChatMessage(loadingId, "Please configure your OpenAI API Key in Settings.");
                return;
            }
            url = 'https://api.openai.com/v1/chat/completions';
            body = {
                model: currentUser.settings.openaiModel || 'gpt-4o',
                messages: [
                    { role: "system", content: fullSystemPrompt },
                    { role: "user", content: prompt }
                ]
            };
        } else if (provider === 'perplexity') {
            apiKey = currentUser.settings.perplexityKey;
            if (!apiKey) {
                updateChatMessage(loadingId, "Please configure your Perplexity API Key in Settings.");
                return;
            }
            url = 'https://api.perplexity.ai/chat/completions';
            body = {
                model: currentUser.settings.perplexityModel || 'sonar',
                messages: [
                    { role: "system", content: fullSystemPrompt },
                    { role: "user", content: prompt }
                ]
            };
        }
        
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (provider !== 'gemini') headers['Authorization'] = `Bearer ${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: signal
            });

            const data = await response.json();
            
            if (data.error) {
                const errMsg = data.error.message || (typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
                throw new Error(errMsg);
            }

            let aiText = '';
            if (provider === 'gemini') {
                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                    aiText = data.candidates[0].content.parts[0].text;
                } else if (data.promptFeedback) {
                    throw new Error(`Gemini blocked response: ${data.promptFeedback.blockReason}`);
                } else {
                    throw new Error("Gemini returned an empty response.");
                }
            }
            else if (provider === 'openai' || provider === 'perplexity') {
                if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                    aiText = data.choices[0].message.content;
                } else {
                    throw new Error("Provider returned an empty response.");
                }
            }

            updateChatMessage(loadingId, aiText);
            renderSystemLogs(); // Update logs

        } catch (error) {
            if (error.name === 'AbortError') {
                updateChatMessage(loadingId, '<em>Request cancelled.</em>');
                return;
            }
            console.error("AI Error:", error);
            updateChatMessage(loadingId, `Error: ${error.message}`);
        }
    }

    function appendChatMessage(sender, text, isLoading = false) {
        const div = document.createElement('div');
        const id = Date.now();
        div.id = `msg-${id}`;
        div.className = 'flex flex-col gap-1';
        div.innerHTML = `
            <span class="text-[10px] font-bold uppercase ${sender === 'User' ? 'text-blue-500' : 'text-red-500'}">${sender}</span>
            <div class="bg-zinc-900 p-2 rounded-sm border border-zinc-800 text-zinc-300 text-xs ${isLoading ? 'animate-pulse' : ''}">
                ${marked.parse(text)}
            </div>
        `;
        els.chatHistory.appendChild(div);
        els.chatHistory.scrollTop = els.chatHistory.scrollHeight;
        return id;
    }

    function updateChatMessage(id, text) {
        const div = document.getElementById(`msg-${id}`);
        if (div) {
            // Find the content container (second child of the message div)
            const contentDiv = div.lastElementChild;
            // Parse Markdown
            const rawHtml = marked.parse(text || '');
            contentDiv.innerHTML = rawHtml;

            // Enhance Code Blocks with Toolbar
            const pres = contentDiv.querySelectorAll('pre');
            pres.forEach(pre => {
                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.className = "bg-black rounded border border-zinc-800 my-2 overflow-hidden shadow-sm";
                
                // Toolbar
                const toolbar = document.createElement('div');
                toolbar.className = "flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800";
                
                // Language label
                const codeEl = pre.querySelector('code');
                let lang = 'CODE';
                let langClass = null;
                if (codeEl && codeEl.className) {
                    const match = codeEl.className.match(/language-(\w+)/);
                    if (match) {
                        lang = match[1].toUpperCase();
                        langClass = match[1];
                    }
                }
                
                const langLabel = document.createElement('span');
                langLabel.className = "text-[10px] font-bold text-zinc-500";
                langLabel.textContent = lang;
                
                const actions = document.createElement('div');
                actions.className = "flex gap-2";
                
                // Copy Button
                const btnCopy = document.createElement('button');
                btnCopy.className = "text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition";
                btnCopy.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i>';
                btnCopy.title = "Copy to Clipboard";
                btnCopy.onclick = () => { 
                    navigator.clipboard.writeText(codeEl.textContent); 
                    btnCopy.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-green-500"></i>';
                    setTimeout(() => btnCopy.innerHTML = '<i data-lucide="copy" class="w-3 h-3"></i>', 2000);
                };
                
                // Insert Button
                const btnInsert = document.createElement('button');
                btnInsert.className = "text-[10px] text-red-500 hover:text-red-400 flex items-center gap-1 transition font-bold";
                btnInsert.innerHTML = '<i data-lucide="arrow-left" class="w-3 h-3"></i> INSERT';
                btnInsert.title = "Insert at Cursor";
                btnInsert.onclick = () => { insertCodeAtCursor(codeEl.textContent, langClass); };
                
                actions.appendChild(btnCopy);
                actions.appendChild(btnInsert);
                
                toolbar.appendChild(langLabel);
                toolbar.appendChild(actions);
                
                // Inject Wrapper
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(toolbar);
                wrapper.appendChild(pre);
                
                // Reset pre styles for inside wrapper
                pre.style.margin = '0';
                pre.style.border = 'none';
            });
            
            lucide.createIcons();
        }
    }

    // --- USER GENERATION (Credential Modal) ---
    els.genUserBtn.addEventListener('click', () => {
        const adjectives = ['Cyber', 'Secure', 'Nano', 'Quantum', 'Iron', 'Neon'];
        const nouns = ['Wolf', 'Vault', 'Key', 'Ghost', 'User', 'Admin'];
        const randomNum = Math.floor(Math.random() * 9999);
        const user = adjectives[Math.floor(Math.random() * adjectives.length)] + 
                     nouns[Math.floor(Math.random() * nouns.length)] + 
                     randomNum;
        els.genUserInput.value = user;
    });

    els.genPassBtn.addEventListener('click', () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
        let pass = "";
        for (let i = 0; i < 16; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        els.genPassInput.value = pass;
    });

    els.saveCredBtn.addEventListener('click', () => {
        // Save generated credential as a new file
        const user = els.genUserInput.value;
        const pass = els.genPassInput.value;
        if (!user || !pass) return;

        const content = `Username: ${user}\nPassword: ${pass}\nGenerated: ${new Date().toLocaleString()}`;
        
        const newFile = {
            id: Date.now().toString(),
            title: `Creds_${user}`,
            content: content,
            language: 'text',
            type: 'file',
            parentId: null
        };
        currentUser.files.push(newFile);
        saveState();
        renderFileList();
        loadFile(newFile.id);
        
        document.getElementById('credential-modal').classList.add('hidden');
    });

    // --- SETTINGS ---
    // Provider Toggle Logic
    els.activeProvider.addEventListener('change', () => updateProviderUI(els.activeProvider.value));

    function updateProviderUI(provider) {
        els.configGemini.classList.add('hidden');
        els.configOpenai.classList.add('hidden');
        els.configPerplexity.classList.add('hidden');
        
        if (provider === 'gemini') els.configGemini.classList.remove('hidden');
        if (provider === 'openai') els.configOpenai.classList.remove('hidden');
        if (provider === 'perplexity') els.configPerplexity.classList.remove('hidden');
        
        document.getElementById('current-provider-badge').textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    els.saveSettingsBtn.addEventListener('click', () => {
        currentUser.settings.provider = els.activeProvider.value;
        currentUser.settings.geminiKey = els.geminiKeyInput.value.trim();
        currentUser.settings.geminiModel = els.geminiModelInput.value;
        currentUser.settings.openaiKey = els.openaiKeyInput.value.trim();
        currentUser.settings.openaiModel = els.openaiModelInput.value;
        currentUser.settings.perplexityKey = els.perplexityKeyInput.value.trim();
        currentUser.settings.perplexityModel = els.perplexityModelInput.value;

        currentUser.settings.syntaxKeyword = els.colorKeyword.value;
        currentUser.settings.syntaxString = els.colorString.value;
        currentUser.settings.syntaxFunction = els.colorFunction.value;
        
        currentUser.settings.autoLockMinutes = parseInt(els.settingAutoLock.value) || 0;
        currentUser.settings.fontSize = parseInt(els.settingFontSize.value) || 14;
        
        currentUser.settings.learningMode = els.settingLearningMode.checked;
        currentUser.settings.autoSave = els.settingAutoSave.checked;
        
        saveState();
        document.getElementById('settings-modal').classList.add('hidden');
        
        applyEditorSettings();
        resetIdleTimer();

        // Refresh AI Chat on change
        els.chatHistory.innerHTML = '';
        appendChatMessage('System', `AI Settings updated. Active Provider: ${currentUser.settings.provider.toUpperCase()}`);
        alert("Settings Saved");
    });

    function applySyntaxColors() {
        const root = document.documentElement;
        root.style.setProperty('--syntax-keyword', currentUser.settings.syntaxKeyword);
        root.style.setProperty('--syntax-string', currentUser.settings.syntaxString);
        root.style.setProperty('--syntax-function', currentUser.settings.syntaxFunction);
    }
    
    function applyEditorSettings() {
        const size = currentUser.settings.fontSize || 14;
        document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
    }

    // Reset Colors
    els.resetColorsBtn.addEventListener('click', () => {
        els.colorKeyword.value = '#cc99cd';
        els.colorString.value = '#7ec699';
        els.colorFunction.value = '#61aeee';
    });

    // --- AUTO LOCK SYSTEM ---
    let idleTimeout;
    
    function startIdleTimer() {
        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('keydown', resetIdleTimer);
        resetIdleTimer();
    }

    function resetIdleTimer() {
        if (!currentUser) return;
        if (idleTimeout) clearTimeout(idleTimeout);
        
        const minutes = currentUser.settings.autoLockMinutes;
        if (minutes && minutes > 0) {
            idleTimeout = setTimeout(lockVault, minutes * 60 * 1000);
        }
    }

    function lockVault() {
        if (!currentUser) return;
        currentUser = null;
        logEvent('AUTO_LOCK', 'System auto-locked due to inactivity');
        renderSystemLogs();
        performLockout();
    }

    function performLockout() {
        els.appLayout.classList.add('hidden', 'opacity-0');
        els.authScreen.classList.remove('hidden');
        setTimeout(() => els.authScreen.classList.remove('opacity-0', 'pointer-events-none'), 10);
        els.passwordInput.value = '';
        els.authError.classList.add('hidden');
        els.chatHistory.innerHTML = ''; // Clear chat
    }

    // --- LOG OFF ---
    if (els.relockBtn) {
        els.relockBtn.addEventListener('click', () => {
            currentUser = null;
            logEvent('LOGOUT', 'User logged out');
            renderSystemLogs();
            performLockout();
        });
    }

    // --- MODAL HANDLERS ---
    setupModal('open-settings-btn', 'settings-modal', 'close-settings-btn');
    setupModal('open-cred-btn', 'credential-modal', 'close-cred-btn');
    
    // Reset Modal
    const resetModal = document.getElementById('reset-modal');
    document.getElementById('show-reset-btn').addEventListener('click', () => resetModal.classList.remove('hidden'));
    document.getElementById('cancel-reset-btn').addEventListener('click', () => resetModal.classList.add('hidden'));
    document.getElementById('confirm-reset-btn').addEventListener('click', () => {
        // No log event here because data is wiped
        // Wipes the session and reloads the page.
        location.reload();
    });

    // Phone Login (Mock)
    const phoneBtn = document.getElementById('phone-login-btn');
    const remoteContainer = document.getElementById('remote-login-container');
    const cancelRemote = document.getElementById('cancel-remote-btn');
    
    phoneBtn.addEventListener('click', () => {
        els.loginContainer.classList.add('hidden');
        remoteContainer.classList.remove('hidden');
        
        // Generate Security Key
        sessionSecurityKey = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Generate QR
        const qrContainer = document.getElementById('remote-qr-display');
        qrContainer.innerHTML = '';
        new QRCode(qrContainer, {
            text: `https://securevault.app/auth?id=${sessionSecurityKey}`,
            width: 128,
            height: 128
        });
        
        // Click to simulate scan
        qrContainer.onclick = () => {
            remoteContainer.classList.add('hidden');
            document.getElementById('phone-auth-container').classList.remove('hidden');
        };
    });

    cancelRemote.addEventListener('click', () => {
        remoteContainer.classList.add('hidden');
        els.loginContainer.classList.remove('hidden');
    });
    
    // Passkey Simulation
    document.getElementById('passkey-btn').addEventListener('click', () => {
        const btn = document.getElementById('passkey-btn');
        const originalContent = btn.innerHTML;
        
        // Simulate FaceID scanning
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Verifying...`;
        lucide.createIcons();
        
        setTimeout(() => {
            document.getElementById('phone-auth-container').classList.add('hidden');
            // Log in as admin
            currentUser = appState.users.find(u => u.role === 'admin') || appState.users[0];
            loginSuccess();
            
            // Reset button for next time
            btn.innerHTML = originalContent;
        }, 1500);
    });

    function setupModal(triggerId, modalId, closeId) {
        const trigger = document.getElementById(triggerId);
        const modal = document.getElementById(modalId);
        const close = document.getElementById(closeId);
        
        if (trigger && modal && close) {
            trigger.addEventListener('click', () => modal.classList.remove('hidden'));
            close.addEventListener('click', () => modal.classList.add('hidden'));
        }
    }

    // --- BOTTOM PANEL TABS ---
    if (tabBtnLogs && tabBtnTerminal) {
        tabBtnLogs.addEventListener('click', () => switchTab('logs'));
        tabBtnTerminal.addEventListener('click', () => switchTab('terminal'));
        if (termClearBtn) termClearBtn.addEventListener('click', () => { termOutput.innerHTML = ''; });
    }

    function switchTab(tab) {
        if (tab === 'logs') {
            tabLogs.classList.remove('hidden');
            tabTerminal.classList.add('hidden');
            tabBtnLogs.classList.add('active-tab-btn', 'text-red-500', 'border-red-600');
            tabBtnLogs.classList.remove('text-zinc-400', 'border-transparent');
            tabBtnTerminal.classList.remove('active-tab-btn', 'text-red-500', 'border-red-600');
            tabBtnTerminal.classList.add('text-zinc-400', 'border-transparent');
            if (termClearBtn) termClearBtn.classList.add('hidden');
        } else if (tab === 'terminal') {
            tabLogs.classList.add('hidden');
            tabTerminal.classList.remove('hidden');
            tabBtnTerminal.classList.add('active-tab-btn', 'text-red-500', 'border-red-600');
            tabBtnTerminal.classList.remove('text-zinc-400', 'border-transparent');
            tabBtnLogs.classList.remove('active-tab-btn', 'text-red-500', 'border-red-600');
            tabBtnLogs.classList.add('text-zinc-400', 'border-transparent');
            if (termClearBtn) termClearBtn.classList.remove('hidden');
            setTimeout(() => termInput.focus(), 10);
        }
    }

    // --- TERMINAL LOGIC ---
    if (termInput) {
        termInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cmd = termInput.value.trim();
                if (cmd) {
                    termHistory.push(cmd);
                    termHistoryIndex = termHistory.length;
                    executeTerminalCommand(cmd);
                    termInput.value = '';
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (termHistoryIndex > 0) {
                    termHistoryIndex--;
                    termInput.value = termHistory[termHistoryIndex];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (termHistoryIndex < termHistory.length - 1) {
                    termHistoryIndex++;
                    termInput.value = termHistory[termHistoryIndex];
                } else {
                    termHistoryIndex = termHistory.length;
                    termInput.value = '';
                }
            }
        });
    }

    function executeTerminalCommand(cmdStr) {
        if (!currentUser || currentUser.role !== 'admin') {
            printTerminal('Access Denied: Admin privileges required.', 'error');
            return;
        }

        printTerminal(`admin@vault:~$ ${cmdStr}`, 'cmd');
        logEvent('TERM_CMD', cmdStr);

        const parts = cmdStr.split(' ');
        const cmd = parts[0].toLowerCase();

        switch (cmd) {
            case 'help':
                printTerminal('Available commands: help, clear, status, users, files, logs, lock, whoami, test-ai, debug', 'info');
                break;
            case 'clear':
                termOutput.innerHTML = '';
                break;
            case 'status':
                printTerminal(`Users: ${appState.users.length} | Files: ${appState.users.reduce((acc, u) => acc + (u.files ? u.files.length : 0), 0)}`, 'success');
                break;
            case 'users':
                appState.users.forEach(u => printTerminal(`- ${u.username} [${u.role}]`, 'success'));
                break;
            case 'files':
                currentUser.files.forEach(f => printTerminal(`- ${f.title} (${f.language})`, 'success'));
                break;
            case 'logs':
                appState.logs.slice(0, 5).forEach(l => printTerminal(`[${l.action}] ${l.details}`, 'warn'));
                break;
            case 'lock':
                lockVault();
                break;
            case 'whoami':
                printTerminal(`User: ${currentUser.username} | Role: ${currentUser.role}`, 'success');
                break;
            case 'test-ai':
                const simId = appendChatMessage('System', 'Simulating AI response...', true);
                setTimeout(() => {
                    const mockText = "Simulation successful. Here is a secure initialization function:\n\n```javascript\nfunction initSecureSystem() {\n    console.log('System initialized securely.');\n    return { status: 'online', encrypted: true };\n}\n```\n\nThis is a mock response for testing UI rendering.";
                    updateChatMessage(simId, mockText);
                    printTerminal('AI simulation test complete.', 'success');
                }, 1000);
                break;
            case 'debug':
                const p = currentUser.settings.provider || 'gemini';
                let k = '';
                let m = '';
                
                if (p === 'gemini') { k = currentUser.settings.geminiKey; m = currentUser.settings.geminiModel; }
                else if (p === 'openai') { k = currentUser.settings.openaiKey; m = currentUser.settings.openaiModel; }
                else if (p === 'perplexity') { k = currentUser.settings.perplexityKey; m = currentUser.settings.perplexityModel; }

                printTerminal('[AI DIAGNOSTICS]', 'warn');
                printTerminal(`Active Provider: ${p.toUpperCase()}`, 'info');
                printTerminal(`Selected Model: ${m}`, 'info');
                
                if (!k || k.trim() === '') {
                    printTerminal('ERROR: No API Key found.', 'error');
                    printTerminal('FIX: Go to Settings -> Select Provider -> Paste API Key.', 'warn');
                } else {
                    printTerminal(`API Key: Configured (${k.substring(0, 4)}...)`, 'success');
                    printTerminal('If AI fails, check internet connection or quota.', 'info');
                }
                break;
            default:
                printTerminal(`Command not found: ${cmd}`, 'error');
        }
    }

    function printTerminal(text, type = 'info') {
        const div = document.createElement('div');
        div.className = `term-line ${type === 'error' ? 'term-error' : type === 'success' ? 'term-success' : type === 'warn' ? 'term-warn' : type === 'cmd' ? 'term-cmd' : 'term-info'}`;
        div.textContent = text;
        termOutput.appendChild(div);
        tabTerminal.scrollTop = tabTerminal.scrollHeight;
    }

    // --- EDITOR HELPERS ---
    function insertCodeAtCursor(text, langHint = null) {
        const editor = els.codeEditor;
        if (!editor) return;
        
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const val = editor.value;
        
        editor.value = val.substring(0, start) + text + val.substring(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        
        // Auto-detect language from AI hint if current file is text
        if (langHint && els.fileLang.value === 'text') {
            const mapped = markdownLangMap[langHint.toLowerCase()];
            if (mapped) {
                els.fileLang.value = mapped;
                // Trigger change to update extension and highlighting
                els.fileLang.dispatchEvent(new Event('change'));
            }
        }
        
        // Trigger input event for highlighting
        editor.dispatchEvent(new Event('input'));
        editor.focus();
    }

    // --- FIND AND REPLACE ---
    if (els.findWidget) {
        // Toggle Widget
        els.codeEditor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                els.findWidget.classList.remove('hidden');
                els.findInput.focus();
                // Pre-fill with selection
                const selection = els.codeEditor.value.substring(els.codeEditor.selectionStart, els.codeEditor.selectionEnd);
                if (selection) els.findInput.value = selection;
            }
        });

        els.closeFindBtn.addEventListener('click', () => els.findWidget.classList.add('hidden'));

        // Find Next
        const findNext = () => {
            const term = els.findInput.value;
            if (!term) return;
            const text = els.codeEditor.value;
            const startPos = els.codeEditor.selectionEnd;
            let index = text.indexOf(term, startPos);
            
            if (index === -1) {
                // Wrap around
                index = text.indexOf(term, 0);
            }
            
            if (index !== -1) {
                els.codeEditor.focus();
                els.codeEditor.setSelectionRange(index, index + term.length);
            } else {
                // Visual feedback could be added here
            }
        };

        els.findNextBtn.addEventListener('click', findNext);
        els.findInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') findNext(); });

        // Replace One
        els.replaceBtn.addEventListener('click', () => {
            const term = els.findInput.value;
            const replacement = els.replaceInput.value;
            if (!term) return;
            
            const start = els.codeEditor.selectionStart;
            const end = els.codeEditor.selectionEnd;
            const selectedText = els.codeEditor.value.substring(start, end);
            
            if (selectedText === term) {
                els.codeEditor.setRangeText(replacement, start, end, 'select');
                els.codeEditor.dispatchEvent(new Event('input'));
                findNext();
            } else {
                findNext();
            }
        });

        // Replace All
        els.replaceAllBtn.addEventListener('click', () => {
            const term = els.findInput.value;
            const replacement = els.replaceInput.value;
            if (!term) return;
            
            const text = els.codeEditor.value;
            const newText = text.split(term).join(replacement);
            
            if (text !== newText) {
                els.codeEditor.value = newText;
                els.codeEditor.dispatchEvent(new Event('input'));
            }
        });
    }

    // --- COMMAND PALETTE ---
    const commands = [
        { id: 'save', label: 'File: Save', shortcut: 'Ctrl+S', action: () => els.saveBtn.click() },
        { id: 'format', label: 'Editor: Format Document', shortcut: '', action: () => alert('Format not implemented yet') },
        { id: 'zoomIn', label: 'View: Zoom In', shortcut: 'Ctrl+WheelUp', action: () => { currentUser.settings.fontSize++; applyEditorSettings(); saveState(); } },
        { id: 'zoomOut', label: 'View: Zoom Out', shortcut: 'Ctrl+WheelDown', action: () => { currentUser.settings.fontSize--; applyEditorSettings(); saveState(); } },
        { id: 'toggleWrap', label: 'View: Toggle Word Wrap', shortcut: 'Alt+Z', action: () => { 
            els.codeEditor.style.whiteSpace = els.codeEditor.style.whiteSpace === 'pre-wrap' ? 'pre' : 'pre-wrap';
            els.highlighting.style.whiteSpace = els.codeEditor.style.whiteSpace;
        }},
        { id: 'closeTab', label: 'View: Close Current Tab', shortcut: '', action: () => { if(activeFileId) closeTab(activeFileId); } },
        { id: 'reload', label: 'Window: Reload Window', shortcut: '', action: () => location.reload() },
    ];

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
            e.preventDefault();
            els.commandPalette.classList.remove('hidden');
            els.cmdInput.value = '';
            els.cmdInput.focus();
            renderCommands('');
        }
        if (e.key === 'Escape') els.commandPalette.classList.add('hidden');
    });

    els.cmdInput.addEventListener('input', (e) => renderCommands(e.target.value));

    function renderCommands(filter) {
        els.cmdList.innerHTML = '';
        const filtered = commands.filter(c => c.label.toLowerCase().includes(filter.toLowerCase()));
        
        filtered.forEach(cmd => {
            const div = document.createElement('div');
            div.className = 'cmd-item';
            div.innerHTML = `<span>${cmd.label}</span> <span class="cmd-shortcut">${cmd.shortcut}</span>`;
            div.addEventListener('click', () => {
                cmd.action();
                els.commandPalette.classList.add('hidden');
            });
            els.cmdList.appendChild(div);
        });
        
        if (filtered.length === 0) {
            els.cmdList.innerHTML = '<div class="p-2 text-xs text-zinc-500">No commands found</div>';
        }
    }
});