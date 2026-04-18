import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthHeaders } from "./use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function useDriverSubscriptionQuery(driverId?: number) {
  const { headers } = useAuthHeaders();
  return useQuery({
    queryKey: ["subscription", driverId],
    queryFn: async () => {
      if (!driverId) return null;
      const res = await fetch(`${BASE}/api/subscriptions/driver/${driverId}`, { headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!driverId,
    refetchInterval: 60000,
  });
}

export function useAllSubscriptionsQuery() {
  const { headers } = useAuthHeaders();
  return useQuery({
    queryKey: ["subscriptions-all"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/subscriptions`, { headers });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useCreatePaymentMutation() {
  const { headers } = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ driverId, returnUrl }: { driverId: number; returnUrl: string }) => {
      const res = await fetch(`${BASE}/api/subscriptions/pay/${driverId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ returnUrl }),
      });
      if (!res.ok) throw new Error("Payment error");
      return res.json() as Promise<{ confirmationUrl?: string; amount: number; yookassaConfigured: boolean }>;
    },
    onSuccess: (_, { driverId }) => {
      qc.invalidateQueries({ queryKey: ["subscription", driverId] });
    },
  });
}

export function useConfirmPaymentMutation() {
  const { headers } = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (driverId: number) => {
      const res = await fetch(`${BASE}/api/subscriptions/confirm/${driverId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Ошибка подтверждения платежа");
      return data;
    },
    onSuccess: (_, driverId) => {
      qc.invalidateQueries({ queryKey: ["subscription", driverId] });
    },
  });
}

export function useSettingsQuery() {
  const { headers } = useAuthHeaders();
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/settings`, { headers });
      if (!res.ok) return {};
      return res.json() as Promise<Record<string, string>>;
    },
  });
}

export function useUpdateSettingMutation() {
  const { headers } = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await fetch(`${BASE}/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Settings update failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
