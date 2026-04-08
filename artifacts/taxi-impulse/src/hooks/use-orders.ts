import { 
  useGetOrders, 
  useCreateOrder, 
  useUpdateOrder,
  useEstimatePrice,
  useGetOrderById,
  useRateOrder,
  type GetOrdersParams 
} from "@workspace/api-client-react";
import { useAuthHeaders } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function useOrdersQuery(params?: GetOrdersParams, refetchInterval?: number) {
  const headers = useAuthHeaders();
  return useGetOrders(params, {
    request: headers,
    query: refetchInterval
      ? { refetchInterval, refetchIntervalInBackground: false } as any
      : undefined,
  });
}

export function useOrderByIdQuery(id: number) {
  const headers = useAuthHeaders();
  return useGetOrderById(id, { request: headers, query: { enabled: !!id } as any });
}

export function useCreateOrderMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  
  return useCreateOrder({
    request: headers,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      }
    }
  });
}

export function useUpdateOrderMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  
  return useUpdateOrder({
    request: headers,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      }
    }
  });
}

export function useEstimatePriceMutation() {
  const headers = useAuthHeaders();
  return useEstimatePrice({ request: headers });
}

export function useRateOrderMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useRateOrder({
    request: headers,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      }
    }
  });
}
