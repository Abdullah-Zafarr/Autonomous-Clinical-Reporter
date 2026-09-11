import type { WorksheetData, ThyroidData, Patient, ExamType, ObData, VascularData } from "./sonoflow-types";

import type { ValidationIssue } from "./clinical-validator";
export type { ValidationIssue };
import { validateWorksheet, THRESHOLDS as MEDICAL_THRESHOLDS } from "./clinical-validator";

export interface ReportSections {
  findings: string[];
  impression: string[];
  recommendations?: string[];
}

function toNum(value: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const ENGINE_THRESHOLDS = {
  liverSizeMaxCm: MEDICAL_THRESHOLDS.liverSizeMaxMm / 10,
  gbWallMaxMm: MEDICAL_THRESHOLDS.gallbladderWallMaxMm,
  cbdMaxMm: MEDICAL_THRESHOLDS.cbdMaxMm,
  spleenSizeMaxCm: MEDICAL_THRESHOLDS.spleenSizeMaxMm / 10,
  aortaMaxCm: MEDICAL_THRESHOLDS.aortaAneurysmMinMm / 10,
};

// Shim for backward compatibility with existing generateReport logic
const THRESHOLDS_COMPAT = {
  gallbladderWallMmUpper: ENGINE_THRESHOLDS.gbWallMaxMm,
  cbdMmUpper: ENGINE_THRESHOLDS.cbdMaxMm,
  pancreaticDuctMmUpper: 3,
  spleenCmUpper: ENGINE_THRESHOLDS.spleenSizeMaxCm,
  portalVeinMmUpper: 13,
  aortaEctasiaCmLower: 2.5,
  aortaAneurysmCmLower: 3,
  plausibleKidneyCmLower: 5,
  plausibleKidneyCmUpper: 16,
  plausibleLiverCmLower: 8,
  plausibleLiverCmUpper: 26,
  plausibleSpleenCmLower: 4,
  plausibleSpleenCmUpper: 24,
};

// Use proxy to handle the case where some code might still use the old name
const THRESHOLDS = THRESHOLDS_COMPAT;



export function validateExamWorksheet(type: ExamType, data: any): ValidationIssue[] {
  return validateWorksheet(type, data);
}

function thyroidRecommendationByCategoryAndSize(tirads: string, sizeCm: number | null): string | null {
  if (sizeCm === null) return "Size missing - cannot apply ACR TI-RADS follow-up/FNA threshold.";
  if (tirads === "TR1" || tirads === "TR2") return "No FNA recommended.";
  if (tirads === "TR3") {
    if (sizeCm >= 2.5) return "Recommend FNA (TR3 threshold >= 2.5 cm).";
    if (sizeCm >= 1.5) return "Recommend ultrasound follow-up (TR3 threshold >= 1.5 cm).";
    return "No FNA; optional routine follow-up per local protocol.";
  }
  if (tirads === "TR4") {
    if (sizeCm >= 1.5) return "Recommend FNA (TR4 threshold >= 1.5 cm).";
    if (sizeCm >= 1.0) return "Recommend ultrasound follow-up (TR4 threshold >= 1.0 cm).";
    return "No FNA; optional routine follow-up per local protocol.";
  }
  if (tirads === "TR5") {
    if (sizeCm >= 1.0) return "Recommend FNA (TR5 threshold >= 1.0 cm).";
    if (sizeCm >= 0.5) return "Recommend ultrasound follow-up (TR5 threshold >= 0.5 cm).";
    return "No FNA; optional short-interval follow-up per local protocol.";
  }
  return null;
}


export function generateReport(data: WorksheetData, sectionsOrder?: string[]): ReportSections {
  const findings: string[] = [];
  const impression: string[] = [];

  const defaultOrder = ["liver", "gallbladder", "biliary", "pancreas", "kidneys", "spleen", "vessels", "ascites"];
  const order = sectionsOrder || defaultOrder;

  order.forEach((sectionKey) => {
    switch (sectionKey) {
      case "liver": {
        const liverSize = data.liver?.size ? ` measuring ${data.liver.size} cm` : "";
        if (data.liver?.echotexture === "Homogeneous") {
          findings.push(
            `Liver: The liver${liverSize} demonstrates homogeneous echotexture with a ${(data.liver?.surface || "smooth").toLowerCase()} contour.`,
          );
        } else if (data.liver?.echotexture === "Diffusely echogenic (fatty infiltration)") {
          findings.push(
            `Liver: The liver${liverSize} demonstrates increased echogenicity consistent with hepatic steatosis and has a ${(data.liver?.surface || "smooth").toLowerCase()} contour.`,
          );
          impression.push("Hepatic steatosis.");
        } else if (data.liver?.echotexture) {
          findings.push(
            `Liver: The liver${liverSize} demonstrates coarsened echotexture with a ${(data.liver?.surface || "smooth").toLowerCase()} contour, which may be seen in chronic parenchymal disease.`,
          );
          impression.push("Coarsened hepatic echotexture - consider chronic liver disease.");
        }
        if (data.liver?.surface === "Nodular") {
          findings.push("Nodular liver surface contour is noted.");
          impression.push("Nodular liver contour, concerning for chronic liver disease/cirrhosis.");
        }
        if (data.liver?.focalLesions === "None") {
          findings.push("No focal hepatic lesion is seen.");
        } else if (data.liver?.focalLesions === "Cyst") {
          findings.push(
            "A well-circumscribed anechoic focal lesion with posterior acoustic enhancement is identified, consistent with a simple hepatic cyst.",
          );
          impression.push("Simple hepatic cyst.");
        } else if (data.liver?.focalLesions === "Solid Mass") {
          findings.push(
            "A solid focal hepatic lesion is identified. Further characterization with contrast-enhanced imaging is recommended.",
          );
          impression.push("Solid hepatic lesion - recommend further characterization (CT/MRI).");
        }
        break;
      }

      case "gallbladder": {
        const wt = parseFloat(data.gallbladder?.wallThickness || "");
        const wallStr = data.gallbladder?.wallThickness
          ? `Gallbladder wall measures ${data.gallbladder.wallThickness} mm`
          : "Gallbladder wall thickness not documented";
        const wallAbnormal = !isNaN(wt) && wt > THRESHOLDS.gallbladderWallMmUpper;

        if (data.gallbladder?.content === "Gallstones") {
          findings.push(
            `Gallbladder: ${wallStr}. Mobile echogenic foci with posterior acoustic shadowing are seen within the lumen, consistent with cholelithiasis.`,
          );
          impression.push("Cholelithiasis.");
        } else if (data.gallbladder?.content === "Sludge") {
          findings.push(`Gallbladder: ${wallStr}. Layering low-level echoes are present, consistent with biliary sludge.`);
          impression.push("Biliary sludge.");
        } else if (data.gallbladder) {
          findings.push(`Gallbladder: ${wallStr}. Lumen is anechoic without stones or sludge.`);
        }
        if (wallAbnormal) {
          impression.push(`Gallbladder wall thickening (${data.gallbladder?.wallThickness} mm).`);
        }
        if (data.gallbladder?.murphysSign === "Positive") {
          findings.push("Sonographic Murphy's sign is positive.");
          impression.push("Positive sonographic Murphy's sign - clinical correlation recommended for acute cholecystitis.");
        }
        break;
      }

      case "biliary": {
        const cbd = parseFloat(data.biliary?.cbd || "");
        if (data.biliary?.cbd) {
          if (!isNaN(cbd) && cbd > THRESHOLDS.cbdMmUpper) {
            findings.push(`Biliary tree: Common bile duct is dilated measuring ${data.biliary.cbd} mm.`);
            impression.push(`Common bile duct dilation (${data.biliary.cbd} mm).`);
          } else {
            findings.push(`Biliary tree: Common bile duct measures ${data.biliary.cbd} mm, within normal limits.`);
          }
        } else {
          findings.push("Biliary tree: Common bile duct is not dilated.");
        }
        if (data.biliary?.intrahepatic === "Dilated") {
          findings.push("Intrahepatic biliary ducts are dilated.");
          impression.push("Intrahepatic biliary ductal dilation.");
        } else {
          findings.push("No intrahepatic biliary ductal dilation.");
        }
        break;
      }

      case "pancreas": {
        if (data.pancreas?.visualized === "Obscured by bowel gas") {
          findings.push("Pancreas: Evaluation is limited as the gland is obscured by bowel gas.");
        } else if (data.pancreas) {
          const visPrefix = data.pancreas.visualized === "Partially visualized" ? "Pancreas: Partially visualized. " : "Pancreas: ";
          const duct = parseFloat(data.pancreas.ductMm || "");
          const ductText = data.pancreas.ductMm
            ? !isNaN(duct) && duct > 3
              ? `Main pancreatic duct is dilated measuring ${data.pancreas.ductMm} mm.`
              : `Main pancreatic duct measures ${data.pancreas.ductMm} mm.`
            : "Main pancreatic duct is not dilated.";
          findings.push(`${visPrefix}Parenchymal echotexture is ${(data.pancreas.echotexture || "").toLowerCase()}. ${ductText}`);
          if (data.pancreas.echotexture === "Heterogeneous") {
            impression.push("Heterogeneous pancreatic echotexture.");
          }
          if (data.pancreas.echotexture === "Hypoechoic") {
            impression.push("Hypoechoic pancreatic echotexture - correlate with clinical/lab findings.");
          }
          if (data.pancreas.ductMm && !isNaN(duct) && duct > THRESHOLDS.pancreaticDuctMmUpper) {
            impression.push(`Main pancreatic duct dilation (${data.pancreas.ductMm} mm).`);
          }
        }
        break;
      }

      case "kidneys": {
        const rk = data.kidneys?.rightLength ? `${data.kidneys.rightLength} cm` : "normal in length";
        const lk = data.kidneys?.leftLength ? `${data.kidneys.leftLength} cm` : "normal in length";
        findings.push(
          `Kidneys: Right kidney measures ${rk}. Left kidney measures ${lk}. Cortical echogenicity is ${(data.kidneys?.corticalEchogenicity || "normal").toLowerCase()} bilaterally.`,
        );
        if (data.kidneys?.hydronephrosis !== "None" && data.kidneys?.hydronephrosis) {
          findings.push(`${data.kidneys.hydronephrosis} hydronephrosis is identified.`);
          impression.push(`${data.kidneys.hydronephrosis} hydronephrosis.`);
        } else {
          findings.push("No hydronephrosis.");
        }
        if (data.kidneys?.corticalEchogenicity === "Increased") {
          impression.push("Increased renal cortical echogenicity, suggestive of medical renal parenchymal disease.");
        }
        if (data.kidneys?.stones !== "None" && data.kidneys?.stones) {
          findings.push(`${data.kidneys.stones} renal calculi are seen.`);
          impression.push(`${data.kidneys.stones} nephrolithiasis.`);
        }
        break;
      }

      case "spleen": {
        const spleenSize = parseFloat(data.spleen?.size || "");
        if (data.spleen?.size) {
          if (!isNaN(spleenSize) && spleenSize > THRESHOLDS.spleenCmUpper) {
            findings.push(`Spleen: Enlarged measuring ${data.spleen.size} cm.`);
            impression.push(`Splenomegaly (${data.spleen.size} cm).`);
          } else {
            findings.push(`Spleen: Measures ${data.spleen.size} cm, within normal limits.`);
          }
        } else {
          findings.push("Spleen: Normal in size.");
        }
        findings.push(`Splenic echotexture is ${(data.spleen?.echotexture || "normal").toLowerCase()}.`);
        if (data.spleen?.echotexture === "Heterogeneous") {
          impression.push("Heterogeneous splenic echotexture.");
        }
        break;
      }

      case "vessels": {
        const pv = parseFloat(data.vessels?.portalVeinMm || "");
        if (data.vessels?.portalVeinMm) {
          if (!isNaN(pv) && pv > THRESHOLDS.portalVeinMmUpper) {
            findings.push(`Portal vein is prominent measuring ${data.vessels.portalVeinMm} mm.`);
            impression.push(`Portal vein prominence (${data.vessels.portalVeinMm} mm).`);
          } else {
            findings.push(`Portal vein measures ${data.vessels.portalVeinMm} mm.`);
          }
        } else {
          findings.push("Portal vein caliber is within expected limits.");
        }

        const aortaAp = parseFloat(data.vessels?.aortaMaxApCm || "");
        if (data.vessels?.aortaMaxApCm) {
          findings.push(
            `Abdominal aorta maximum AP diameter is ${data.vessels.aortaMaxApCm} cm (${(data.vessels.aortaState || "normal").toLowerCase()}).`,
          );
        } else if (data.vessels) {
          findings.push(`Abdominal aorta appearance is ${(data.vessels.aortaState || "normal").toLowerCase()}.`);
        }
        if (
          data.vessels?.aortaState === "Ectatic" ||
          (data.vessels?.aortaMaxApCm &&
            !isNaN(aortaAp) &&
            aortaAp >= THRESHOLDS.aortaEctasiaCmLower &&
            aortaAp < THRESHOLDS.aortaAneurysmCmLower)
        ) {
          impression.push("Aortic ectasia.");
        }
        if (
          data.vessels?.aortaState === "Aneurysmal" ||
          (data.vessels?.aortaMaxApCm && !isNaN(aortaAp) && aortaAp >= THRESHOLDS.aortaAneurysmCmLower)
        ) {
          impression.push("Abdominal aortic aneurysmal dilatation.");
        }

        if (data.vessels) {
          findings.push(`IVC appears ${(data.vessels.ivcState || "normal").toLowerCase()}.`);
          if (data.vessels.ivcState === "Dilated") {
            impression.push("Dilated IVC.");
          }
        }
        break;
      }

      case "ascites": {
        if (data.ascites?.volume === "None") {
          findings.push("No ascites.");
        } else if (data.ascites) {
          findings.push(`${data.ascites.volume} ascites is present.`);
          impression.push(`${data.ascites.volume} ascites.`);
        }
        break;
      }
    }
  });

  if (impression.length === 0 && findings.length > 0) {
    impression.push(defaultOrder.every((section) => order.includes(section)) ? "Unremarkable complete abdominal ultrasound." : "No abnormality documented in the selected sections.");
  }

  return { findings, impression };
}

export function generateThyroidReport(data: ThyroidData): ReportSections {
  const hasMeasurements = [...Object.values(data.rightLobe), ...Object.values(data.leftLobe), data.isthmus].some((value) => value.trim());
  if (!hasMeasurements && !data.nodules.length && data.parenchyma === "Homogeneous" && data.vascularity === "Normal" && data.cervicalNodes === "None suspicious") return { findings: [], impression: [], recommendations: [] };
  const findings: string[] = [];
  const impression: string[] = [];
  const recommendations: string[] = [];

  const lobeStr = (lobe: { length: string; width: string; depth: string }) =>
    `${lobe.length || "-"} x ${lobe.width || "-"} x ${lobe.depth || "-"}`;

  const hasRight = data.rightLobe.length || data.rightLobe.width || data.rightLobe.depth;
  const hasLeft = data.leftLobe.length || data.leftLobe.width || data.leftLobe.depth;

  if (hasRight || hasLeft || data.isthmus) {
    const parts: string[] = [];
    if (hasRight) parts.push(`The right lobe measures ${lobeStr(data.rightLobe)} cm.`);
    if (hasLeft) parts.push(`The left lobe measures ${lobeStr(data.leftLobe)} cm.`);
    if (data.isthmus) parts.push(`The isthmus measures ${data.isthmus} mm.`);
    findings.push(
      `Thyroid gland: ${parts.join(" ")} The gland demonstrates ${data.parenchyma.toLowerCase()} echotexture with ${data.vascularity.toLowerCase()} vascularity.`,
    );
  } else {
    findings.push(
      `Thyroid gland: Dimensions not documented. ${data.parenchyma} echotexture with ${data.vascularity.toLowerCase()} vascularity.`,
    );
  }

  if (data.parenchyma !== "Homogeneous") {
    impression.push(`Thyroid parenchyma is ${data.parenchyma.toLowerCase()}.`);
  }
  if (data.vascularity === "Increased") {
    impression.push("Increased thyroid vascularity.");
  }
  if (data.cervicalNodes !== "None suspicious") {
    findings.push(`Cervical lymph nodes: ${data.cervicalNodes.toLowerCase()}.`);
    impression.push(`Suspicious cervical lymph nodes (${data.cervicalNodes.replace("Suspicious ", "")}).`);
  } else {
    findings.push("No suspicious cervical lymph nodes identified.");
  }

  if (data.nodules.length === 0) {
    findings.push("No discrete thyroid nodules identified.");
  } else {
    findings.push(`Thyroid nodules (${data.nodules.length}):`);
    data.nodules.forEach((n) => {
      const size = n.size || "unspecified";
      const sizeNum = toNum(n.size);
      const rec = thyroidRecommendationByCategoryAndSize(n.tirads, sizeNum);
      findings.push(
        `- A ${size} cm ${n.composition.toLowerCase()} nodule is seen in the ${n.location} lobe. Echogenicity: ${n.echogenicity.toLowerCase()}, shape: ${n.shape.toLowerCase()}, margin: ${n.margin.toLowerCase()}, echogenic foci: ${n.echogenicFoci.toLowerCase()}. (TI-RADS ${n.tirads})`,
      );
      if (rec) {
        recommendations.push(`Nodule (${n.location}, TI-RADS ${n.tirads}, ${size} cm): ${rec}`);
      }
    });

    const suspicious = data.nodules.filter((n) => n.tirads === "TR4" || n.tirads === "TR5");
    if (suspicious.length > 0) {
      impression.push("Suspicious thyroid nodule(s) as described; management follows the size-based ACR TI-RADS recommendations below.");
    }
    const benign = data.nodules.filter((n) => n.tirads === "TR1" || n.tirads === "TR2" || n.tirads === "TR3");
    if (benign.length > 0 && suspicious.length === 0) {
      impression.push(`${benign.length} low-suspicion thyroid nodule(s) as described; see the size-based ACR TI-RADS recommendations below.`);
    }
  }

  if (impression.length === 0) {
    impression.push("Unremarkable thyroid ultrasound.");
  }

  return { findings, impression, recommendations };
}

export function generateObReport(data: ObData): ReportSections {
  if (![data.gestationalAge, data.fetalHeartRate, data.biometryNotes, data.impression].some((value) => value.trim())) return { findings: [], impression: [] };
  const findings = [
    `OB ultrasound: Gestational age is ${data.gestationalAge || "not specified"}.`,
    `Fetal heart rate is ${data.fetalHeartRate || "not documented"} bpm.`,
    `Fetal presentation is ${data.presentation.toLowerCase()}. Placenta is ${data.placentaLocation.toLowerCase()}.`,
    `Amniotic fluid is ${data.amnioticFluid.toLowerCase()}.`,
  ];

  if (data.biometryNotes.trim()) {
    findings.push(`Biometry notes: ${data.biometryNotes.trim()}`);
  }

  return {
    findings,
    impression: [data.impression.trim() || "Clinical impression not entered. Clinician review required."],
  };
}

export function generateVascularReport(data: VascularData): ReportSections {
  if (![data.vesselExamined, data.stenosisFindings, data.waveformNotes, data.impression].some((value) => value.trim())) return { findings: [], impression: [] };
  const vessel = data.vesselExamined.trim() || "specified vessel";
  const findings = [
    `Vascular ultrasound: ${vessel} examined (${data.laterality.toLowerCase()}).`,
    `Flow patency: ${data.flowPatency.toLowerCase()}.`,
    `Thrombus: ${data.thrombusPresence.toLowerCase()}.`,
  ];

  if (data.stenosisFindings.trim()) {
    findings.push(`Stenosis findings: ${data.stenosisFindings.trim()}`);
  }
  if (data.waveformNotes.trim()) {
    findings.push(`Waveform notes: ${data.waveformNotes.trim()}`);
  }

  return {
    findings,
    impression: [data.impression.trim() || "Clinical impression not entered. Clinician review required."],
  };
}

export function reportToText(report: ReportSections): string {
  const findings = report.findings.join("\n\n");
  const impression = report.impression.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const recs = (report.recommendations ?? []).map((line, i) => `${i + 1}. ${line}`).join("\n");
  const recSection = recs ? `\n\nRECOMMENDATIONS:\n\n${recs}` : "";
  return `FINDINGS:\n\n${findings}\n\nIMPRESSION:\n\n${impression}${recSection}`;
}

export function escapeHl7Field(value: string): string {
  const escapes: Record<string, string> = { "\\": "\\E\\", "|": "\\F\\", "^": "\\S\\", "~": "\\R\\", "&": "\\T\\", "\r": "\\X0D\\", "\n": "\\X0A\\" };
  return value.replace(/[\\|^~&\r\n]/g, (character) => escapes[character]);
}

export function buildHL7(
  patient: Patient,
  reportText: string,
  accession: string,
  exam: ExamType = "Abdomen",
): string {
  const now = new Date();
  const ts =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");

  const dob = patient.dob.replace(/-/g, "");
  const msgId = `SF${ts}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const examDesc =
    exam === "Thyroid"
      ? "Thyroid US"
      : exam === "OB"
        ? "OB Ultrasound"
        : exam === "Vascular"
          ? "Vascular Ultrasound"
          : "Complete Abdomen US";

  const segments = [
    `MSH|^~\\&|SONOFLOW|CLINIC|RIS|HOSP|${ts}||ORU^R01|${msgId}|P|2.3`,
    `PID|1||${escapeHl7Field(patient.mrn)}||${escapeHl7Field(patient.lastName)}^${escapeHl7Field(patient.firstName)}||${escapeHl7Field(dob)}|`,
    `OBR|1||${escapeHl7Field(accession)}|US^Ultrasound^${examDesc}|||${ts}||||||||||||`,
    ...reportText.split(/\r?\n/).map((line, i) => `OBX|${i + 1}|TX|REPORT||${escapeHl7Field(line || " ")}||||||F`),
  ];

  return segments.join("\r\n");
}

export function buildStructuredClinicalReport(params: {
  patient: Patient;
  accession: string;
  exam: ExamType;
  report: ReportSections;
  worksheet: WorksheetData;
  thyroid: ThyroidData;
  ob?: ObData;
  vascular?: VascularData;
  additionalNotes?: string;
}): string {
  const { patient, accession, exam, report, worksheet, thyroid, ob, vascular, additionalNotes } = params;
  const now = new Date();
  const examLabel =
    exam === "Thyroid"
      ? "THYROID ULTRASOUND"
      : exam === "OB"
        ? "OB ULTRASOUND"
        : exam === "Vascular"
          ? "VASCULAR ULTRASOUND"
          : "COMPLETE ABDOMINAL ULTRASOUND";

  const lines: string[] = [];
  lines.push("SONOLYNX RADIOLOGY");
  lines.push("ULTRASOUND REPORT");
  lines.push("");
  lines.push("PATIENT DETAILS");
  lines.push(`Name: ${[patient.firstName, patient.lastName].filter(Boolean).join(" ") || "-"}`);
  lines.push(`MRN: ${patient.mrn}`);
  lines.push(`DOB: ${patient.dob}`);
  lines.push(`Accession: ${accession}`);
  lines.push(`Exam: ${examLabel}`);
  lines.push(`Report Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  lines.push("");
  lines.push("CLINICAL INDICATION");
  lines.push(
    exam === "Thyroid"
      ? "Thyroid nodule / thyroid evaluation."
      : exam === "OB"
        ? "Pregnancy assessment."
        : exam === "Vascular"
          ? "Vascular flow and patency assessment."
          : "Abdominal pain / hepatobiliary or renal evaluation.",
  );
  lines.push("");
  lines.push("TECHNIQUE");
  lines.push("Real-time grayscale ultrasound with focused measurements and assessment of relevant anatomy.");
  lines.push("");
  lines.push("KEY MEASUREMENTS");
  if (exam === "Thyroid") {
    lines.push(
      `Right lobe: ${thyroid.rightLobe.length || "-"} x ${thyroid.rightLobe.width || "-"} x ${thyroid.rightLobe.depth || "-"} cm`,
    );
    lines.push(
      `Left lobe: ${thyroid.leftLobe.length || "-"} x ${thyroid.leftLobe.width || "-"} x ${thyroid.leftLobe.depth || "-"} cm`,
    );
    lines.push(`Isthmus: ${thyroid.isthmus || "-"} mm`);
    lines.push(`Parenchyma: ${thyroid.parenchyma}`);
    lines.push(`Vascularity: ${thyroid.vascularity}`);
    lines.push(`Cervical nodes: ${thyroid.cervicalNodes}`);
    lines.push(`Nodules documented: ${thyroid.nodules.length}`);
  } else if (exam === "OB" && ob) {
    lines.push(`Gestational age: ${ob.gestationalAge || "-"}`);
    lines.push(`Fetal heart rate: ${ob.fetalHeartRate || "-"} bpm`);
    lines.push(`Presentation: ${ob.presentation}`);
    lines.push(`Placenta: ${ob.placentaLocation}`);
    lines.push(`Amniotic fluid: ${ob.amnioticFluid}`);
  } else if (exam === "Vascular" && vascular) {
    lines.push(`Vessel examined: ${vascular.vesselExamined || "-"}`);
    lines.push(`Laterality: ${vascular.laterality}`);
    lines.push(`Patency: ${vascular.flowPatency}`);
    lines.push(`Thrombus: ${vascular.thrombusPresence}`);
  } else {
    lines.push(`Liver size: ${worksheet.liver.size || "-"} cm`);
    lines.push(`Gallbladder wall: ${worksheet.gallbladder.wallThickness || "-"} mm`);
    lines.push(`CBD: ${worksheet.biliary.cbd || "-"} mm`);
    lines.push(`Right kidney length: ${worksheet.kidneys.rightLength || "-"} cm`);
    lines.push(`Left kidney length: ${worksheet.kidneys.leftLength || "-"} cm`);
    lines.push(`Spleen size: ${worksheet.spleen.size || "-"} cm`);
    lines.push(`Pancreatic duct: ${worksheet.pancreas.ductMm || "-"} mm`);
    lines.push(`Portal vein: ${worksheet.vessels.portalVeinMm || "-"} mm`);
    lines.push(`Aorta AP: ${worksheet.vessels.aortaMaxApCm || "-"} cm`);
  }
  lines.push("");
  lines.push("FINDINGS");
  report.findings.forEach((finding) => lines.push(`- ${finding}`));
  lines.push("");
  lines.push("IMPRESSION");
  report.impression.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));
  if (report.recommendations && report.recommendations.length > 0) {
    lines.push("");
    lines.push("RECOMMENDATIONS");
    report.recommendations.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));
  }
  if (additionalNotes && additionalNotes.trim()) {
    lines.push("");
    lines.push("ADDITIONAL NOTES");
    lines.push(additionalNotes.trim());
  }
  lines.push("");
  lines.push("Electronically generated report. Final clinical correlation required.");

  return lines.join("\n");
}
