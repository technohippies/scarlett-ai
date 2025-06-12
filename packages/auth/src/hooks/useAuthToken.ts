import { createSignal, createEffect } from 'solid-js';
import { useAuth } from '../context';

export function useAuthToken() {
  const auth = useAuth();
  const [token, setToken] = createSignal(auth.token);

  createEffect(() => {
    setToken(auth.token);
  });

  return {
    token: token(),
    getAuthHeader: () => token() ? `Bearer ${token()}` : undefined,
    isAuthenticated: () => !!token(),
  };
}