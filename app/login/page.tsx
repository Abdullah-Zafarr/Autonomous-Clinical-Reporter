"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/sonolynx/Logo";
import { useAuth } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      toast.error("Sign-in failed", { description: error });
      return;
    }
    toast.success("Welcome back");
    router.push("/");
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[400px]"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-4 text-sm font-medium text-slate-500">
            HIPAA-compliant Radiology Workflow Platform
          </p>
        </div>

        <Card className="border-slate-200 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Sign in to your workspace</h1>
            <p className="text-sm text-slate-500">
              Enter your clinician credentials to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hospital.org"
                className="h-11 border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>

            <Button 
              type="submit" 
              className="h-11 w-full bg-[#1e6cd9] font-semibold text-white hover:bg-[#1a5ebc] transition-colors" 
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Sign in
            </Button>
          </form>

          <div className="mt-8 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed text-slate-600">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1e6cd9]" />
            <p>
              Access is invite-only. Contact your administrator to request an account.
            </p>
          </div>
        </Card>

        <p className="mt-8 text-center text-[11px] font-medium text-slate-400">
          © {new Date().getFullYear()} Sonolynx Radiology · Protected health information
        </p>
      </motion.div>
      
      <Toaster richColors position="top-right" />
    </div>
  );
}
