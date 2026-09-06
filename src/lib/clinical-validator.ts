import { 
  WorksheetData, 
  ThyroidData, 
  ObData, 
  VascularData 
} from "./sonoflow-types";

export type ValidationLevel = "info" | "warning" | "error";

export interface ValidationIssue {
  field: string;
  level: ValidationLevel;
  message: string;
}

/**
 * ACR & Standard Clinical Thresholds
 */
export const THRESHOLDS = {
  // Abdomen
  liverSizeMaxMm: 160, 
  liverSizeImpossibleMaxMm: 500,
  liverSizeImpossibleMinMm: 50, // 5cm is impossible for adult
  liverSizeWarningMinMm: 80,  // 8cm is very small/atrophic
  
  gallbladderWallMaxMm: 3,
  gallbladderWallImpossibleMaxMm: 30,
  
  cbdMaxMm: 6,
  cbdImpossibleMaxMm: 30,
  
  pancreaticDuctMaxMm: 3,
  pancreaticDuctImpossibleMaxMm: 20,
  
  spleenSizeMaxMm: 130, 
  spleenSizeImpossibleMaxMm: 400,
  spleenSizeImpossibleMinMm: 30, // 3cm
  
  portalVeinMaxMm: 13,
  portalVeinImpossibleMaxMm: 30,
  
  aortaEctasiaMinMm: 20,
  aortaAneurysmMinMm: 30,
  aortaImpossibleMaxMm: 150,
  
  kidneyLengthMinMm: 80,
  kidneyLengthMaxMm: 130,
  kidneyImpossibleMaxMm: 300,
  kidneyImpossibleMinMm: 40, // 4cm
  
  // Thyroid
  thyroidLobeLengthMaxMm: 60,
  thyroidLobeWidthMaxMm: 20,
  thyroidLobeDepthMaxMm: 20,
  thyroidLobeImpossibleMaxMm: 150,
  thyroidLobeImpossibleMinMm: 10, // 1cm
  
  thyroidIsthmusMaxMm: 4,
  thyroidIsthmusImpossibleMaxMm: 30,
  thyroidNoduleSizeAlertMm: 10,

  // OB
  fetalHeartRateMin: 90,
  fetalHeartRateMax: 180,
  fetalHeartRateImpossibleMin: 20,
  fetalHeartRateImpossibleMax: 350,

  // Vascular
  psvMax: 125,
  psvImpossibleMax: 1000,
};

function parseNum(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") {
    if (!val.trim()) return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  }
  return isNaN(val as number) ? null : (val as number);
}

function checkPhysical(issues: ValidationIssue[], val: number | null, field: string, label: string, impossibleMin: number, impossibleMax: number, normalMax: number, unit: string = "cm") {
  if (val === null) return;
  if (val < 0) {
    issues.push({ field, level: "error", message: `Negative ${label} is physically impossible.` });
    return;
  }
  if (val < impossibleMin) {
    issues.push({ field, level: "error", message: `Physically impossible ${label} (< ${impossibleMin}${unit})` });
  } else if (val > impossibleMax) {
    issues.push({ field, level: "error", message: `Physically impossible ${label} (> ${impossibleMax}${unit})` });
  } else if (val > normalMax) {
    issues.push({ field, level: "warning", message: `${label} exceeds normal size thresholds (${normalMax}${unit}).` });
  }
}

