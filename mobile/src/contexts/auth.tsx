import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { configureSession, identity, ApiError } from "@/lib/api";
import { storage } from "@/lib/storage";
import type { User } from "@/lib/types";
interface Tokens {
  accessToken: string;
  refreshToken?: string;
}
interface Auth {
  user: User | null;
  ready: boolean;
  sessionError: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const clear = useCallback(() => {
    configureSession(null);
    setUser(null);
    void storage.remove("eventpass.tokens").catch(() => {});
  }, []);
  const install = useCallback(
    (tokens: Tokens) => configureSession(tokens.accessToken, clear),
    [clear],
  );
  const reload = useCallback(async () => {
    setUser(await identity<User>("/me"));
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await storage.get("eventpass.tokens");
        if (!saved || !active) return;
        let tokens: Tokens = JSON.parse(saved);
        let profile: User;
        try {
          profile = await identity<User>("/me", { token: tokens.accessToken });
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.status !== 401 ||
            !tokens.refreshToken
          )
            throw error;
          tokens = await identity<Tokens>("/refresh", {
            method: "POST",
            public: true,
            body: { refreshToken: tokens.refreshToken },
          });
          await storage.set("eventpass.tokens", JSON.stringify(tokens));
          profile = await identity<User>("/me", { token: tokens.accessToken });
        }
        if (active) {
          install(tokens);
          setUser(profile);
        }
      } catch (error) {
        if (active) {
          if (error instanceof ApiError && error.status === 401) clear();
          setSessionError(
            "Không khôi phục được phiên. Vui lòng đăng nhập lại.",
          );
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [clear, install]);
  async function login(email: string, password: string) {
    const tokens = await identity<Tokens>("/login", {
      method: "POST",
      public: true,
      body: { email, password },
    });
    if (!tokens.accessToken)
      throw new Error("Máy chủ chưa trả về access token hợp lệ.");
    const profile = await identity<User>("/me", { token: tokens.accessToken });
    if (!profile.email || !Array.isArray(profile.roles))
      throw new Error("Không tải được thông tin và quyền tài khoản.");
    await storage.set("eventpass.tokens", JSON.stringify(tokens));
    install(tokens);
    setUser(profile);
    setSessionError("");
  }
  async function logout() {
    try {
      const saved = await storage.get("eventpass.tokens");
      const tokens: Tokens | null = saved ? JSON.parse(saved) : null;
      await identity("/logout", {
        method: "POST",
        body: { refreshToken: tokens?.refreshToken || "" },
      });
    } finally {
      clear();
    }
  }
  return (
    <Context value={{ user, ready, sessionError, login, logout, reload }}>
      {children}
    </Context>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
