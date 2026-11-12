import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {backend} from './backend';
import {permissionsFor} from './permissions';
import type {AppUser} from './types';

type Auth = {
  user: AppUser | null;
  isLoading: boolean;
  signIn: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    backend
      .getSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (password: string) => {
    setUser(await backend.signIn(password));
  }, []);

  const signOut = useCallback(async () => {
    await backend.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({user, isLoading, signIn, signOut}),
    [user, isLoading, signIn, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}

/** Текущий пользователь и его права; вызывается только внутри авторизованной части. */
export function useCurrentUser() {
  const {user} = useAuth();
  if (!user) throw new Error('useCurrentUser used while signed out');
  return {user, can: permissionsFor(user.role)};
}
