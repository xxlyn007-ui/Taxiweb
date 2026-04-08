import { useGetChatMessages, useSendChatMessage } from "@workspace/api-client-react";
import { useAuthHeaders } from "./use-auth";
import { useQueryClient } from "@tanstack/react-query";

export function useChatMessages(orderId: number | null) {
  const headers = useAuthHeaders();
  return useGetChatMessages(
    orderId ?? 0,
    {
      request: headers,
      query: {
        enabled: !!orderId,
        refetchInterval: 5000,
        refetchIntervalInBackground: false,
      } as any,
    }
  );
}

export function useSendMessageMutation() {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  return useSendChatMessage({
    request: headers,
    mutation: {
      onSuccess: (_data: unknown, variables: { orderId: number }) => {
        queryClient.invalidateQueries({ queryKey: [`/api/chat/${variables.orderId}/messages`] });
      }
    }
  });
}
