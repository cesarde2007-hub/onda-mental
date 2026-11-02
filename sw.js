/* Onda Mental — caché offline
   Estrategia: red primero (para recibir cambios) y caché como respaldo.
   Solo se cachean peticiones GET del mismo origen. */
'use strict';

var CACHE = 'onda-mental-v3';
var CORE = [
  './',
  './index.html',
  './assets/styles.css?v=3',
  './assets/protocols.js?v=3',
  './assets/audio.js?v=3',
  './assets/app.js?v=3',
  './assets/icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (key) { return key !== CACHE; })
          .map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(request, copy).catch(function () { /* cuota llena */ });
          }).catch(function () { /* sin caché */ });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (hit) {
          if (hit) return hit;
          // Solo las navegaciones caen a la página principal; un CSS o JS no
          // debe recibir HTML como respuesta.
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
