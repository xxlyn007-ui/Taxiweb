import { 
  useGetStats,
  useGetStatsByCity,
  useGetUsers,
  useGetTariffs,
  useCreateTariff,
  useUpdateTariff,
  useDeleteTariff,
  useGetCities,
  useCreateTariffOption,
  useUpdateTariffOption,
  useDeleteTariffOption,
} from "@workspace/api-client-react";
import { useAuthHeaders } from "./use-auth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export function useStatsQuery() {
  const headers = useAuthHeaders();
  return useGetStats({ request: headers });
}

export function useStatsByCityQuery() {
  const headers = useAuthHeaders();
  return useGetStatsByCity({ request: headers });
}

export function useUsersQuery() {
  const headers = useAuthHeaders();
  return useGetUsers({ request: headers });
}

export function useTariffsQuery() {
  const headers = useAuthHeaders();
  return useGetTariffs({ request: headers });
}

export function useCitiesQuery() {
  const headers = useAuthHeaders();
  return useGetCities({ request: headers });
}

export function useAllCitiesQuery() {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ['/api/cities/all'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/cities/all`, { headers: authHeaders.headers });
      return res.json() as Promise<any[]>;
    },
  });
}

export function useCreateCityMutation() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; region?: string }) => {
      const res = await fetch(`${BASE}/api/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.headers },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Ошибка создания города');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/all'] });
    },
  });
}

export function useUpdateCityMutation() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name?: string; region?: string; isActive?: boolean }) => {
      const res = await fetch(`${BASE}/api/cities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders.headers },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Ошибка обновления города');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/all'] });
    },
  });
}

export function useDeleteCityMutation() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/cities/${id}`, {
        method: 'DELETE',
        headers: authHeaders.headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Ошибка удаления города');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cities'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cities/all'] });
    },
  });
}

export function useTariffOptionsQuery(city?: string) {
  const authHeaders = useAuthHeaders();
  const params = city ? `?city=${encodeURIComponent(city)}` : '';
  return useQuery({
    queryKey: ['/api/tariff-options', city],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/tariff-options${params}`, { headers: authHeaders.headers });
      return res.json() as Promise<any[]>;
    },
  });
}

export function useCityTariffOverridesQuery(tariffId?: number) {
  const authHeaders = useAuthHeaders();
  return useQuery({
    queryKey: ['/api/city-tariff-overrides', tariffId],
    queryFn: async () => {
      const url = tariffId ? `${BASE}/api/city-tariff-overrides?tariffId=${tariffId}` : `${BASE}/api/city-tariff-overrides`;
      const res = await fetch(url, { headers: authHeaders.headers });
      return res.json() as Promise<any[]>;
    },
    enabled: tariffId !== undefined,
  });
}

export function useSaveCityTariffOverrideMutation() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { city: string; tariffId: number; basePrice?: number; pricePerKm?: number; minPrice?: number }) => {
      const res = await fetch(`${BASE}/api/city-tariff-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders.headers },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (_: any, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/city-tariff-overrides', vars.tariffId] });
    },
  });
}

export function useDeleteCityTariffOverrideMutation() {
  const authHeaders = useAuthHeaders();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tariffId }: { id: number; tariffId: number }) => {
      await fetch(`${BASE}/api/city-tariff-overrides/${id}`, { method: 'DELETE', headers: authHeaders.headers });
      return { id, tariffId };
    },
    onSuccess: (_: any, vars: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/city-tariff-overrides', vars.tariffId] });
    },
  });
}

export function useCreateTariffMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useCreateTariff({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariffs'] })
    }
  });
}

export function useUpdateTariffMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useUpdateTariff({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariffs'] })
    }
  });
}

export function useDeleteTariffMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useDeleteTariff({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariffs'] })
    }
  });
}

export function useCreateTariffOptionMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useCreateTariffOption({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariff-options'] })
    }
  });
}

export function useUpdateTariffOptionMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useUpdateTariffOption({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariff-options'] })
    }
  });
}

export function useDeleteTariffOptionMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useDeleteTariffOption({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/tariff-options'] })
    }
  });
}
