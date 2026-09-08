import { useQuery } from '@tanstack/react-query';
import { appSettingsRepository } from '../data/repositories';

/** Configuración global de la instalación — solo lectura desde mobile
 * (specs/006-rebrand-currency-polish/, US1): la moneda se configura únicamente desde
 * apps/web. `refetchOnMount: 'always'` para recoger un cambio hecho desde la web sin
 * depender de tiempo real entre dispositivos (spec.md, Edge Cases). */
export function useAppSettings() {
  const query = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => appSettingsRepository.getSettings(),
    refetchOnMount: 'always',
  });

  return { currency: query.data?.currency ?? 'COP' } as const;
}
