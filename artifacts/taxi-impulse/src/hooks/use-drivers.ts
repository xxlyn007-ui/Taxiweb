import { 
  useGetDrivers, 
  useCreateDriver, 
  useUpdateDriver,
  useUpdateDriverStatus,
  useBlockDriver,
  useApproveDriver,
  type GetDriversParams
} from "@workspace/api-client-react";
import { useAuthHeaders } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function useDriversQuery(params?: GetDriversParams) {
  const headers = useAuthHeaders();
  return useGetDrivers(params, { request: headers });
}

export function useUpdateDriverStatusMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useUpdateDriverStatus({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/drivers'] }),
    }
  });
}

export function useUpdateDriverMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useUpdateDriver({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/drivers'] }),
    }
  });
}

export function useBlockDriverMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useBlockDriver({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/drivers'] }),
    }
  });
}

export function useApproveDriverMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useApproveDriver({
    request: headers,
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/drivers'] }),
    }
  });
}
