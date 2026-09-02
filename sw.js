const CACHE_NAME = 'siblings-detector-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800;900&family=Vazirmatn:wght@400;500;600;700;800;900&display=swap'
];

// تثبيت ملفات التطبيق مسبقاً للعمل دون إنترنت فوراً
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // محاولة تخزين كافة الأصول الهامة
      for (const asset of ASSETS_TO_CACHE) {
        try {
          await cache.add(new Request(asset, { mode: 'cors' }));
        } catch (err) {
          try {
            await cache.add(asset);
          } catch (e) {
            // تخطي الموارد غير المتاحة مؤقتاً
          }
        }
      }
    })
  );
  self.skipWaiting();
});

// تنظيف وتحديث الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// جلب الموارد: البحث في الكاش أولاً (أوفلاين)، ثم جلب وتحديث من الإنترنت (أونلاين)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // تحديث الكاش في الخلفية عند توفر الإنترنت (Stale-While-Revalidate)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // إذا لم يكن مخزناً مسبقاً، جلبه من الشبكة وتخزينه فوراً
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // إذا كان الجهاز غير متصل بالإنترنت ومسار الملاحة HTML
          if (event.request.headers.get('accept')?.includes('text/html') || event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
