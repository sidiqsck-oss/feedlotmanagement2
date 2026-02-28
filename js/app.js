/* ============================================
   APP.JS — Main Application Entry Point
   SPA Router, Event Wiring, Initialization
   ============================================ */
(async function () {
    'use strict';

    // --- 1. Initialize DB ---
    try {
        await DB.open();
        console.log('Database opened');
    } catch (err) {
        console.error('DB open error:', err);
        alert('Gagal membuka database: ' + err.message);
        return;
    }

    // --- 2. Initialize Auth ---
    const savedUser = await Auth.init();

    // --- 3. Login Flow ---
    const pageLogin = document.getElementById('pageLogin');
    const pageMain = document.getElementById('pageMain');
    const loginError = document.getElementById('loginError');

    if (savedUser) {
        showMainApp(savedUser);
    }

    document.getElementById('btnLogin').addEventListener('click', handleLogin);
    document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('loginUsername').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });

    async function handleLogin() {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!username || !password) {
            loginError.textContent = 'Username dan password wajib diisi';
            return;
        }
        const result = await Auth.login(username, password);
        if (result.success) {
            loginError.textContent = '';
            showMainApp(result.user);
        } else {
            loginError.textContent = result.message;
        }
    }

    function showMainApp(user) {
        pageLogin.classList.add('hidden');
        pageMain.classList.remove('hidden');
        document.getElementById('headerUser').textContent = `👤 ${user.username}`;

        // Apply permissions to nav tabs
        applyPermissions(user);

        // Initialize modules
        initModules();
    }

    // --- 4. Logout ---
    document.getElementById('btnLogout').addEventListener('click', () => {
        Auth.logout();
        pageMain.classList.add('hidden');
        pageLogin.classList.remove('hidden');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        loginError.textContent = '';
    });

    // --- 5. Permission-based navigation ---
    function applyPermissions(user) {
        const tabMap = {
            'tabDashboard': 'dashboard',
            'tabInduksi': 'induksi',
            'tabReweight': 'reweight',
            'tabPenjualan': 'penjualan',
            'tabSettings': 'settings'
        };

        Object.entries(tabMap).forEach(([tabId, perm]) => {
            const tab = document.getElementById(tabId);
            if (Auth.hasPermission(perm)) {
                tab.classList.remove('hidden');
            } else {
                tab.classList.add('hidden');
            }
        });
    }

    // --- 6. SPA Router ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const pages = document.querySelectorAll('.page-section');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPage = tab.dataset.page;
            // Switch active tab
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // Switch active page
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(targetPage).classList.add('active');

            // Refresh data when switching to page
            if (targetPage === 'pageDashboard') Dashboard.refresh();
            if (targetPage === 'pageInduksi') { Induksi.refreshTable(); Induksi.refreshSummary(); Induksi.refreshSummaryJenis(); }
            if (targetPage === 'pageReweight') { Reweight.refreshTable(); Reweight.refreshSummaryAwal(); Reweight.refreshSummaryAkhir(); Reweight.refreshDetail(); Reweight.refreshSummaryJenis(); }
            if (targetPage === 'pagePenjualan') { Penjualan.refreshHistory(); Penjualan.refreshTarikData(); Penjualan.refreshTarikDataDetail(); }
        });
    });

    // --- 7. Initialize modules ---
    async function initModules() {
        try {
            await Induksi.init();
            await Reweight.init();
            await Penjualan.init();
            await Dashboard.init();
            await SupabaseSync.initUI();
        } catch (err) {
            console.error('Module init error:', err);
        }
    }

    // --- 8. Scale weight display ---
    window.addEventListener('scale-data', (e) => {
        const valueEl = document.getElementById('weightValue');
        if (valueEl) {
            valueEl.textContent = Utils.formatNumber(e.detail.weight);
        }
    });

    // --- 9. Serial Connect Buttons ---
    document.getElementById('btnConnectScanner').addEventListener('click', () => {
        if (typeof SerialManager !== 'undefined' && SerialManager.isSupported()) {
            SerialManager.toggleScanner();
        } else {
            Utils.showToast('Web Serial API tidak didukung', 'error');
        }
    });

    document.getElementById('btnConnectScale').addEventListener('click', () => {
        if (typeof SerialManager !== 'undefined' && SerialManager.isSupported()) {
            SerialManager.toggleScale();
        } else {
            Utils.showToast('Web Serial API tidak didukung', 'error');
        }
    });

    // --- 10. Backup buttons ---
    document.getElementById('btnExportBackup').addEventListener('click', () => Backup.exportAll());
    document.getElementById('btnImportBackup').addEventListener('click', () => document.getElementById('backupImportFile').click());
    document.getElementById('backupImportFile').addEventListener('change', (e) => {
        if (e.target.files[0]) { Backup.importAll(e.target.files[0]); e.target.value = ''; }
    });

    // --- 11. Supabase Sync buttons ---
    document.getElementById('btnSyncUpload').addEventListener('click', () => SupabaseSync.upload());
    document.getElementById('btnSyncDownload').addEventListener('click', () => SupabaseSync.download());
    document.getElementById('btnSupabaseSetup').addEventListener('click', () => {
        // Load current config into modal
        const url = window._supabaseUrl || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || '';
        const key = window._supabaseKey || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || '';
        document.getElementById('supabaseUrl').value = url;
        document.getElementById('supabaseKey').value = key;
        Utils.openModal('modalSupabase');
    });
    document.getElementById('btnSaveSupabase').addEventListener('click', async () => {
        const url = document.getElementById('supabaseUrl').value.trim();
        const key = document.getElementById('supabaseKey').value.trim();
        if (!url || !key) { Utils.showToast('URL dan Key wajib diisi', 'warning'); return; }
        await SupabaseSync.saveConfig(url, key);
        Utils.showToast('Konfigurasi Supabase berhasil disimpan', 'success');
        Utils.closeModal('modalSupabase');
    });
    document.getElementById('btnCloseSupabase').addEventListener('click', () => Utils.closeModal('modalSupabase'));

    // --- 12. Master Data Modal ---
    document.querySelectorAll('.btn-add-master').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const titles = {
                shipment: 'Shipment', frame: 'Frame', kodeProperty: 'Kode Property',
                jenisSapi: 'Jenis Sapi', pembeli: 'Pembeli'
            };
            document.getElementById('masterModalTitle').textContent = `Tambah ${titles[type] || type}`;
            document.getElementById('masterType').value = type;
            document.getElementById('masterValue').value = '';
            Utils.openModal('modalMaster');
            document.getElementById('masterValue').focus();
        });
    });

    document.getElementById('btnSaveMaster').addEventListener('click', async () => {
        const type = document.getElementById('masterType').value;
        const value = document.getElementById('masterValue').value.trim();
        if (!value) { Utils.showToast('Nilai wajib diisi', 'warning'); return; }
        await DB.addMaster(type, value);
        Utils.showToast(`"${value}" berhasil ditambahkan`, 'success');
        DB.addLog('Master', `Added ${type}: ${value}`);
        Utils.closeModal('modalMaster');
        // Reload dropdowns
        if (['shipment', 'frame', 'kodeProperty', 'jenisSapi'].includes(type)) {
            await Induksi.loadDropdowns();
        }
        if (type === 'pembeli') {
            await Penjualan.loadPembeliDropdown();
        }
    });
    document.getElementById('masterValue').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btnSaveMaster').click();
    });
    document.getElementById('btnCloseMaster').addEventListener('click', () => Utils.closeModal('modalMaster'));

    // --- 13. User Management Modal ---
    document.getElementById('btnOpenUserMgmt').addEventListener('click', async () => {
        if (!Auth.isAdmin()) { Utils.showToast('Hanya admin yang bisa mengelola user', 'warning'); return; }
        await refreshUserList();
        Utils.openModal('modalUserMgmt');
    });
    document.getElementById('btnCloseUserMgmt').addEventListener('click', () => Utils.closeModal('modalUserMgmt'));

    document.getElementById('btnAddUser').addEventListener('click', async () => {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('newRole').value;
        if (!username || !password) { Utils.showToast('Username dan password wajib diisi', 'warning'); return; }
        const permissions = {
            induksi: document.getElementById('permInduksi').checked,
            reweight: document.getElementById('permReweight').checked,
            penjualan: document.getElementById('permPenjualan').checked,
            dashboard: document.getElementById('permDashboard').checked,
            settings: document.getElementById('permSettings').checked,
        };
        const result = await Auth.addUser(username, password, role, permissions);
        if (result.success) {
            Utils.showToast(`User "${username}" berhasil ditambahkan`, 'success');
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '';
            await refreshUserList();
        } else {
            Utils.showToast(result.message, 'error');
        }
    });

    async function refreshUserList() {
        const tbody = document.getElementById('userListBody');
        const users = await Auth.getAllUsers();
        tbody.innerHTML = users.map(u => {
            const perms = u.permissions || {};
            const permStr = Object.keys(perms).filter(k => perms[k]).join(', ');
            return `<tr>
                <td>${u.username}</td>
                <td>${u.role}</td>
                <td>${permStr || '-'}</td>
                <td>${u.username !== 'Sidiq23' ? `<button class="btn btn-sm btn-danger" onclick="App.deleteUser('${u.username}')">🗑️</button>` : '<em>Admin</em>'}</td>
            </tr>`;
        }).join('');
    }

    // Expose deleteUser globally for onclick
    window.App = {
        deleteUser: async function (username) {
            if (!confirm(`Hapus user "${username}"?`)) return;
            const result = await Auth.deleteUser(username);
            if (result.success) {
                Utils.showToast(`User "${username}" dihapus`, 'success');
                await refreshUserList();
            } else {
                Utils.showToast(result.message, 'error');
            }
        }
    };

    // --- 14. Activity Log Modal ---
    document.getElementById('btnViewLog').addEventListener('click', async () => {
        const tbody = document.getElementById('logTableBody');
        const logs = await DB.getAll('logs');
        logs.reverse(); // newest first
        tbody.innerHTML = logs.slice(0, 100).map(l => `
            <tr>
                <td>${new Date(l.timestamp).toLocaleString('id-ID')}</td>
                <td>${l.action}</td>
                <td>${l.detail}</td>
            </tr>
        `).join('');
        Utils.openModal('modalLog');
    });
    document.getElementById('btnCloseLog').addEventListener('click', () => Utils.closeModal('modalLog'));

    // --- 15. Close modals on overlay click ---
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });

    // --- 16. Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.warn('SW registration failed:', err));
    }

    console.log('App initialized');
})();
