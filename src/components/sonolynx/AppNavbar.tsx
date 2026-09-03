import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LayoutDashboard, LogOut, Settings, ShieldCheck, User as UserIcon, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { RegisterPatientDialog } from "./RegisterPatientDialog";

interface AppNavbarProps {
  onPatientRegistered?: () => void;
}

export function AppNavbar({ onPatientRegistered }: AppNavbarProps = {}) {
  const { profile, role, signOut } = useAuth();
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
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b bg-card px-3 py-2 sm:gap-4 sm:px-4">
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <Badge variant="secondary" className="hidden text-[10px] font-medium uppercase tracking-wider sm:inline-flex">
        HIPAA · Production
      </Badge>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {canRegisterPatient && (
          <Button size="sm" variant="outline" onClick={() => setRegisterOpen(true)} className="h-8 px-2 sm:px-3">
            <UserPlus className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Register Patient</span>
          </Button>
        )}
        <span className="hidden text-xs text-muted-foreground md:inline">
          {roleLabel}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar className="h-9 w-9 border-2 border-border transition-colors hover:border-primary">
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-semibold">{fullName}</div>
              <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
            </DropdownMenuLabel>
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
  );
}
