import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center rounded-lg bg-white overflow-hidden",
          dims,
        )}
      >
        <Image
          src="/radix-logo.png"
          alt="Radix"
          fill
          sizes={size === "lg" ? "40px" : size === "sm" ? "24px" : "32px"}
          className="object-contain mix-blend-multiply"
          priority
        />
      </div>
      <div className="flex flex-col leading-none text-left">
        <span className={cn("font-bold tracking-tight text-slate-900", text)}>Radix</span>
        {size !== "sm" && (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            Radiology
          </span>
        )}
      </div>
    </div>
  );
}
