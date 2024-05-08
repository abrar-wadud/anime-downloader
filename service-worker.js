self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open('anime-downloader-v1').then(function(cache) {
      return cache.addAll([
        '/',
        'index.html',
        'styles.css',
        'script.js',
        'icon.png',
        // Add more files to cache as needed
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
