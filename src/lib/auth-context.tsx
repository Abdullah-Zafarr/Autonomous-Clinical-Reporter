"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-client";

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

  const loadUserData = async (uid: string) => {
    try {
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      setProfile(prof as Profile | null);
      const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role));
      if (roleSet.has("admin")) setRole("admin");
      else if (roleSet.has("radiologist")) setRole("radiologist");
      else if (roleSet.has("sonographer")) setRole("sonographer");
      else if ((prof as Profile | null)?.role === "radiologist") setRole("radiologist");
      else if ((prof as Profile | null)?.role === "sonographer") setRole("sonographer");
      else setRole("doctor");
    } catch {
      setProfile(null);
      setRole("doctor");
    }
  };

  useEffect(() => {
    // 1. Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setSignedOutExplicitly(false);
        // defer to avoid deadlock
        setTimeout(() => {
          loadUserData(sess.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    // 2. Then check current session
    supabase.auth
      .getSession()
      .then(({ data: { session: sess } }) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          setSignedOutExplicitly(false);
          loadUserData(sess.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setSignedOutExplicitly(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
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
