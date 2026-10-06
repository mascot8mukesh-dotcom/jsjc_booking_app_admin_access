/* JSJC Smart Booking App — service-worker.js (N38)
   Rules: the app shell (HTML, manifest, this file) is ALWAYS fetched from the network first, so a new deployment
   is picked up on the next open. Supabase / API traffic is never touched. Old caches are deleted on activate. */
const VERSION = 'N38';
const CACHE   = 'jsjc-shell-' + VERSION;
const OFFLINE_FALLBACK = ['./', './index.html', './manifest.json', './favicon.ico', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){
    return Promise.all(OFFLINE_FALLBACK.map(function(u){ return c.add(new Request(u,{cache:'reload'})).catch(function(){}); }));
  }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); })); })
      .then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('message', function(e){ if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', function(e){
  var req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== self.location.origin) return;      // never touch Supabase / Firebase / CDNs / writes
  var isShell = req.mode === 'navigate' || /\.(html|json)$/.test(url.pathname) || url.pathname.endsWith('/') || url.pathname.endsWith('service-worker.js');
  if(isShell){
    e.respondWith(
      fetch(req, {cache:'no-store'}).then(function(res){
        if(res && res.ok && req.mode === 'navigate'){ var copy = res.clone(); caches.open(CACHE).then(function(c){ c.put('./index.html', copy); }); }
        return res;
      }).catch(function(){ return caches.match(req).then(function(r){ return r || caches.match('./index.html'); }); })
    );
    return;
  }
  e.respondWith(caches.match(req).then(function(hit){
    var net = fetch(req).then(function(res){ if(res && res.ok){ var cp=res.clone(); caches.open(CACHE).then(function(c){ c.put(req,cp); }); } return res; }).catch(function(){ return hit; });
    return hit || net;
  }));
});
