import { useEffect, useRef } from "react";
import { useAuthHeaders } from "./use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(userId?: number, role?: string, workCity?: string) {
  const authHeaders = useAuthHeaders();
  const subscribedRef = useRef(false);
  const endpointRef = useRef<string | null>(null);
  // Всегда держим актуальные значения через refs (фикс stale closure в async)
  const authHeadersRef = useRef(authHeaders.headers);
  authHeadersRef.current = authHeaders.headers;
  const workCityRef = useRef<string | undefined>(workCity);
  workCityRef.current = workCity;

  // Первичная подписка
  useEffect(() => {
    if (!userId || !role) return;
    if (subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const subscribe = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const reg = await navigator.serviceWorker.ready;

        const keyRes = await fetch(`${BASE}/api/push/vapid-key`);
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        if (!publicKey) return;

        const existing = await reg.pushManager.getSubscription();
        const sub = existing || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });

        const subJson = sub.toJSON();
        endpointRef.current = sub.endpoint;
        subscribedRef.current = true;

        // Используем workCityRef.current — актуальное значение на момент завершения async операции,
        // а не то что было в момент запуска эффекта (фикс race condition: workCity мог загрузиться позже)
        await fetch(`${BASE}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeadersRef.current },
          body: JSON.stringify({
            userId,
            role,
            workCity: workCityRef.current || null,
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "",
                auth: subJson.keys?.auth || "",
              },
            },
          }),
        });
      } catch {
      }
    };

    subscribe();
  }, [userId, role]);

  // Обновляем workCity на сервере при изменении города
  // Срабатывает когда workCity изменяется ПОСЛЕ завершения подписки
  useEffect(() => {
    if (!subscribedRef.current || !endpointRef.current || !userId) return;
    fetch(`${BASE}/api/push/update-city`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeadersRef.current },
      body: JSON.stringify({ endpoint: endpointRef.current, workCity: workCity || null }),
    }).catch(() => {});
  }, [workCity, userId]);
}
