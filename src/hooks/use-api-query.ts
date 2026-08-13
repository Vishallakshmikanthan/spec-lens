/**
 * Typed React Query wrapper for SpecLens service methods.
 *
 * const { data, isLoading } = useApiQuery(["datasheet", id], () => api.getDatasheet(id));
 *
 * Gives every page cancel-on-unmount, retry, caching and stale-while-revalidate
 * for free, with the query key fully in the caller's control.
 */
import { useQuery, type QueryKey, type UseQueryOptions } from "@tanstack/react-query";

export function useApiQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">,
) {
  return useQuery<T, Error, T, QueryKey>({
    queryKey,
    queryFn,
    ...options,
  });
}
