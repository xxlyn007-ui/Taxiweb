import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthHeaders } from "./use-auth";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function useAllUsersQuery() {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users`, { headers: authHeaders.headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data as any[];
    },
  });
}

export function useUserSearchQuery(phone: string) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ["/api/users/search", phone],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/users/search?phone=${encodeURIComponent(phone)}`, {
        headers: authHeaders.headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data as any[];
    },
    enabled: !!phone && phone.length >= 3,
  });
}

export function useBlockUserMutation() {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isBlocked }: { id: number; isBlocked: boolean }) => {
      const res = await fetch(`${BASE}/api/users/${id}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify({ isBlocked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/users/search"] });
    },
  });
}

export function useDeleteUserMutation() {
  const authHeaders = useAuthHeaders();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: authHeaders.headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      qc.invalidateQueries({ queryKey: ["/api/users/search"] });
    },
  });
}

export function useChangePhoneMutation() {
  const authHeaders = useAuthHeaders();
  return useMutation({
    mutationFn: async ({ id, phone }: { id: number; phone: string }) => {
      const res = await fetch(`${BASE}/api/users/${id}/phone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders.headers },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data;
    },
  });
}

export function useDeleteSelfMutation() {
  const authHeaders = useAuthHeaders();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: authHeaders.headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка");
      return data;
    },
  });
}
