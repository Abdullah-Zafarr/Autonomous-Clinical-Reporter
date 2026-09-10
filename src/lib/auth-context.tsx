"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";
import { resolveRole } from "@/lib/auth-role";

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
      setProfile(prof as Profile | null);
      setRole(resolveRole((prof as Profile | null)?.role, roles ?? []));
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

  const signIn = async (email: string, password: string) => {
    setSignedOutExplicitly(false);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setLoading(false);
      // Successful login stays loading until the auth listener resolves the role.
      return { error: error?.message ?? null };
    } catch (error) {
      setLoading(false);
      return { error: error instanceof Error ? error.message : "Unable to sign in. Please try again." };
    }
  };

  const signOut = async () => {
    roleRequest.current += 1;
    currentUserIdRef.current = null;
    setSignedOutExplicitly(true);
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
  // Default is off so local testing reflects real RLS behavior.
  const devBypassEnabled =
    !signedOutExplicitly &&
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

  const effectiveUser = devBypassEnabled ? (user || ({ id: "dev-user", email: "dev@sonolynx.com" } as User)) : user;
  const effectiveRole = devBypassEnabled ? ((role || "admin") as AppRole) : role;
  const effectiveProfile = devBypassEnabled
    ? (profile ||
        ({
          id: "dev-user",
          email: "dev@sonolynx.com",
          first_name: "Dev",
          last_name: "User",
          role: "admin",
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
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
