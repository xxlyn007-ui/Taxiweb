import { createContext, useContext, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { type User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: false;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStorage<T>(key: string, parse: true): T | null;
function readStorage(key: string, parse?: false): string | null;
function readStorage<T>(key: string, parse?: boolean): T | string | null {
  try {
    const val = localStorage.getItem(key);
    if (!val) return null;
    return parse ? JSON.parse(val) as T : val;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialisers — читаем localStorage синхронно при первом рендере,
  // без useEffect и без фазы isLoading:true → нет вспышки чёрного экрана.
  const [user, setUser] = useState<User | null>(() => readStorage<User>("taxi_user", true));
  const [token, setToken] = useState<string | null>(() => readStorage("taxi_token"));
  const [, setLocation] = useLocation();

  const login = (newToken: string, newUser: User) => {
    try {
      localStorage.setItem("taxi_token", newToken);
      localStorage.setItem("taxi_user", JSON.stringify(newUser));
    } catch {}
    setToken(newToken);
    setUser(newUser);
    if (newUser.role === "admin") setLocation("/admin");
    else if (newUser.role === "driver") setLocation("/driver");
    else setLocation("/passenger");
  };

  const logout = () => {
    try {
      localStorage.removeItem("taxi_token");
      localStorage.removeItem("taxi_user");
    } catch {}
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading: false, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}

export function useAuthHeaders(): { headers: Record<string, string> } {
  const { token } = useAuth();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { headers };
}
