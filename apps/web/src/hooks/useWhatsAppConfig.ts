import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { whatsAppConfigRepository } from '../data/repositories';

/** Estado de la conexión con Twilio (specs/004-whatsapp-automation/, Historia 2). */
export function useWhatsAppConfigStatus() {
  return useQuery({
    queryKey: ['whatsAppConfigStatus'],
    queryFn: () => whatsAppConfigRepository.getStatus(),
  });
}

export function useSaveWhatsAppCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { accountSid: string; authToken: string; fromNumber: string }) =>
      whatsAppConfigRepository.saveCredentials(params.accountSid, params.authToken, params.fromNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsAppConfigStatus'] }),
  });
}

export function useClearWhatsAppCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => whatsAppConfigRepository.clearCredentials(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsAppConfigStatus'] }),
  });
}