export function validateAbdomen(data: WorksheetData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Liver
  const liverSize = parseNum(data.liver.size);
  if (liverSize !== null) {
    if (liverSize < THRESHOLDS.liverSizeImpossibleMinMm / 10) {
      issues.push({ field: "liver.size", level: "error", message: `Physically impossible liver size (< ${THRESHOLDS.liverSizeImpossibleMinMm / 10}cm)` });
    } else if (liverSize < THRESHOLDS.liverSizeWarningMinMm / 10) {
      issues.push({ field: "liver.size", level: "warning", message: "Small/atrophic liver size noted." });
    } else {
      checkPhysical(issues, liverSize, "liver.size", "liver size", 0, THRESHOLDS.liverSizeImpossibleMaxMm / 10, THRESHOLDS.liverSizeMaxMm / 10);
    }
  }

  // Gallbladder
  checkPhysical(issues, parseNum(data.gallbladder.wallThickness), "gallbladder.wallThickness", "GB wall", 0.5, THRESHOLDS.gallbladderWallImpossibleMaxMm, THRESHOLDS.gallbladderWallMaxMm, "mm");

  // CBD
  checkPhysical(issues, parseNum(data.biliary.cbd), "biliary.cbd", "CBD caliber", 1, THRESHOLDS.cbdImpossibleMaxMm, THRESHOLDS.cbdMaxMm, "mm");

  // Pancreas
  checkPhysical(issues, parseNum(data.pancreas.ductMm), "pancreas.ductMm", "pancreatic duct", 0, THRESHOLDS.pancreaticDuctImpossibleMaxMm, THRESHOLDS.pancreaticDuctMaxMm, "mm");

  // Kidneys
  const rk = parseNum(data.kidneys.rightLength);
  const lk = parseNum(data.kidneys.leftLength);
  [
    { val: rk, field: "kidneys.rightLength", label: "right kidney" },
    { val: lk, field: "kidneys.leftLength", label: "left kidney" }
  ].forEach(({ val, field, label }) => {
    if (val === null) return;
    if (val < THRESHOLDS.kidneyImpossibleMinMm / 10) {
      issues.push({ field, level: "error", message: `Physically impossible ${label} length (< ${THRESHOLDS.kidneyImpossibleMinMm / 10}cm).` });
    } else if (val > THRESHOLDS.kidneyImpossibleMaxMm / 10) {
      issues.push({ field, level: "error", message: `Physically impossible ${label} length (> ${THRESHOLDS.kidneyImpossibleMaxMm / 10}cm).` });
    } else if (val < THRESHOLDS.kidneyLengthMinMm / 10) {
      issues.push({ field, level: "warning", message: `Small ${label} length (< ${THRESHOLDS.kidneyLengthMinMm / 10}cm).` });
    }
  });

  // Spleen
  checkPhysical(issues, parseNum(data.spleen.size), "spleen.size", "spleen size", THRESHOLDS.spleenSizeImpossibleMinMm / 10, THRESHOLDS.spleenSizeImpossibleMaxMm / 10, THRESHOLDS.spleenSizeMaxMm / 10);

  // Vessels
  checkPhysical(issues, parseNum(data.vessels.portalVeinMm), "vessels.portalVeinMm", "portal vein", 5, THRESHOLDS.portalVeinImpossibleMaxMm, THRESHOLDS.portalVeinMaxMm, "mm");

  const aorta = parseNum(data.vessels.aortaMaxApCm);
  if (aorta !== null) {
    if (aorta < 1.0) {
      issues.push({ field: "vessels.aortaMaxApCm", level: "error", message: "Physically impossible aortic diameter (< 1cm)." });
    } else if (aorta > THRESHOLDS.aortaImpossibleMaxMm / 10) {
      issues.push({ field: "vessels.aortaMaxApCm", level: "error", message: `Physically impossible aortic diameter (> ${THRESHOLDS.aortaImpossibleMaxMm / 10}cm).` });
    } else if (aorta >= THRESHOLDS.aortaAneurysmMinMm / 10) {
      issues.push({ field: "vessels.aortaMaxApCm", level: "warning", message: "AAA thresholds met." });
    }
  }

  return issues;
}

