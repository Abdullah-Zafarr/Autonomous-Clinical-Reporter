export interface KeyReportImage {
  id: string;
  dataUrl: string;
  caption: string;
  frameNumber: number;
  createdAt: string;
  createdBy: string;
}

export type CorrectionStatus = "open" | "resolved";

export interface WorksheetCorrection {
  id: string;
  fieldPath: string;
  fieldLabel: string;
  comment: string;
  status: CorrectionStatus;
  requestedBy: string;
  requestedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface CorrectionFieldOption {
  path: string;
  label: string;
  value: string;
}

function titleCase(value: string) {
  const titled = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
  return titled
    .replace(/\bCbd\b/g, "CBD")
    .replace(/\bIvc\b/g, "IVC")
    .replace(/\bMm\b/g, "mm")
    .replace(/\bAp\b/g, "AP");
}

export function worksheetFieldOptions(section: unknown, root: string): CorrectionFieldOption[] {
  const options: CorrectionFieldOption[] = [];
  const visit = (value: unknown, path: string, labels: string[]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`, [...labels, `Item ${index + 1}`]));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        if (key === "id") return;
        visit(child, path ? `${path}.${key}` : key, [...labels, titleCase(key)]);
      });
      return;
    }
    options.push({
      path,
      label: labels.join(" · "),
      value: value === null || value === undefined || value === "" ? "Not entered" : String(value),
    });
  };
  visit(section, root, [titleCase(root)]);
  return options;
}
