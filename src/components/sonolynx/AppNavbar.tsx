"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, LogOut, Palette, Settings, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useClinicalDoodle } from "@/lib/clinical-doodles";
import { ClinicalDoodlePickerModal } from "./ClinicalDoodlePickerModal";
import { ClinicalSettingsDialog } from "./ClinicalSettingsDialog";
import { Logo } from "./Logo";
import { toast } from "sonner";
import { RegisterPatientDialog } from "./RegisterPatientDialog";

interface AppNavbarProps {
  onPatientRegistered?: () => void;
}

export function AppNavbar({ onPatientRegistered }: AppNavbarProps = {}) {
  const { profile, role, signOut } = useAuth();
  const { activeDoodleId, activeDoodle } = useClinicalDoodle();
  const [doodlePickerOpen, setDoodlePickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const [registerOpen, setRegisterOpen] = useState(false);

  const initials =
    `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`.toUpperCase() ||
    profile?.email?.[0]?.toUpperCase() ||
    "U";

  const fullName =
    profile?.first_name || profile?.last_name
      ? `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim()
      : profile?.email ?? "User";

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        (window as any).__radix_is_logging_out = true;
        sessionStorage.setItem("radix_signed_out", "true");
        localStorage.setItem("radix_signed_out", "true");
        window.dispatchEvent(new CustomEvent("radix:logout"));
      }
      await signOut();
      toast.success("Signed out");
    } finally {
      window.location.href = "/login";
    }
  };

  const canRegisterPatient = role === "sonographer";
  const roleLabel =
    role === "admin"
      ? "Administrator"
      : role === "doctor"
        ? "Doctor"
        : role === "radiologist"
          ? "Radiologist"
          : "Sonographer";

  return (
    <>
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-card px-3 py-2 sm:gap-4 sm:px-4">
        <Link href="/">
          <Logo size="sm" />
        </Link>
        <Badge variant="secondary" className="hidden text-[10px] font-medium uppercase tracking-wider sm:inline-flex">
          {process.env.NODE_ENV === "development" ? "Development workspace" : "Clinical workspace"}
        </Badge>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {canRegisterPatient && (
            <Button aria-label="Register Patient" size="sm" variant="outline" onClick={() => setRegisterOpen(true)} className="h-8 px-2 sm:px-3">
              <UserPlus className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Register Patient</span>
            </Button>
          )}

          {/* Role badge with clickable settings shortcut */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="group hidden items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 py-1 pl-2.5 pr-2 text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all md:inline-flex"
            title="Click to open Settings and customize your clinical avatar & workspace"
          >
            <span className="font-medium" suppressHydrationWarning>{roleLabel}</span>
            <Settings className="h-3 w-3 text-muted-foreground/70 group-hover:text-primary transition-colors" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              className="group rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="h-9 w-9 border-2 border-border transition-colors group-hover:border-primary bg-background">
                {activeDoodleId ? (
                  <div className="h-full w-full p-1 flex items-center justify-center">
                    {activeDoodle.render({ className: "h-full w-full" })}
                  </div>
                ) : (
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full border bg-muted/30 p-0.5 shrink-0 flex items-center justify-center">
                    {activeDoodleId ? (
                      activeDoodle.render({ className: "h-full w-full" })
                    ) : (
                      <span className="text-[11px] font-bold text-primary">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{fullName}</div>
                    <div className="text-xs font-normal text-muted-foreground truncate">{profile?.email}</div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Settings menu item (Avatar Doodles & Workspace Preferences) */}
              <DropdownMenuItem onClick={() => setSettingsOpen(true)} className="gap-2.5 py-2 cursor-pointer">
                <Settings className="h-4 w-4 text-primary shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="font-medium text-xs">Settings</span>
                  <span className="text-[10px] text-muted-foreground">
                    Avatar doodles, reporting & safety
                  </span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                router.push("/");
                toast.info("Clinical Workspace Active", { duration: 3000 });
              }}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Clinical Workspace
              </DropdownMenuItem>
              {role === "admin" && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Admin Dashboard
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {canRegisterPatient && (
          <RegisterPatientDialog
            open={registerOpen}
            onOpenChange={setRegisterOpen}
            onRegistered={() => onPatientRegistered?.()}
          />
        )}
      </header>

      {/* Clinical Settings Dialog */}
      <ClinicalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        staffName={fullName}
        staffEmail={profile?.email || "doctor@gmail.com"}
        staffRole={roleLabel}
      />
    </>
  );
}
