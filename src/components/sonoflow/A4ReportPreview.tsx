"use client";

import { escapeHtml } from "@/lib/html-utils";
import type { RenderedTemplateDocument } from "@/lib/report-template-engine";
import type { ReportBrandingSettings } from "@/lib/report-template-types";

interface Props {
  document: RenderedTemplateDocument;
  branding: ReportBrandingSettings;
  showSonolynxBranding: boolean;
}

export function buildA4ReportHtml(
  document: RenderedTemplateDocument,
  branding: ReportBrandingSettings,
  showSonolynxBranding: boolean,
) {
  const logoHtml = branding.logoUrl
    ? `<img alt="Hospital logo" src="${escapeHtml(branding.logoUrl)}" style="max-height:56px;max-width:220px;object-fit:contain;" />`
    : "";

  const sections = document.sections
    .map(
      (section) =>
        `<section class="section"><h3>${escapeHtml(section.title)}</h3><pre>${escapeHtml(section.content)}</pre></section>`,
    )
    .join("");

  const footerText = branding.footerText || "";
  const sonolynx = showSonolynxBranding ? "Generated with Sonolynx" : "";
  const footer = [footerText, sonolynx].filter(Boolean).join(" · ");

  return `<div class="a4">
    <header class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <h2 style="margin:0;font-size:16px;">${escapeHtml(branding.hospitalName || "Hospital / Lab")}</h2>
        <div style="font-size:11px;color:#444;margin-top:2px;">${escapeHtml(branding.hospitalAddress || "")}</div>
      </div>
      <div>${logoHtml}</div>
    </header>
    ${sections}
    <footer class="footer">${escapeHtml(footer)}</footer>
  </div>`;
}

export function A4ReportPreview({ document, branding, showSonolynxBranding }: Props) {
  return (
    <div className="mx-auto w-full max-w-[794px] bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3 break-inside-avoid">
        <div>
          <h2 className="text-base font-bold">{branding.hospitalName || "Hospital / Lab"}</h2>
          {branding.hospitalAddress && <p className="text-xs text-muted-foreground">{branding.hospitalAddress}</p>}
          <p className="mt-1 text-[11px] text-muted-foreground">{document.templateName}</p>
        </div>
        {branding.logoUrl ? (
          // Branding URLs are tenant-configured and may be hosted on any
          // clinic domain; plain img avoids Next Image remote-host allowlists.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt="Hospital logo"
            width={220}
            height={56}
            className="h-14 w-auto object-contain"
          />
        ) : null}
      </header>

      <div className="space-y-4">
        {document.sections.map((section) => (
          <section key={section.title} className="break-inside-avoid-page rounded-md border p-3">
            <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide">{section.title}</h3>
            <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed">{section.content}</pre>
          </section>
        ))}
      </div>

      {(branding.footerText || showSonolynxBranding) && (
        <footer className="mt-4 border-t pt-2 text-center text-[10px] text-muted-foreground">
          {[branding.footerText, showSonolynxBranding ? "Generated with Sonolynx" : ""].filter(Boolean).join(" · ")}
        </footer>
      )}
    </div>
  );
}
