"use client";

import { Button } from "@/components/ui/button";
import { Printer, Download, Loader2 } from "lucide-react";
import { printElementById } from "@/lib/report-print-utils";
import { downloadElementAsPdf } from "@/lib/pdf-export";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  targetId: string;
}

export function ReportDownloadButton({ targetId }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadElementAsPdf(targetId, `Report-${new Date().getTime()}`);
    } catch (err) {
      toast.error("PDF download failed", { description: err instanceof Error ? err.message : "Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => { try { printElementById(targetId); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to print report"); } }}
        className="h-9"
      >
        <Printer className="mr-1.5 h-3.5 w-3.5" />
        Print PDF
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className="h-9 bg-background"
      >
        {downloading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="mr-1.5 h-3.5 w-3.5" />
        )}
        Download PDF
      </Button>
    </div>
  );
}
