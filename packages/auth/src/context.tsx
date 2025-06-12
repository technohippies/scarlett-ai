import { createContext, useContext, ParentComponent } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { User, AuthProvider as AuthProviderType } from '@scarlett/core';
import type { BaseAuthProvider } from './providers';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  provider: AuthProviderType | null;
}

interface AuthContextValue extends AuthState {
  login: (provider: AuthProviderType) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

const AuthContext = createContext<AuthContextValue>();

export interface AuthProviderProps {
  providers: Record<AuthProviderType, BaseAuthProvider>;
  storage?: Storage;
  storageKey?: string;
}

export const AuthProvider: ParentComponent<AuthProviderProps> = (props) => {
  const storage = props.storage || (typeof window !== 'undefined' ? window.localStorage : null);
  const storageKey = props.storageKey || 'scarlett_auth';

  // Initialize state from storage
  const storedAuth = storage?.getItem(storageKey);
  const initialState: AuthState = storedAuth ? JSON.parse(storedAuth) : {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    provider: null,
  };

  const [state, setState] = createStore<AuthState>(initialState);

  // Save to storage on state change
  const updateState = (updates: Partial<AuthState>) => {
    setState(updates);
    if (storage) {
      storage.setItem(storageKey, JSON.stringify({ ...state, ...updates }));
    }
  };

  const login = async (providerType: AuthProviderType) => {
    const provider = props.providers[providerType];
    if (!provider) {
      throw new Error(`Provider ${providerType} not configured`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`Provider ${providerType} is not available`);
    }

    updateState({ isLoading: true });

    try {
      const { token, user } = await provider.login();
      updateState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        provider: providerType,
      });
    } catch (error) {
      updateState({ isLoading: false });
      throw error;
    }
  };

  const logout = async () => {
    if (state.provider) {
      const provider = props.providers[state.provider];
      await provider?.logout();
    }

    updateState({
      user: null,
      token: null,
      isAuthenticated: false,
      provider: null,
    });

    if (storage) {
      storage.removeItem(storageKey);
    }
  };

  const setLoading = (loading: boolean) => {
    updateState({ isLoading: loading });
  };

  const value: AuthContextValue = {
    get user() { return state.user; },
    get token() { return state.token; },
    get isAuthenticated() { return state.isAuthenticated; },
    get isLoading() { return state.isLoading; },
    get provider() { return state.provider; },
    login,
    logout,
    setLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};