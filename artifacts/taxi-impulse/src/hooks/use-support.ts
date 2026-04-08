import { useGetSupportMessages, useSendSupportMessage } from "@workspace/api-client-react";
import { useAuthHeaders } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function useSupportMessages(userId: number | null) {
  const headers = useAuthHeaders();
  return useGetSupportMessages(
    userId ? { userId } : undefined,
    {
      request: headers,
      query: {
        enabled: !!userId,
        refetchInterval: 8000,
        refetchIntervalInBackground: false,
      } as any,
    }
  );
}

export function useSendSupportMessageMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useSendSupportMessage({
    request: headers,
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/support/messages'] });
      }
    }
  });
}
