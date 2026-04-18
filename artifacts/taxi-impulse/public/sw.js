const CACHE_NAME = "taxi-impulse-v4";
// Ресурсы для предзакэширования при установке
const PRECACHE = ["/", "/manifest.webmanifest", "/logo.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API запросы — никогда не кэшируем, всегда сеть
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api/")) return;

  // Статические ресурсы (JS/CSS/fonts/images) — Cache-First
  // При наличии в кэше возвращаем сразу, фоном обновляем
  const isStaticAsset = url.pathname.match(/\.(js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|ico|webp|gif)$/);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
          }
          return res;
        }).catch(() => cached || Response.error());
        // Если есть в кэше — вернём сразу, обновим фоном
        return cached || networkFetch;
      })
    );
    return;
  }

  // HTML и навигация — Network-First с fallback на кэш
  // Никогда не возвращаем Response.error() для навигации — это вызывает чёрный экран
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(async () => {
        // Fallback: сначала точное совпадение, потом корневой "/" для SPA
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Для SPA-навигации всегда отдаём корневой index.html из кэша
        if (event.request.mode === "navigate") {
          const root = await caches.match("/");
          if (root) return root;
        }
        // Пустой 200-ответ чтобы не показывать "ошибку" браузера
        return new Response("", { status: 200, headers: { "Content-Type": "text/html" } });
      })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "TAXI IMPULSE", body: event.data.text() };
  }

  const { title, body, icon, badge, tag, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "TAXI IMPULSE", {
      body: body || "",
      icon: icon || "/logo.png",
      badge: badge || "/logo.png",
      tag: tag || "taxi-notification",
      renotify: true,
      requireInteraction: true,
      data: data || {},
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if (client.navigate) client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
