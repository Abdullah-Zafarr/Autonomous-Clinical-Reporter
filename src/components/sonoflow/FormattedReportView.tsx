"use client";

import React from "react";
import { Activity, ClipboardCheck, FileText, ListChecks, Stethoscope } from "lucide-react";
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
  /^(FINDINGS|SONOGRAPHIC FINDINGS|ULTRASOUND FINDINGS|IMPRESSION|CLINICAL IMPRESSION|RECOMMENDATIONS|TECHNIQUE|CLINICAL INDICATION|INDICATION|COMPARISON|ADDITIONAL NOTES|NOTES)$/i;
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
      // Normalize line: strip markdown bold/italic/header symbols, bullets, and trailing colons
      const normalizedHeaderCandidate = line
        .replace(/^[\s\*\#\•\-\_]+|[\s\*\#\•\-\_]+$/g, "")
        .replace(/:$/, "")
        .trim();

      if (SECTION_HEADER_REGEX.test(normalizedHeaderCandidate)) {
        if (currentSection.title || currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = {
          title: normalizedHeaderCandidate.toUpperCase(),
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
      if (organMatch && !SECTION_HEADER_REGEX.test(organMatch[1].trim())) {
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
 * Parses markdown bold (**word**) and measurements (e.g. 12 cm, 2.5 mm)
 * into tasteful clinical typography without artificial underlines.
 */
export function renderFormattedContent(text: string): React.ReactNode {
  if (!text) return null;

  // Split by markdown bold **...**
  const boldParts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <>
      {boldParts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
          const inner = part.slice(2, -2);
          return (
            <strong key={index} className="font-semibold text-foreground">
              {inner}
            </strong>
          );
        }

        // Highlight measurements like "12 cm", "2.5 mm", "4 mm", "85 bpm", "1.2 m/s"
        const words = part.split(/(\b\d+(?:\.\d+)?\s*(?:cm|mm|m\/s|cm\/s|%|g|kg|bpm)\b)/gi);

        return (
          <React.Fragment key={index}>
            {words.map((w, wIdx) => {
              if (/^\d+(?:\.\d+)?\s*(?:cm|mm|m\/s|cm\/s|%|g|kg|bpm)$/i.test(w)) {
                return (
                  <strong key={wIdx} className="font-semibold text-primary dark:text-blue-400">
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
    <div className={cn("space-y-6 text-sm select-text", className)} onClick={onClick} title={title}>
      {sections.map((section, sIdx) => {
        const titleUpper = (section.title || "").toUpperCase();
        const isImpression = titleUpper.includes("IMPRESSION");
        const isNotes = titleUpper.includes("NOTE");
        const isFindings = titleUpper.includes("FINDING");
        const isRecommendations = titleUpper.includes("RECOMMEND");

        // IMPRESSION: Core clinical conclusion. Clean neutral card, black heading, blue numbered pills.
        if (isImpression) {
          return (
            <section
              key={sIdx}
              className="rounded-lg border border-border/80 bg-card p-4 space-y-3 shadow-2xs"
            >
              {section.title && (
                <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                  <ClipboardCheck className="h-4 w-4 text-foreground shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {section.title}
                  </h3>
                </div>
              )}

              <div className="space-y-2">
                {section.items.map((item, iIdx) => {
                  const cleanNumber = item.number ? item.number.replace(/[\.\)]/, "") : `${iIdx + 1}`;
                  if (item.type === "numbered") {
                    return (
                      <div key={iIdx} className="flex items-start gap-2.5 py-1 text-sm leading-relaxed">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 font-bold text-xs mt-0.5 select-none">
                          {cleanNumber}
                        </span>
                        <span className="flex-1 font-medium text-foreground">
                          {renderFormattedContent(item.content)}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <p key={iIdx} className="text-sm leading-relaxed text-foreground font-medium py-0.5">
                      {renderFormattedContent(item.content)}
                    </p>
                  );
                })}
              </div>
            </section>
          );
        }

        // ADDITIONAL NOTES: Clean neutral slate card (not purple!).
        if (isNotes) {
          return (
            <section
              key={sIdx}
              className="rounded-lg border border-border/70 bg-muted/40 dark:bg-muted/20 p-3.5 sm:p-4 space-y-2.5 shadow-2xs"
            >
              {section.title && (
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {section.title}
                  </h3>
                </div>
              )}

              <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
                {section.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="rounded-md border border-border/50 bg-background/80 px-3 py-2 text-sm leading-relaxed text-foreground"
                  >
                    {renderFormattedContent(item.content)}
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // RECOMMENDATIONS: Clean structured list with medical slate/blue accent
        if (isRecommendations) {
          return (
            <section
              key={sIdx}
              className="rounded-lg border border-border/70 bg-muted/20 dark:bg-muted/10 p-3.5 sm:p-4 space-y-2.5 shadow-2xs"
            >
              {section.title && (
                <div className="flex items-center gap-2 border-b border-border/50 pb-2">
                  <ListChecks className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                    {section.title}
                  </h3>
                </div>
              )}

              <div className="space-y-1.5 text-foreground/90">
                {section.items.map((item, iIdx) => {
                  if (item.type === "numbered") {
                    const cleanNumber = item.number ? item.number.replace(/[\.\)]/, "") : `${iIdx + 1}`;
                    return (
                      <div key={iIdx} className="flex items-start gap-2.5 py-0.5 text-sm leading-relaxed">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-semibold text-xs mt-0.5 select-none border border-border/60">
                          {cleanNumber}
                        </span>
                        <span className="flex-1 font-medium text-foreground">
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
        }

        // DEFAULT (FINDINGS, INDICATION, TECHNIQUE, etc.)
        const SectionIcon = isFindings ? Activity : Stethoscope;

        return (
          <section key={sIdx} className="space-y-2.5">
            {section.title && (
              <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                <SectionIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/85">
                  {section.title}
                </h3>
              </div>
            )}

            <div className="space-y-2 text-foreground/90">
              {section.items.map((item, iIdx) => {
                if (item.type === "organ") {
                  return (
                    <div key={iIdx} className="space-y-1 pt-1.5 first:pt-0">
                      <div className="text-sm leading-relaxed">
                        <span className="font-semibold text-foreground tracking-tight">
                          {item.organName}:
                        </span>
                        {item.content && (
                          <span className="ml-1.5 text-foreground/90">
                            {renderFormattedContent(item.content)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                if (item.type === "bullet") {
                  return (
                    <div key={iIdx} className="flex items-start gap-2.5 pl-3 py-0.5 text-sm leading-relaxed text-foreground/90">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                      <span className="flex-1">{renderFormattedContent(item.content)}</span>
                    </div>
                  );
                }

                if (item.type === "numbered") {
                  return (
                    <div key={iIdx} className="flex items-start gap-2.5 pl-1 py-0.5 text-sm leading-relaxed text-foreground/90">
                      <span className="font-semibold text-primary select-none min-w-[1.25rem]">
                        {item.number}
                      </span>
                      <span className="flex-1 font-medium">{renderFormattedContent(item.content)}</span>
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