export function validateThyroid(data: ThyroidData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkLobe = (lobe: "right" | "left", dims: any) => {
    ["length", "width", "depth"].forEach(dim => {
      const val = parseNum(dims[dim]);
      const field = `thyroid.${lobe}Lobe.${dim}`;
      if (val === null) return;
      if (val < THRESHOLDS.thyroidLobeImpossibleMinMm / 10) {
        issues.push({ field, level: "error", message: `Physically impossible ${lobe} lobe ${dim} (< ${THRESHOLDS.thyroidLobeImpossibleMinMm / 10}cm).` });
      } else if (val > THRESHOLDS.thyroidLobeImpossibleMaxMm / 10) {
        issues.push({ field, level: "error", message: `Physically impossible ${lobe} lobe ${dim} (> ${THRESHOLDS.thyroidLobeImpossibleMaxMm / 10}cm).` });
      }
    });
  };

  checkLobe("right", data.rightLobe);
  checkLobe("left", data.leftLobe);

  checkPhysical(
    issues,
    parseNum(data.isthmus),
    "thyroid.isthmus",
    "isthmus",
    0.1,
    THRESHOLDS.thyroidIsthmusImpossibleMaxMm,
    THRESHOLDS.thyroidIsthmusMaxMm,
    "mm",
  );

  data.nodules.forEach((n, idx) => {
    const sz = parseNum(n.size);
    if (sz === null) return;
    if (sz < 0.1) {
      issues.push({ field: `thyroid.nodule.${idx}`, level: "error", message: `Physically impossible nodule size (< 1mm).` });
    } else if (sz > THRESHOLDS.thyroidLobeImpossibleMaxMm / 10) {
      issues.push({ field: `thyroid.nodule.${idx}`, level: "error", message: `Impossible nodule size (> ${THRESHOLDS.thyroidLobeImpossibleMaxMm / 10}cm).` });
    } else if (sz > THRESHOLDS.thyroidNoduleSizeAlertMm / 10) {
      issues.push({ field: `thyroid.nodule.${idx}`, level: "info", message: `Nodule #${idx + 1} > 1cm - TI-RADS recommended.` });
    }
  });

  return issues;
}

export function validateOb(data: ObData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const fhr = parseNum(data.fetalHeartRate);
  if (fhr !== null) {
    if (fhr < THRESHOLDS.fetalHeartRateImpossibleMin || fhr > THRESHOLDS.fetalHeartRateImpossibleMax) {
      issues.push({ field: "ob.fetalHeartRate", level: "error", message: "Physically impossible Fetal Heart Rate." });
    } else if (fhr < THRESHOLDS.fetalHeartRateMin) {
      issues.push({ field: "ob.fetalHeartRate", level: "warning", message: "Fetal Bradycardia suspected (< 90 bpm)." });
    } else if (fhr > THRESHOLDS.fetalHeartRateMax) {
      issues.push({ field: "ob.fetalHeartRate", level: "warning", message: "Fetal Tachycardia suspected (> 180 bpm)." });
    }
  }

  return issues;
}

export function validateVascular(data: VascularData): ValidationIssue[] {
  return [];
}

export function validateWorksheet(type: string, data: any): ValidationIssue[] {
  const numericKeys = new Set(["size", "wallThickness", "cbd", "rightLength", "leftLength", "ductMm", "portalVeinMm", "aortaMaxApCm", "length", "width", "depth", "isthmus", "fetalHeartRate"]);
  const malformed: ValidationIssue[] = [];
  const visit = (value: unknown, path = "") => {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      const field = path ? `${path}.${key}` : key;
      if (entry && typeof entry === "object") visit(entry, field);
      else if (numericKeys.has(key) && entry !== null && entry !== undefined && String(entry).trim() && !Number.isFinite(Number(entry))) {
        malformed.push({ field, level: "error", message: `Enter a valid number for ${field}.` });
      }
    }
  };
  visit(data, type === "Thyroid" ? "thyroid" : type === "OB" ? "ob" : "");
  let issues: ValidationIssue[];
  switch (type) {
    case "Abdomen": issues = validateAbdomen(data as WorksheetData); break;
    case "Thyroid": issues = validateThyroid(data as ThyroidData); break;
    case "OB": issues = validateOb(data as ObData); break;
    case "Vascular": issues = validateVascular(data as VascularData); break;
    default: issues = [];
  }
  return [...malformed, ...issues];
}
