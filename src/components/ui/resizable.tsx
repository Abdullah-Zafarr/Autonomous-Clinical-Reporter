"use client";

import { Group, Panel, Separator, type GroupProps, type PanelProps, type SeparatorProps } from "react-resizable-panels";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

function ResizablePanelGroup({ className, direction = "horizontal", ...props }: GroupProps & { direction?: "horizontal" | "vertical" }) {
  return <Group orientation={direction} className={cn("h-full w-full", className)} {...props} />;
}

// Version 4 treats numeric sizes as pixels; callers use percentages.
function ResizablePanel({ defaultSize, minSize, maxSize, onResize, ...props }: Omit<PanelProps, "onResize"> & { onResize?: (percentage: number) => void }) {
  const percent = (size: number | string | undefined) => typeof size === "number" ? `${size}%` : size;
  return <Panel {...props} defaultSize={percent(defaultSize)} minSize={percent(minSize)} maxSize={percent(maxSize)} onResize={onResize ? (size) => onResize(size.asPercentage) : undefined} />;
}

function ResizableHandle({ withHandle, className, ...props }: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator className={cn("relative flex shrink-0 items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px", className)} {...props}>
      {withHandle && <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border"><GripVertical className="h-2.5 w-2.5" /></div>}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
