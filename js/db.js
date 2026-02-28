/* ============================================
   DATABASE LAYER — IndexedDB
   ============================================ */
const DB = (() => {
    const DB_NAME = 'CattleManagementDB';
    const DB_VERSION = 2;
    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const database = e.target.result;

                // induksi — keyed by rfid
                if (!database.objectStoreNames.contains('induksi')) {
                    const store = database.createObjectStore('induksi', { keyPath: 'rfid' });
                    store.createIndex('shipment', 'shipment', { unique: false });
                    store.createIndex('pen', 'pen', { unique: false });
                    store.createIndex('eartag', 'eartag', { unique: false });
                    store.createIndex('tanggal', 'tanggal', { unique: false });
                }

                // reweight — auto-increment id
                if (!database.objectStoreNames.contains('reweight')) {
                    const store = database.createObjectStore('reweight', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rfid', 'rfid', { unique: false });
                    store.createIndex('shipment', 'shipment', { unique: false });
                    store.createIndex('penAwal', 'penAwal', { unique: false });
                    store.createIndex('penAkhir', 'penAkhir', { unique: false });
                    store.createIndex('tanggal', 'tanggal', { unique: false });
                }

                // penjualan — auto-increment id
                if (!database.objectStoreNames.contains('penjualan')) {
                    const store = database.createObjectStore('penjualan', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rfid', 'rfid', { unique: false });
                    store.createIndex('pembeli', 'pembeli', { unique: false });
                    store.createIndex('tanggalJual', 'tanggalJual', { unique: false });
                }

                // master_data — composite key [type, value]
                if (!database.objectStoreNames.contains('master_data')) {
                    const store = database.createObjectStore('master_data', { keyPath: ['type', 'value'] });
                    store.createIndex('type', 'type', { unique: false });
                }

                // users — keyed by username
                if (!database.objectStoreNames.contains('users')) {
                    database.createObjectStore('users', { keyPath: 'username' });
                }

                // settings — key-value store
                if (!database.objectStoreNames.contains('settings')) {
                    database.createObjectStore('settings', { keyPath: 'key' });
                }

                // logs — auto-increment
                if (!database.objectStoreNames.contains('logs')) {
                    const store = database.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- Generic CRUD ---
    function add(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(data); // put = add or update
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function getAll(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function getAllByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function update(storeName, data) {
        return add(storeName, data); // put handles both add and update
    }

    function remove(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    function clear(storeName) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // --- Master Data helpers ---
    async function getMasterByType(type) {
        const all = await getAllByIndex('master_data', 'type', type);
        return all.map(item => item.value);
    }

    async function addMaster(type, value) {
        return add('master_data', { type, value });
    }

    // --- Full Export/Import for backup ---
    async function exportAll() {
        const stores = ['induksi', 'reweight', 'penjualan', 'master_data', 'users', 'settings', 'logs'];
        const backup = { _version: DB_VERSION, _date: new Date().toISOString() };
        for (const name of stores) {
            backup[name] = await getAll(name);
        }
        return backup;
    }

    async function importAll(data) {
        const stores = ['induksi', 'reweight', 'penjualan', 'master_data', 'users', 'settings', 'logs'];
        for (const name of stores) {
            if (data[name]) {
                await clear(name);
                for (const item of data[name]) {
                    await add(name, item);
                }
            }
        }
    }

    // --- Log helpers ---
    async function addLog(action, detail) {
        try {
            await add('logs', {
                timestamp: new Date().toISOString(),
                action,
                detail
            });
        } catch (err) {
            console.warn('Log write error:', err);
        }
    }

    // --- Get sold RFIDs (for filtering) ---
    async function getSoldRfids() {
        const sales = await getAll('penjualan');
        return new Set(sales.map(s => s.rfid));
    }

    return {
        open, add, get, getAll, getAllByIndex, update, remove, clear,
        getMasterByType, addMaster,
        exportAll, importAll, addLog, getSoldRfids
    };
})();
