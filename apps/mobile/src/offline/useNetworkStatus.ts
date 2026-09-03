import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Estado de red en vivo (research.md §4) — usado para avisar de FR-013 ANTES de intentar
 * emitir un préstamo o confirmar un cobro, no solo al fallar la petición.
 */
export function useNetworkStatus(): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return unsubscribe;
  }, []);

  return { isConnected };
}
