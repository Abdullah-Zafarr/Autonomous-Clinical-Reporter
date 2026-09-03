"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Sonolynx Runtime Error]:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Workspace Error
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected issue occurred while rendering this view. Your clinical data has not been lost.
        </p>

        {error?.message && (
          <div className="mt-4 rounded-md bg-muted/60 p-3 text-left">
            <p className="text-xs font-mono text-muted-foreground break-words line-clamp-3">
              {error.message}
            </p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => reset()} variant="default" size="sm" className="gap-1.5">
            <RotateCcw className="h-4 w-4" /> Try Again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/" className="gap-1.5">
              <Home className="h-4 w-4" /> Return Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
