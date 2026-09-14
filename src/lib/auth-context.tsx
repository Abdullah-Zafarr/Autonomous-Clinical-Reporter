"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { resolveRole } from "@/lib/auth-role";
import { ClinicalDoodleProvider } from "@/lib/clinical-doodles";

const supabase = createClient();

export type AppRole = "admin" | "doctor" | "sonographer" | "radiologist";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOutExplicitly, setSignedOutExplicitly] = useState(false);
  const roleRequest = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const initialResolvedRef = useRef(false);

  const loadUserData = async (uid: string) => {
    const request = ++roleRequest.current;
    try {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (request !== roleRequest.current) return;
      const resolvedRole = resolveRole((prof as Profile | null)?.role, roles ?? []);
      setProfile(prof as Profile | null);
      setRole(resolvedRole);
      if (typeof window !== "undefined") {
        try {
          if (resolvedRole) {
            localStorage.setItem(`sonolynx_role_${uid}`, resolvedRole);
          } else {
            localStorage.removeItem(`sonolynx_role_${uid}`);
          }
          if (prof) {
            localStorage.setItem(`sonolynx_profile_${uid}`, JSON.stringify(prof));
          } else {
            localStorage.removeItem(`sonolynx_profile_${uid}`);
          }
        } catch {}
      }
    } catch {
      if (request !== roleRequest.current) return;
      setProfile(null);
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleAuthChange = async (event: string, sess: Session | null) => {
      if (!mounted) return;

      const newUser = sess?.user ?? null;
      setSession(sess);
      setUser(newUser);

      // 1. Logged out or no session
      if (!newUser) {
        currentUserIdRef.current = null;
        roleRequest.current += 1;
        setProfile(null);
        setRole(null);
        setLoading(false);
        initialResolvedRef.current = true;
        return;
      }

      // 2. Token refreshed in background (e.g. window focus, tab switch, periodic refresh)
      // Do not reset loading to true or refetch profile.
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      const isSameUser = currentUserIdRef.current === newUser.id;
      currentUserIdRef.current = newUser.id;

      // Restore cached role/profile immediately to avoid any flash of unassigned role
      if (typeof window !== "undefined") {
        try {
          const cachedRole = localStorage.getItem(`sonolynx_role_${newUser.id}`) as AppRole | null;
          const cachedProf = localStorage.getItem(`sonolynx_profile_${newUser.id}`);
          if (cachedRole) {
            setRole(cachedRole);
          }
          if (cachedProf) {
            setProfile(JSON.parse(cachedProf));
          }
        } catch {}
      }

      // 3. Same user is already authenticated & resolved
      // Tab switches and window focus events often emit SIGNED_IN or storage sync for the same user.
      if (isSameUser && initialResolvedRef.current) {
        return;
      }

      // 4. Initial session resolution or new user signed in
      setSignedOutExplicitly(false);
      try {
        await loadUserData(newUser.id);
      } finally {
        if (mounted) {
          setLoading(false);
          initialResolvedRef.current = true;
        }
      }
    };

    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      void handleAuthChange(event, sess);
    });

    // 2. Check current session if onAuthStateChange hasn't already resolved it
    supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        if (!initialResolvedRef.current) {
          void handleAuthChange("INITIAL_SESSION", sess);
        }
      })
      .catch(() => {
        if (!initialResolvedRef.current) {
          void handleAuthChange("SIGNED_OUT", null);
        }
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isTransientNetworkError = (err: unknown): boolean => {
    if (!err) return false;
    const msg = (
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err)
    ).toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed") ||
      msg.includes("network request failed") ||
      msg.includes("timeout") ||
      msg.includes("authretryablefetcherror") ||
      msg.includes("econnrefused")
    );
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setSignedOutExplicitly(false);
    if (typeof window !== "undefined") {
      try {
        (window as any).__radix_is_logging_out = false;
        sessionStorage.removeItem("radix_signed_out");
        localStorage.removeItem("radix_signed_out");
      } catch {}
    }
    setLoading(true);

    const maxAttempts = 3;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error) {
          // Success! Keep loading true until auth listener resolves role and routes to dashboard
          return { error: null };
        }

        lastError = error.message;

        // If credentials are wrong or user blocked, do NOT retry; return immediately
        if (!isTransientNetworkError(error)) {
          setLoading(false);
          return { error: error.message };
        }

        console.warn(`[auth] Transient connection issue on attempt ${attempt}/${maxAttempts}: ${error.message}. Retrying silently...`);
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Network error";
        if (!isTransientNetworkError(err)) {
          setLoading(false);
          return { error: lastError };
        }
        console.warn(`[auth] Network exception on attempt ${attempt}/${maxAttempts}: ${lastError}. Retrying silently...`);
      }

      // Short delay before transparent retry (350ms, then 750ms)
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 350 : 750));
      }
    }

    setLoading(false);
    if (lastError && isTransientNetworkError(lastError)) {
      return {
        error: "Unable to reach the clinical authentication server. Please check your network connection and try again.",
      };
    }
    return { error: lastError || "Unable to sign in. Please try again." };
  };

  const signOut = async () => {
    roleRequest.current += 1;
    const uid = currentUserIdRef.current;
    currentUserIdRef.current = null;
    setSignedOutExplicitly(true);
    if (typeof window !== "undefined") {
      try {
        (window as any).__radix_is_logging_out = true;
        sessionStorage.setItem("radix_signed_out", "true");
        localStorage.setItem("radix_signed_out", "true");
        window.dispatchEvent(new CustomEvent("radix:logout"));
        if (uid) {
          localStorage.removeItem(`sonolynx_role_${uid}`);
          localStorage.removeItem(`sonolynx_profile_${uid}`);
          localStorage.removeItem(`radix_role_${uid}`);
          localStorage.removeItem(`radix_profile_${uid}`);
        }
      } catch {}
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Sign out notice:", e);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setLoading(false);
  };

  // Dev-only convenience: allow bypassing Supabase auth ONLY when explicitly enabled and not signed out.
  // Never active on the login page or after explicit sign out. Default is off.
  const isLoginPage = typeof window !== "undefined" && window.location.pathname === "/login";
  const isExplicitlySignedOut =
    signedOutExplicitly ||
    (typeof window !== "undefined" &&
      (sessionStorage.getItem("radix_signed_out") === "true" ||
        localStorage.getItem("radix_signed_out") === "true"));

  const devBypassEnabled =
    !isExplicitlySignedOut &&
    !isLoginPage &&
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

  const [devRoleOverride, setDevRoleOverride] = useState<AppRole | null>(null);

  useEffect(() => {
    if (!devBypassEnabled || typeof window === "undefined") return;
    const syncRole = () => {
      const urlRole = new URLSearchParams(window.location.search).get("role") as AppRole | null;
      if (urlRole && ["admin", "doctor", "sonographer", "radiologist"].includes(urlRole)) {
        setDevRoleOverride(urlRole);
      } else {
        setDevRoleOverride(null);
      }
    };
    syncRole();
    window.addEventListener("popstate", syncRole);
    return () => window.removeEventListener("popstate", syncRole);
  }, [devBypassEnabled]);

  const effectiveUser = devBypassEnabled ? (user || ({ id: "dev-user", email: "dev@radix.local" } as User)) : user;
  const effectiveRole = devRoleOverride || (devBypassEnabled ? ((role || "admin") as AppRole) : role);
  const effectiveProfile = devBypassEnabled
    ? (profile ||
        ({
          id: "dev-user",
          email: "dev@radix.local",
          first_name: devRoleOverride === "sonographer" ? "Sonographer" : devRoleOverride === "doctor" ? "Doctor" : "Admin",
          last_name: "Staff",
          role: effectiveRole,
        } as Profile))
    : profile;
  const effectiveLoading = devBypassEnabled ? false : loading;

  return (
    <AuthContext.Provider value={{ 
      user: effectiveUser, 
      session, 
      profile: effectiveProfile, 
      role: effectiveRole, 
      loading: effectiveLoading, 
      signIn, 
      signOut 
    }}>
      <ClinicalDoodleProvider userId={effectiveUser?.id} role={effectiveRole}>
        {children}
      </ClinicalDoodleProvider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
