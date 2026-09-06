import type { Patient } from "@/lib/sonoflow-types";
import { escapeHtml } from "@/lib/html-utils";
import type { KeyReportImage } from "@/lib/clinical-workflow-types";

export async function downloadElementAsPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);

  const canvas = await html2canvas(element, {
    scale: 1.5, // Reduced from 2.0 to balance quality and size
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff"
  });

  // Use JPEG instead of PNG for significantly smaller file size
  const imgData = canvas.toDataURL("image/jpeg", 0.75); // 0.75 quality is usually plenty for text
  
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true // Enable internal PDF compression
  });

  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCount = Math.max(1, Math.ceil(pdfHeight / pageHeight));
  for (let page = 0; page < pageCount; page++) {
    if (page > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, -page * pageHeight, pdfWidth, pdfHeight, "report", "FAST");
  }
  pdf.save(`${filename}.pdf`);
}

/** Download a text report directly when the report is opened from history. */
export async function downloadReportTextAsPdf(params: {
  patient: Patient;
  accession: string;
  exam: string;
  reportText: string;
  signedBy?: string | null;
  signedAt?: string | null;
  keyImages?: KeyReportImage[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lineHeight = 5.5;
  let y = margin;

  pdf.setFontSize(16);
  pdf.text("Sonolynx Radiology", margin, y);
  y += 7;
  pdf.setFontSize(10);
  pdf.text(`Patient: ${params.patient.lastName}, ${params.patient.firstName}`, margin, y);
  y += lineHeight;
  pdf.text(`MRN: ${params.patient.mrn}   Accession: ${params.accession}`, margin, y);
  y += lineHeight;
  pdf.text(`Exam: ${params.exam}`, margin, y);
  y += lineHeight;
  pdf.text(`Signed: ${params.signedAt ?? "Pending"}   By: ${params.signedBy ?? "Pending"}`, margin, y);
  y += 8;
  pdf.setFont("courier", "normal");
  const lines = pdf.splitTextToSize(params.reportText, pageWidth - margin * 2) as string[];
  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += lineHeight;
  }
  if (params.keyImages?.length) {
    if (y > pageHeight - 70) {
      pdf.addPage();
      y = margin;
    }
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("KEY IMAGES", margin, y);
    y += 6;
    for (const image of params.keyImages) {
    if (!/^data:image\/(jpeg|png);base64,/.test(image.dataUrl)) continue;
      if (y > pageHeight - 78) {
        pdf.addPage();
        y = margin;
      }
      pdf.addImage(image.dataUrl, "JPEG", margin, y, pageWidth - margin * 2, 55, undefined, "FAST");
      y += 59;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const captionLines = pdf.splitTextToSize(image.caption, pageWidth - margin * 2) as string[];
      pdf.text(captionLines, margin, y);
      y += captionLines.length * 4 + 5;
    }
  }
  pdf.save(`Report-${params.accession || "history"}.pdf`);
}

export function exportReportToPdf(params: {
  patient: Patient;
  accession: string;
  exam: string;
  reportText: string;
  signedBy?: string | null;
  signedAt?: string | null;
  keyImages?: KeyReportImage[];
}) {
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) {
    throw new Error("Popup blocked. Allow popups to export PDF.");
  }
  printWindow.opener = null;

  const safeText = escapeHtml(params.reportText);
  const keyImagesHtml = (params.keyImages ?? [])
    .filter((image) => /^data:image\/(jpeg|png);base64,/.test(image.dataUrl))
    .map((image) => `<figure><img src="${image.dataUrl}" alt="${escapeHtml(image.caption)}" /><figcaption>${escapeHtml(image.caption)}</figcaption></figure>`)
    .join("");

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Sonolynx Report ${escapeHtml(params.accession)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          h2 { font-size: 13px; margin: 24px 0 8px; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-top: 20px; font-size: 12px; }
          .report { margin-top: 28px; white-space: pre-wrap; font-family: "Courier New", monospace; font-size: 12px; line-height: 1.55; }
          .footer { margin-top: 32px; font-size: 11px; color: #4b5563; }
          .images { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
          figure { margin: 0; border: 1px solid #d1d5db; break-inside: avoid; }
          figure img { width: 100%; aspect-ratio: 4/3; object-fit: contain; background: #000; display: block; }
          figcaption { padding: 7px; font-size: 10px; }
          @media print { button { display: none; } body { margin: 28px; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="float:right;padding:8px 12px;">Print / Save PDF</button>
        <h1>Sonolynx Radiology</h1>
        <div>Signed Ultrasound Report</div>
        <div class="meta">
          <div><strong>Patient:</strong> ${escapeHtml(params.patient.lastName)}, ${escapeHtml(params.patient.firstName)}</div>
          <div><strong>MRN:</strong> ${escapeHtml(params.patient.mrn)}</div>
          <div><strong>DOB:</strong> ${escapeHtml(params.patient.dob)}</div>
          <div><strong>Exam:</strong> ${escapeHtml(params.exam)}</div>
          <div><strong>Accession:</strong> ${escapeHtml(params.accession)}</div>
          <div><strong>Signed At:</strong> ${escapeHtml(params.signedAt ?? "Pending")}</div>
          <div><strong>Signed By:</strong> ${escapeHtml(params.signedBy ?? "Pending")}</div>
        </div>
        <h2>Report</h2>
        <div class="report">${safeText}</div>
        ${keyImagesHtml ? `<h2>Key Images</h2><div class="images">${keyImagesHtml}</div>` : ""}
        <div class="footer">Electronically generated by Sonolynx. Final clinical correlation required.</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
}

