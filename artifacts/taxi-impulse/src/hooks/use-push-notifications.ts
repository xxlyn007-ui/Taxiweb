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
        if (existing) await existing.unsubscribe();

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
        });

        const subJson = sub.toJSON();
        await fetch(`${BASE}/api/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders.headers },
          body: JSON.stringify({
            userId,
            role,
            workCity: workCity || null,
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || "",
                auth: subJson.keys?.auth || "",
              },
            },
          }),
        });
        subscribedRef.current = true;
      } catch {
      }
    };

    subscribe();
  }, [userId, role, workCity]);
}
