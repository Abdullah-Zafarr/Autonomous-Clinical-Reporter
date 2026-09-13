"use client";

import React from "react";
import { Activity, CheckCircle2, ListPlus, FileText, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionItem {
  type: "organ" | "bullet" | "numbered" | "paragraph";
  organName?: string;
  number?: string;
  content: string;
}

interface SectionBlock {
  title?: string;
  items: SectionItem[];
}

const SECTION_HEADER_REGEX =
  /^(FINDINGS|SONOGRAPHIC FINDINGS|ULTRASOUND FINDINGS|IMPRESSION|CLINICAL IMPRESSION|RECOMMENDATIONS|TECHNIQUE|CLINICAL INDICATION|INDICATION|COMPARISON|ADDITIONAL NOTES|NOTES):?$/i;
const ORGAN_PREFIX_REGEX = /^([A-Z][a-zA-Z\s\/\-]{1,25}):\s*(.*)$/;
const NUMBERED_ITEM_REGEX = /^(\d+[\.\)])\s*(.*)$/;
const BULLET_ITEM_REGEX = /^[\•\-\*]\s*(.*)$/;

export function parseClinicalReportText(text: string): SectionBlock[] {
  if (!text || !text.trim()) return [];

  const sections: SectionBlock[] = [];
  let currentSection: SectionBlock = { items: [] };

  const rawParagraphs = text.split(/\n\n+/);

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const lines = trimmed
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (SECTION_HEADER_REGEX.test(line)) {
        if (currentSection.title || currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/:$/, "").toUpperCase(),
          items: [],
        };
        continue;
      }

      const numMatch = line.match(NUMBERED_ITEM_REGEX);
      if (numMatch) {
        currentSection.items.push({
          type: "numbered",
          number: numMatch[1],
          content: numMatch[2],
        });
        continue;
      }

      const bulletMatch = line.match(BULLET_ITEM_REGEX);
      if (bulletMatch) {
        currentSection.items.push({
          type: "bullet",
          content: bulletMatch[1],
        });
        continue;
      }

      const organMatch = line.match(ORGAN_PREFIX_REGEX);
      if (organMatch && !SECTION_HEADER_REGEX.test(organMatch[1] + ":")) {
        currentSection.items.push({
          type: "organ",
          organName: organMatch[1],
          content: organMatch[2],
        });
        continue;
      }

      // If we are in findings and there was an organ or bullet before, format as sub-bullet finding
      const lastItem = currentSection.items[currentSection.items.length - 1];
      const isFindingSection = !currentSection.title || currentSection.title.includes("FINDING");
      if (isFindingSection && lastItem && (lastItem.type === "organ" || lastItem.type === "bullet")) {
        currentSection.items.push({
          type: "bullet",
          content: line,
        });
      } else {
        currentSection.items.push({
          type: "paragraph",
          content: line,
        });
      }
    }
  }

  if (currentSection.title || currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parses markdown bold (**word**), measurements (e.g. 12 cm, 2.5 mm),
 * and key clinical diagnostic findings to give them emphatic bold rendering.
 */
export function renderFormattedContent(text: string): React.ReactNode {
  if (!text) return null;

  // Regex to split by markdown bold **...**
  const boldParts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <>
      {boldParts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          const inner = part.slice(2, -2);
          return (
            <strong key={index} className="font-bold text-foreground">
              {inner}
            </strong>
          );
        }

        // Highlight measurements like "12 cm", "2.5 mm", "4 mm" and key clinical words
        const words = part.split(/(\b\d+(?:\.\d+)?\s*(?:cm|mm|m\/s|cm\/s|%|g|kg|bpm)\b|\b(?:positive|negative|simple hepatic cyst|biliary sludge|acute cholecystitis|cholelithiasis|splenomegaly|calculi|hydronephrosis|stenosis|thrombus)\b)/gi);

        return (
          <React.Fragment key={index}>
            {words.map((w, wIdx) => {
              if (/^\d+(?:\.\d+)?\s*(?:cm|mm|m\/s|cm\/s|%|g|kg|bpm)$/i.test(w)) {
                return (
                  <strong key={wIdx} className="font-semibold text-foreground">
                    {w}
                  </strong>
                );
              }
              if (/^(?:positive|acute cholecystitis|simple hepatic cyst|biliary sludge|cholelithiasis|splenomegaly|calculi|hydronephrosis|stenosis|thrombus)$/i.test(w)) {
                return (
                  <strong key={wIdx} className="font-semibold text-foreground underline decoration-primary/40 decoration-1 underline-offset-2">
                    {w}
                  </strong>
                );
              }
              return w;
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

interface FormattedReportViewProps {
  text: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}

export function FormattedReportView({ text, className, onClick, title }: FormattedReportViewProps) {
  const sections = React.useMemo(() => parseClinicalReportText(text), [text]);

  if (!text || !text.trim()) {
    return (
      <div className={cn("text-sm text-muted-foreground italic py-4", className)}>
        No report content available.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 text-sm select-text", className)} onClick={onClick} title={title}>
      {sections.map((section, sIdx) => {
        const titleUpper = section.title?.toUpperCase() || "";
        const isFindings = titleUpper.includes("FINDING");
        const isImpression = titleUpper.includes("IMPRESSION");
        const isRecs = titleUpper.includes("RECOMMENDATION");

        const SectionIcon = isFindings
          ? Activity
          : isImpression
          ? CheckCircle2
          : isRecs
          ? ListPlus
          : Stethoscope;

        return (
          <section key={sIdx} className="rounded-lg border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs">
            {section.title && (
              <div className="mb-3 flex items-center gap-2 border-b border-border/70 pb-2">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-md",
                    isFindings
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      : isImpression
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                      : isRecs
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  <SectionIcon className="h-3.5 w-3.5" />
                </div>
                <h3
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isFindings
                      ? "text-blue-700 dark:text-blue-300"
                      : isImpression
                      ? "text-emerald-700 dark:text-emerald-300"
                      : isRecs
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-primary"
                  )}
                >
                  {section.title}
                </h3>
              </div>
            )}

            <div className="space-y-2">
              {section.items.map((item, iIdx) => {
                if (item.type === "organ") {
                  return (
                    <div key={iIdx} className="mt-3.5 first:mt-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        <span className="font-bold text-sm text-foreground tracking-tight">
                          {item.organName}
                        </span>
                      </div>
                      {item.content && (
                        <div className="flex items-start gap-2 pl-4 py-0.5 text-sm leading-relaxed text-foreground/90">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400/80 dark:bg-slate-500 shrink-0" />
                          <span>{renderFormattedContent(item.content)}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.type === "bullet") {
                  return (
                    <div key={iIdx} className="flex items-start gap-2 pl-4 py-0.5 text-sm leading-relaxed text-foreground/90">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400/80 dark:bg-slate-500 shrink-0" />
                      <span>{renderFormattedContent(item.content)}</span>
                    </div>
                  );
                }

                if (item.type === "numbered") {
                  return (
                    <div
                      key={iIdx}
                      className="flex items-start gap-2.5 py-1 rounded-md bg-muted/30 px-2.5 border border-border/40 my-1 text-sm leading-relaxed text-foreground"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5",
                          isImpression
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300"
                            : isRecs
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {(item.number || `${iIdx + 1}`).replace(/[\.\)]/, "")}
                      </span>
                      <span className="font-medium flex-1 pt-0.5">
                        {renderFormattedContent(item.content)}
                      </span>
                    </div>
                  );
                }

                return (
                  <p key={iIdx} className="text-sm leading-relaxed text-foreground/90 py-0.5">
                    {renderFormattedContent(item.content)}
                  </p>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
