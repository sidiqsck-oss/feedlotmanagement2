const CACHE_NAME = 'feedlot-v3';
const ASSETS_TO_CACHE = [
    'feedlotmanagement2/',
    'feedlotmanagement2/index.html',
    'feedlotmanagement2/css/style.css',
    'feedlotmanagement2/js/app.js',
    'feedlotmanagement2/js/auth.js',
    'feedlotmanagement2/js/db.js',
    'feedlotmanagement2/js/serial-manager.js',
    'feedlotmanagement2/js/induksi.js',
    'feedlotmanagement2/js/reweight.js',
    'feedlotmanagement2/js/penjualan.js',
    'feedlotmanagement2/js/dashboard.js',
    'feedlotmanagement2/js/utils.js',
    'feedlotmanagement2/js/backup.js',
    'feedlotmanagement2/js/supabase-sync.js',
    'feedlotmanagement2/libs/xlsx.full.min.js',
    'feedlotmanagement2/libs/jspdf.umd.min.js',
    'feedlotmanagement2/libs/jspdf.plugin.autotable.umd.min.js',
    'feedlotmanagement2/manifest.json',
    'feedlotmanagement2/icons/icon-192.png',
    'feedlotmanagement2/icons/icon-512.png'
];

// Install — cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Network-first for Supabase API calls
    if (url.hostname.includes('supabase')) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for everything else
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        })
    );
});
