"use client";

import { useState } from "react";
import { Copy, Check, Code2, Download, WrapText, FileText } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hl7: string;
}

export function HL7InspectorDialog({ open, onOpenChange, hl7 }: Props) {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const rawHl7 = hl7 || "";
  const display = rawHl7.replace(/\r\n/g, "\n");
  const lines = display.split("\n").filter(Boolean);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawHl7);
      setCopied(true);
      toast.success("HL7 Payload Copied", {
        description: "Standard HL7 ORU^R01 payload copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy HL7 payload.");
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([rawHl7], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `hl7_oru_r01_${Date.now()}.hl7`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("HL7 File Downloaded");
    } catch {
      toast.error("Failed to download file.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full min-w-0 overflow-hidden border-border bg-card p-6 text-foreground shadow-2xl sm:rounded-xl">
        <DialogHeader className="space-y-1 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground border border-border">
                <Code2 className="h-4 w-4 text-muted-foreground" />
              </span>
              Generated HL7 ORU^R01 Message
              <Badge variant="outline" className="text-[10px] font-mono border-border bg-muted/40">
                v2.3
              </Badge>
            </DialogTitle>
            <Badge variant="secondary" className="text-[11px] font-mono">
              {lines.length} {lines.length === 1 ? "Segment" : "Segments"}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Live preview of the HL7 clinical payload formatted for electronic transmission to the RIS / PACS upon signing.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Segments: MSH (header) · PID (patient) · OBR (order) · OBX (report)</span>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setWrapLines((prev) => !prev)}
              className={cn("h-7 text-xs gap-1 border-border", wrapLines && "bg-muted font-semibold")}
              title="Toggle line wrapping"
            >
              <WrapText className="h-3.5 w-3.5" />
              <span>{wrapLines ? "Unwrap" : "Wrap Lines"}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="h-7 text-xs gap-1 border-border"
              title="Download raw .hl7 file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download .hl7</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="h-7 text-xs gap-1 border-border"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy HL7
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Code Content Container: Guaranteed strictly bounded, zero overflow */}
        <div className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-inner">
          <div
            className={cn(
              "max-h-[50vh] w-full max-w-full overflow-y-auto p-2 font-mono text-[12px] leading-relaxed select-text",
              wrapLines ? "overflow-x-hidden" : "overflow-x-auto"
            )}
          >
            {lines.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No HL7 payload generated yet. Enter patient details or findings to construct message.
              </div>
            ) : (
              lines.map((line, i) => {
                const seg = line.slice(0, 3);
                const rest = line.slice(3);

                return (
                  <div
                    key={i}
                    className="flex items-start hover:bg-slate-900/80 py-0.5 px-1 rounded transition-colors"
                  >
                    <span className="select-none text-slate-600 w-7 text-right pr-2 shrink-0 text-[11px] font-mono">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[12px] leading-relaxed text-slate-300",
                        wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre"
                      )}
                    >
                      <span className="font-bold text-slate-100">{seg}</span>
                      <span>{rest}</span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t mt-1">
          <div className="text-[11px] text-muted-foreground my-auto mr-auto hidden sm:flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>HL7 v2.3 ORU^R01 standard format with pipe-delimited segment structure.</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs ml-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
