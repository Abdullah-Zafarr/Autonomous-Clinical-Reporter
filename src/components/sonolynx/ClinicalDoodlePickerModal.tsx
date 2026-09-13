"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CLINICAL_DOODLES,
  ClinicalDoodle,
  getDoodleById,
  useClinicalDoodle,
} from "@/lib/clinical-doodles";
import { Check, Sparkles, User, Stethoscope, Activity, ShieldCheck, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClinicalDoodlePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName?: string;
  staffRole?: string;
}

export function ClinicalDoodlePickerModal({
  open,
  onOpenChange,
  staffName = "Clinician",
  staffRole = "doctor",
}: ClinicalDoodlePickerModalProps) {
  const { activeDoodleId, setDoodleId } = useClinicalDoodle();

  // Tab category filter
  const initialTab =
    staffRole.toLowerCase().includes("sono")
      ? "sonographer"
      : staffRole.toLowerCase().includes("admin")
      ? "admin"
      : "doctor";

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedId, setSelectedId] = useState<string>(activeDoodleId);

  // Sync when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedId(activeDoodleId);
    }
  }, [open, activeDoodleId]);

  const selectedDoodle = getDoodleById(selectedId) || CLINICAL_DOODLES[0];

  const filteredDoodles = CLINICAL_DOODLES.filter((doodle) => {
    if (activeTab === "all") return true;
    if (activeTab === "doctor") return doodle.role === "doctor" || doodle.role === "general";
    if (activeTab === "sonographer") return doodle.role === "sonographer" || doodle.role === "general";
    if (activeTab === "admin") return doodle.role === "admin" || doodle.role === "general";
    return true;
  });

  const handleApply = () => {
    setDoodleId(selectedId);
    onOpenChange(false);
    toast.success("Avatar Doodle Updated", {
      description: `Your clinical avatar is now set to "${selectedDoodle.name}".`,
    });
  };

  const handleUseInitials = () => {
    // If empty string, uses initials
    setDoodleId("");
    onOpenChange(false);
    toast.info("Avatar Set to Initials", {
      description: "Reverted your avatar to standard clinical initials.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card p-6 text-foreground sm:rounded-xl">
        <DialogHeader className="space-y-1 pb-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20">
                <Palette className="h-4 w-4" />
              </span>
              Choose Your Clinical Doodle
            </DialogTitle>
            <Badge variant="outline" className="text-[11px] font-medium border-border bg-muted/30">
              Doctor · Sonographer · Admin
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Personalize your workspace avatar across reports, worklists, and audit accountability trails.
          </DialogDescription>
        </DialogHeader>

        {/* Selected Doodle Hero Preview */}
        <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border bg-muted/20 p-4 transition-all">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-primary/40 bg-background p-2 shadow-sm">
            {selectedDoodle.render({ className: "h-full w-full drop-shadow-xs" })}
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
              <Check className="h-3.5 w-3.5" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h4 className="text-sm font-bold text-foreground truncate">{selectedDoodle.name}</h4>
              <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                {selectedDoodle.categoryLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{selectedDoodle.description}</p>
            <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{staffName}</span>
              <span>·</span>
              <span className="capitalize">{staffRole}</span>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="doctor" className="text-xs gap-1">
              <Stethoscope className="h-3 w-3" />
              <span className="hidden xs:inline">Doctor</span>
            </TabsTrigger>
            <TabsTrigger value="sonographer" className="text-xs gap-1">
              <Activity className="h-3 w-3" />
              <span className="hidden xs:inline">Sonographer</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="text-xs gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span className="hidden xs:inline">Admin</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              <span>All ({CLINICAL_DOODLES.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Doodle Selection Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[260px] overflow-y-auto p-1">
            {filteredDoodles.map((doodle) => {
              const isSelected = selectedId === doodle.id;
              return (
                <button
                  key={doodle.id}
                  type="button"
                  onClick={() => setSelectedId(doodle.id)}
                  className={cn(
                    "group relative flex flex-col items-center justify-between rounded-xl border p-3 text-center transition-all cursor-pointer outline-none select-none",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                      : "border-border bg-background hover:bg-muted/40 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}

                  {/* Doodle Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/30 p-1 group-hover:scale-105 transition-transform">
                    {doodle.render({ className: "h-full w-full" })}
                  </div>

                  {/* Name & Tag */}
                  <div className="mt-2 w-full">
                    <div className="text-xs font-semibold text-foreground truncate">{doodle.name}</div>
                    <div className="text-[10px] text-muted-foreground capitalize">{doodle.categoryLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Tabs>

        {/* Modal Footer */}
        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t mt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUseInitials}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            <User className="mr-1.5 h-3.5 w-3.5" />
            Use Plain Initials Instead
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs font-semibold h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
            >
              Set as My Avatar Doodle
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
