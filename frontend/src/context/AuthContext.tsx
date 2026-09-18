import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAuthToken, ApiError } from "../lib/api";
import type { User } from "../types";

const TOKEN_STORAGE_KEY = "fairshare_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  // True while we're checking a stored token against GET /api/auth/me on
  // first load. Routing decisions must wait for this to settle, otherwise
  // a refresh briefly bounces a logged-in user to /login.
  isLoading: boolean;
  signup: (name: string, username: string, password: string) => Promise<User>;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  // Called after household create/join so the rest of the app immediately
  // sees the new householdId without waiting for a refetch. Also called
  // with `null` after POST /api/households/leave, so a member who leaves
  // is routed back into the household setup flow immediately.
  setHouseholdId: (householdId: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore a session from a previously stored token.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setAuthToken(stored);
    api
      .get<{ user: User }>("/api/auth/me")
      .then((data) => {
        setToken(stored);
        setUser(data.user);
      })
      .catch(() => {
        // Stored token is invalid or expired — clear it silently and fall
        // back to the logged-out state rather than surfacing an error.
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setAuthToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function persistSession(newToken: string, newUser: User) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }

  async function signup(name: string, username: string, password: string) {
    const data = await api.post<{ token: string; user: User }>("/api/auth/signup", {
      name,
      username,
      password,
    });
    persistSession(data.token, data.user);
    return data.user;
  }

  async function login(username: string, password: string) {
    const data = await api.post<{ token: string; user: User }>("/api/auth/login", {
      username,
      password,
    });
    persistSession(data.token, data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  function setHouseholdId(householdId: string | null) {
    setUser((prev) => (prev ? { ...prev, householdId } : prev));
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, signup, login, logout, setHouseholdId }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
