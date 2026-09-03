/** Claves de caché de TanStack Query compartidas entre hooks — invalidadas juntas tras un
 * cobro o una emisión (FR-009: reflejar el cambio de inmediato en todas las pantallas). */
export const queryKeys = {
  collectionRoute: ['collectionRoute'] as const,
  clientDirectory: (filter?: unknown) => ['clientDirectory', filter] as const,
  clientProfile: (clientId: string) => ['clientProfile', clientId] as const,
  loan: (loanId: string) => ['loan', loanId] as const,
};
