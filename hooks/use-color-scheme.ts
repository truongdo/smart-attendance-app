// Light-only for now (requested). Keep the API surface stable for callers.
export function useColorScheme() {
  return 'light' as const;
}
