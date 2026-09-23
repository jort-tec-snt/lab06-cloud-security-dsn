import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, clearToken, getToken, setToken } from "../lib/api";
import type { Permission, User } from "../types";

type AuthState = {
  user: User | null;
  permissions: Permission[];
  loading: boolean;
  login: (correo: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const reset = useCallback(() => {
    clearToken();
    setUser(null);
    setPermissions([]);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) { reset(); setLoading(false); return; }
    try {
      const [me, access] = await Promise.all([
        apiRequest<{ user: User }>("/auth/me"),
        apiRequest<{ rol: string; permisos: Permission[] }>("/auth/permissions")
      ]);
      setUser(me.user);
      setPermissions(access.permisos);
    } catch { reset(); }
    finally { setLoading(false); }
  }, [reset]);

  useEffect(() => {
    void refresh();
    const unauthorized = () => reset();
    window.addEventListener("securedocs:unauthorized", unauthorized);
    return () => window.removeEventListener("securedocs:unauthorized", unauthorized);
  }, [refresh, reset]);

  const login = useCallback(async (correo: string, password: string) => {
    const result = await apiRequest<{ accessToken: string; user: User }>("/auth/login", {
      method: "POST", auth: false, body: { correo, password }
    });
    setToken(result.accessToken);
    const access = await apiRequest<{ permisos: Permission[] }>("/auth/permissions");
    setUser(result.user);
    setPermissions(access.permisos);
  }, []);

  const logout = useCallback(async () => {
    try { await apiRequest<void>("/auth/logout", { method: "POST" }); }
    finally { reset(); }
  }, [reset]);

  const value = useMemo(() => ({ user, permissions, loading, login, logout, refresh }), [user, permissions, loading, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
