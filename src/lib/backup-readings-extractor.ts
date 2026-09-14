import type { SessionBackup } from "./auto-recovery";
import type { WorksheetData, ThyroidData, ObData, VascularData } from "./sonoflow-types";

export interface ExtractedMeasurement {
  label: string;
  value: string;
  organ: string;
  unit?: string;
  isAbnormal?: boolean;
}

export interface ExtractedFinding {
  organ: string;
  finding: string;
  isAbnormal: boolean;
}

export interface BackupClinicalSummary {
  exam: string;
  measurements: ExtractedMeasurement[];
  findings: ExtractedFinding[];
  notesSnippet: string | null;
  reportSnippet: string | null;
  scansCount: number;
  correctionsCount: number;
  hasAnyData: boolean;
  totalMeasurementsCount: number;
}

/**
 * Parses any SessionBackup and extracts an authoritative clinical snapshot
 * containing all measurements, organ findings, and clinician notes.
 */
export function extractBackupReadings(backup: SessionBackup): BackupClinicalSummary {
  const measurements: ExtractedMeasurement[] = [];
  const findings: ExtractedFinding[] = [];
  const payload = backup.worksheetPayload;
  const exam = backup.exam || "Abdomen";

  if (exam === "Abdomen" && payload?.abdomen) {
    const abdomen = payload.abdomen as WorksheetData;

    // Liver
    if (abdomen.liver?.size?.trim()) {
      measurements.push({
        label: "Liver Length",
        value: abdomen.liver.size,
        organ: "Liver",
      });
    }
    if (abdomen.liver?.echotexture && abdomen.liver.echotexture !== "Homogeneous") {
      findings.push({
        organ: "Liver",
        finding: abdomen.liver.echotexture,
        isAbnormal: true,
      });
    }
    if (abdomen.liver?.surface && abdomen.liver.surface !== "Smooth") {
      findings.push({
        organ: "Liver",
        finding: `${abdomen.liver.surface} surface`,
        isAbnormal: true,
      });
    }
    if (abdomen.liver?.focalLesions && abdomen.liver.focalLesions !== "None") {
      findings.push({
        organ: "Liver",
        finding: `Focal lesion: ${abdomen.liver.focalLesions}`,
        isAbnormal: true,
      });
    }

    // Gallbladder
    if (abdomen.gallbladder?.wallThickness?.trim()) {
      measurements.push({
        label: "GB Wall",
        value: abdomen.gallbladder.wallThickness,
        organ: "Gallbladder",
      });
    }
    if (abdomen.gallbladder?.content && abdomen.gallbladder.content !== "Clear") {
      findings.push({
        organ: "Gallbladder",
        finding: abdomen.gallbladder.content,
        isAbnormal: true,
      });
    }
    if (abdomen.gallbladder?.murphysSign === "Positive") {
      findings.push({
        organ: "Gallbladder",
        finding: "Murphy's Sign Positive",
        isAbnormal: true,
      });
    }

    // Biliary
    if (abdomen.biliary?.cbd?.trim()) {
      measurements.push({
        label: "CBD Caliber",
        value: abdomen.biliary.cbd,
        organ: "Biliary",
      });
    }
    if (abdomen.biliary?.intrahepatic === "Dilated") {
      findings.push({
        organ: "Biliary",
        finding: "Intrahepatic Ducts Dilated",
        isAbnormal: true,
      });
    }

    // Kidneys
    if (abdomen.kidneys?.rightLength?.trim()) {
      measurements.push({
        label: "Rt Kidney",
        value: abdomen.kidneys.rightLength,
        organ: "Right Kidney",
      });
    }
    if (abdomen.kidneys?.leftLength?.trim()) {
      measurements.push({
        label: "Lt Kidney",
        value: abdomen.kidneys.leftLength,
        organ: "Left Kidney",
      });
    }
    if (abdomen.kidneys?.hydronephrosis && abdomen.kidneys.hydronephrosis !== "None") {
      findings.push({
        organ: "Kidneys",
        finding: `${abdomen.kidneys.hydronephrosis} Hydronephrosis`,
        isAbnormal: true,
      });
    }
    if (abdomen.kidneys?.stones && abdomen.kidneys.stones !== "None") {
      findings.push({
        organ: "Kidneys",
        finding: `Renal Calculi (${abdomen.kidneys.stones})`,
        isAbnormal: true,
      });
    }
    if (abdomen.kidneys?.corticalEchogenicity === "Increased") {
      findings.push({
        organ: "Kidneys",
        finding: "Increased Cortical Echogenicity",
        isAbnormal: true,
      });
    }

    // Spleen
    if (abdomen.spleen?.size?.trim()) {
      measurements.push({
        label: "Spleen Span",
        value: abdomen.spleen.size,
        organ: "Spleen",
      });
    }
    if (abdomen.spleen?.echotexture && abdomen.spleen.echotexture !== "Normal") {
      findings.push({
        organ: "Spleen",
        finding: abdomen.spleen.echotexture,
        isAbnormal: true,
      });
    }

    // Pancreas
    if (abdomen.pancreas?.ductMm?.trim()) {
      measurements.push({
        label: "Pancreatic Duct",
        value: abdomen.pancreas.ductMm,
        organ: "Pancreas",
      });
    }
    if (abdomen.pancreas?.visualized && abdomen.pancreas.visualized !== "Fully visualized") {
      findings.push({
        organ: "Pancreas",
        finding: abdomen.pancreas.visualized,
        isAbnormal: false,
      });
    }
    if (abdomen.pancreas?.echotexture && abdomen.pancreas.echotexture !== "Normal") {
      findings.push({
        organ: "Pancreas",
        finding: `Echotexture: ${abdomen.pancreas.echotexture}`,
        isAbnormal: true,
      });
    }

    // Vessels
    if (abdomen.vessels?.aortaMaxApCm?.trim()) {
      measurements.push({
        label: "Aorta AP",
        value: abdomen.vessels.aortaMaxApCm,
        organ: "Aorta",
      });
    }
    if (abdomen.vessels?.portalVeinMm?.trim()) {
      measurements.push({
        label: "Portal Vein",
        value: abdomen.vessels.portalVeinMm,
        organ: "Portal Vein",
      });
    }
    if (abdomen.vessels?.aortaState && abdomen.vessels.aortaState !== "Normal") {
      findings.push({
        organ: "Aorta",
        finding: `Aorta ${abdomen.vessels.aortaState}`,
        isAbnormal: true,
      });
    }
    if (abdomen.vessels?.ivcState && abdomen.vessels.ivcState !== "Normal") {
      findings.push({
        organ: "IVC",
        finding: `IVC ${abdomen.vessels.ivcState}`,
        isAbnormal: true,
      });
    }

    // Ascites
    if (abdomen.ascites?.volume && abdomen.ascites.volume !== "None") {
      findings.push({
        organ: "Peritoneum",
        finding: `${abdomen.ascites.volume} Ascites`,
        isAbnormal: true,
      });
    }
  } else if (exam === "Thyroid" && payload?.thyroid) {
    const thyroid = payload.thyroid as ThyroidData;

    // Right lobe
    const rt = thyroid.rightLobe;
    if (rt && (rt.length?.trim() || rt.width?.trim() || rt.depth?.trim())) {
      const dims = [rt.length, rt.width, rt.depth].filter(Boolean).join(" × ");
      measurements.push({
        label: "Right Lobe",
        value: dims,
        organ: "Thyroid (Rt)",
      });
    }

    // Left lobe
    const lt = thyroid.leftLobe;
    if (lt && (lt.length?.trim() || lt.width?.trim() || lt.depth?.trim())) {
      const dims = [lt.length, lt.width, lt.depth].filter(Boolean).join(" × ");
      measurements.push({
        label: "Left Lobe",
        value: dims,
        organ: "Thyroid (Lt)",
      });
    }

    // Isthmus
    if (thyroid.isthmus?.trim()) {
      measurements.push({
        label: "Isthmus",
        value: thyroid.isthmus,
        organ: "Isthmus",
      });
    }

    // Nodules
    if (Array.isArray(thyroid.nodules) && thyroid.nodules.length > 0) {
      measurements.push({
        label: "Nodules Count",
        value: `${thyroid.nodules.length} nodule(s)`,
        organ: "Nodules",
      });
      thyroid.nodules.forEach((n, idx) => {
        findings.push({
          organ: `Nodule #${idx + 1} (${n.location || "Thyroid"})`,
          finding: `${n.size || "Unknown size"}, ${n.tirads || "TR?"}, ${n.composition || ""}`,
          isAbnormal: n.tirads === "TR4" || n.tirads === "TR5",
        });
      });
    }

    if (thyroid.parenchyma && thyroid.parenchyma !== "Homogeneous") {
      findings.push({
        organ: "Thyroid",
        finding: thyroid.parenchyma,
        isAbnormal: true,
      });
    }
    if (thyroid.vascularity && thyroid.vascularity !== "Normal") {
      findings.push({
        organ: "Thyroid",
        finding: `Vascularity: ${thyroid.vascularity}`,
        isAbnormal: true,
      });
    }
    if (thyroid.cervicalNodes && thyroid.cervicalNodes !== "None suspicious") {
      findings.push({
        organ: "Cervical Nodes",
        finding: thyroid.cervicalNodes,
        isAbnormal: true,
      });
    }
  } else if (exam === "OB" && payload?.ob) {
    const ob = payload.ob as ObData;

    if (ob.gestationalAge?.trim()) {
      measurements.push({
        label: "Gestational Age",
        value: ob.gestationalAge,
        organ: "Fetus",
      });
    }
    if (ob.fetalHeartRate?.trim()) {
      measurements.push({
        label: "Fetal Heart Rate",
        value: ob.fetalHeartRate,
        organ: "Fetus",
      });
    }
    if (ob.presentation) {
      findings.push({
        organ: "Fetus",
        finding: `Presentation: ${ob.presentation}`,
        isAbnormal: false,
      });
    }
    if (ob.placentaLocation) {
      findings.push({
        organ: "Placenta",
        finding: `Location: ${ob.placentaLocation}`,
        isAbnormal: ob.placentaLocation === "Previa" || ob.placentaLocation === "Low-lying",
      });
    }
    if (ob.amnioticFluid && ob.amnioticFluid !== "Normal") {
      findings.push({
        organ: "Amniotic Fluid",
        finding: `${ob.amnioticFluid} fluid volume`,
        isAbnormal: true,
      });
    }
    if (ob.impression?.trim()) {
      findings.push({
        organ: "Impression",
        finding: ob.impression,
        isAbnormal: false,
      });
    }
  } else if (exam === "Vascular" && payload?.vascular) {
    const vascular = payload.vascular as VascularData;

    if (vascular.vesselExamined?.trim()) {
      measurements.push({
        label: "Vessel",
        value: `${vascular.vesselExamined} (${vascular.laterality || "Bilateral"})`,
        organ: "Vascular",
      });
    }
    if (vascular.flowPatency) {
      findings.push({
        organ: "Flow Patency",
        finding: vascular.flowPatency,
        isAbnormal: vascular.flowPatency !== "Patent",
      });
    }
    if (vascular.thrombusPresence && vascular.thrombusPresence !== "Absent") {
      findings.push({
        organ: "Thrombus",
        finding: `Thrombus: ${vascular.thrombusPresence}`,
        isAbnormal: true,
      });
    }
    if (vascular.stenosisFindings?.trim()) {
      findings.push({
        organ: "Stenosis",
        finding: vascular.stenosisFindings,
        isAbnormal: true,
      });
    }
  }

  // Notes & Report snippets
  let notesSnippet: string | null = null;
  const rawNotes = backup.additionalNotes || payload?.additionalNotes;
  if (rawNotes && rawNotes.trim()) {
    notesSnippet = rawNotes.trim().length > 120 ? `${rawNotes.trim().slice(0, 120)}…` : rawNotes.trim();
  }

  let reportSnippet: string | null = null;
  if (backup.editedReportText && backup.editedReportText.trim()) {
    const trimmed = backup.editedReportText.trim();
    reportSnippet = trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
  }

  const scansCount = backup.keyImages?.length || 0;
  const correctionsCount = backup.corrections?.length || 0;

  const hasAnyData =
    measurements.length > 0 ||
    findings.length > 0 ||
    Boolean(notesSnippet) ||
    Boolean(reportSnippet) ||
    scansCount > 0;

  return {
    exam,
    measurements,
    findings,
    notesSnippet,
    reportSnippet,
    scansCount,
    correctionsCount,
    hasAnyData,
    totalMeasurementsCount: measurements.length,
  };
}
