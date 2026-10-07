'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { queryKeys } from './query-keys';
import type { LoginRequest, User } from './types';

export const authApi = {
  login: (body: LoginRequest) => apiRequest<User>('/auth/login', { method: 'POST', body }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<User>('/auth/me'),
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.me, user);
    },
  });
}

/** Callers navigate away with a full page load afterwards, which drops all cached data. */
export function useLogout() {
  return useMutation({ mutationFn: authApi.logout });
}
