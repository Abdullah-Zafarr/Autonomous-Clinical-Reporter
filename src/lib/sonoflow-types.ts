export type FocalLesion = "None" | "Cyst" | "Solid Mass";
export type LiverEcho = "Homogeneous" | "Diffusely echogenic (fatty infiltration)" | "Coarse";
export type LiverSurface = "Smooth" | "Nodular";
export type GbContent = "Clear" | "Sludge" | "Gallstones";
export type MurphysSign = "Negative" | "Positive";
export type DuctState = "Normal" | "Dilated";
export type Hydronephrosis = "None" | "Mild" | "Moderate" | "Severe";
export type KidneyEcho = "Normal" | "Increased";
export type RenalStone = "None" | "Right" | "Left" | "Bilateral";
export type PancreasVisualized = "Fully visualized" | "Partially visualized" | "Obscured by bowel gas";
export type PancreasEcho = "Normal" | "Hypoechoic" | "Hyperechoic" | "Heterogeneous";
export type SpleenEcho = "Normal" | "Heterogeneous";
export type Ascites = "None" | "Mild" | "Moderate" | "Large";
export type AortaState = "Normal" | "Ectatic" | "Aneurysmal";
export type IvcState = "Normal" | "Dilated";

export type NoduleLocation = "Right" | "Left" | "Isthmus";
export type NoduleComposition = "Solid" | "Cystic" | "Mixed";
export type TiRads = "TR1" | "TR2" | "TR3" | "TR4" | "TR5";
export type NoduleEchogenicity = "Anechoic" | "Hyperechoic/Isoechoic" | "Hypoechoic" | "Very hypoechoic";
export type NoduleShape = "Wider-than-tall" | "Taller-than-wide";
export type NoduleMargin = "Smooth" | "Ill-defined" | "Lobulated/Irregular" | "Extrathyroidal extension";
export type NoduleEchogenicFoci =
  | "None"
  | "Comet-tail artifacts"
  | "Macrocalcifications"
  | "Peripheral rim calcifications"
  | "Punctate echogenic foci";
export type ThyroidParenchyma = "Homogeneous" | "Mildly heterogeneous" | "Markedly heterogeneous";
export type ThyroidVascularity = "Normal" | "Increased";
export type CervicalNode = "None suspicious" | "Suspicious right" | "Suspicious left" | "Suspicious bilateral";

export interface ThyroidNodule {
  id: string;
  location: NoduleLocation;
  size: string;
  composition: NoduleComposition;
  echogenicity: NoduleEchogenicity;
  shape: NoduleShape;
  margin: NoduleMargin;
  echogenicFoci: NoduleEchogenicFoci;
  tirads: TiRads;
}

export interface LobeDimensions {
  length: string;
  width: string;
  depth: string;
}

export interface ThyroidData {
  rightLobe: LobeDimensions;
  leftLobe: LobeDimensions;
  isthmus: string;
  parenchyma: ThyroidParenchyma;
  vascularity: ThyroidVascularity;
  cervicalNodes: CervicalNode;
  nodules: ThyroidNodule[];
}

export interface WorksheetData {
  liver: {
    size: string;
    echotexture: LiverEcho;
    surface: LiverSurface;
    focalLesions: FocalLesion;
  };
  gallbladder: {
    wallThickness: string;
    content: GbContent;
    murphysSign: MurphysSign;
  };
  biliary: {
    cbd: string;
    intrahepatic: DuctState;
  };
  kidneys: {
    rightLength: string;
    leftLength: string;
    corticalEchogenicity: KidneyEcho;
    hydronephrosis: Hydronephrosis;
    stones: RenalStone;
  };
  spleen: {
    size: string;
    echotexture: SpleenEcho;
  };
  pancreas: {
    visualized: PancreasVisualized;
    echotexture: PancreasEcho;
    ductMm: string;
  };
  vessels: {
    portalVeinMm: string;
    aortaState: AortaState;
    aortaMaxApCm: string;
    ivcState: IvcState;
  };
  ascites: {
    volume: Ascites;
  };
}

export interface ObData {
  gestationalAge: string;
  fetalHeartRate: string;
  presentation: "Cephalic" | "Breech" | "Transverse" | "Variable";
  placentaLocation: "Anterior" | "Posterior" | "Fundal" | "Low-lying" | "Previa";
  amnioticFluid: "Normal" | "Reduced" | "Increased";
  biometryNotes: string;
  impression: string;
}

export interface VascularData {
  vesselExamined: string;
  laterality: "Right" | "Left" | "Bilateral" | "Midline";
  flowPatency: "Patent" | "Partially occluded" | "Occluded";
  stenosisFindings: string;
  thrombusPresence: "Absent" | "Present" | "Indeterminate";
  waveformNotes: string;
  impression: string;
}

export type ExamType = "Abdomen" | "Thyroid" | "OB" | "Vascular";

export const defaultWorksheet: WorksheetData = {
  liver: { size: "", echotexture: "Homogeneous", surface: "Smooth", focalLesions: "None" },
  gallbladder: { wallThickness: "", content: "Clear", murphysSign: "Negative" },
  biliary: { cbd: "", intrahepatic: "Normal" },
  kidneys: {
    rightLength: "",
    leftLength: "",
    corticalEchogenicity: "Normal",
    hydronephrosis: "None",
    stones: "None",
  },
  spleen: { size: "", echotexture: "Normal" },
  pancreas: { visualized: "Fully visualized", echotexture: "Normal", ductMm: "" },
  vessels: { portalVeinMm: "", aortaState: "Normal", aortaMaxApCm: "", ivcState: "Normal" },
  ascites: { volume: "None" },
};

export const defaultThyroid: ThyroidData = {
  rightLobe: { length: "", width: "", depth: "" },
  leftLobe: { length: "", width: "", depth: "" },
  isthmus: "",
  parenchyma: "Homogeneous",
  vascularity: "Normal",
  cervicalNodes: "None suspicious",
  nodules: [],
};

export const defaultOb: ObData = {
  gestationalAge: "",
  fetalHeartRate: "",
  presentation: "Cephalic",
  placentaLocation: "Anterior",
  amnioticFluid: "Normal",
  biometryNotes: "",
  impression: "",
};

export const defaultVascular: VascularData = {
  vesselExamined: "",
  laterality: "Right",
  flowPatency: "Patent",
  stenosisFindings: "",
  thrombusPresence: "Absent",
  waveformNotes: "",
  impression: "",
};

export interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dob: string;
  exam: string;
  studyId?: string;
  accessionNumber?: string;
  studyStatus?: string;
}

export interface MockPatientCase {
  patient: Patient;
  examType: ExamType;
  worksheet: WorksheetData;
  thyroid: ThyroidData;
  ob: ObData;
  vascular: VascularData;
  notes: string;
  abdomenOrder: string[];
}

function createSeededRandom(seed = 20260506) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)];
}

function num(rng: () => number, min: number, max: number, decimals = 1): string {
  const factor = Math.pow(10, decimals);
  const value = Math.round((min + rng() * (max - min)) * factor) / factor;
  return String(value);
}

function makeDob(rng: () => number): string {
  const year = Math.floor(1940 + rng() * 55);
  const month = Math.floor(1 + rng() * 12);
  const day = Math.floor(1 + rng() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function randomAbdomenCase(rng: () => number): WorksheetData {
  return {
    liver: {
      size: num(rng, 12, 21),
      echotexture: pick(rng, ["Homogeneous", "Diffusely echogenic (fatty infiltration)", "Coarse"] as const),
      surface: pick(rng, ["Smooth", "Nodular"] as const),
      focalLesions: pick(rng, ["None", "Cyst", "Solid Mass"] as const),
    },
    gallbladder: {
      wallThickness: num(rng, 1.8, 6.2),
      content: pick(rng, ["Clear", "Sludge", "Gallstones"] as const),
      murphysSign: pick(rng, ["Negative", "Positive"] as const),
    },
    biliary: {
      cbd: num(rng, 3.0, 12.0),
      intrahepatic: pick(rng, ["Normal", "Dilated"] as const),
    },
    kidneys: {
      rightLength: num(rng, 8.4, 13.8),
      leftLength: num(rng, 8.3, 13.9),
      corticalEchogenicity: pick(rng, ["Normal", "Increased"] as const),
      hydronephrosis: pick(rng, ["None", "Mild", "Moderate", "Severe"] as const),
      stones: pick(rng, ["None", "Right", "Left", "Bilateral"] as const),
    },
    spleen: {
      size: num(rng, 9.0, 16.5),
      echotexture: pick(rng, ["Normal", "Heterogeneous"] as const),
    },
    pancreas: {
      visualized: pick(rng, ["Fully visualized", "Partially visualized", "Obscured by bowel gas"] as const),
      echotexture: pick(rng, ["Normal", "Hypoechoic", "Hyperechoic", "Heterogeneous"] as const),
      ductMm: num(rng, 1.2, 5.2),
    },
    vessels: {
      portalVeinMm: num(rng, 8.0, 15.5),
      aortaState: pick(rng, ["Normal", "Ectatic", "Aneurysmal"] as const),
      aortaMaxApCm: num(rng, 1.6, 4.3),
      ivcState: pick(rng, ["Normal", "Dilated"] as const),
    },
    ascites: {
      volume: pick(rng, ["None", "Mild", "Moderate", "Large"] as const),
    },
  };
}

function randomThyroidCase(rng: () => number): ThyroidData {
  const nodulesCount = Math.floor(rng() * 3);
  const nodules: ThyroidNodule[] = Array.from({ length: nodulesCount }, (_, idx) => ({
    id: `rnd-n-${idx + 1}`,
    location: pick(rng, ["Right", "Left", "Isthmus"] as const),
    size: num(rng, 0.4, 3.8),
    composition: pick(rng, ["Solid", "Cystic", "Mixed"] as const),
    echogenicity: pick(rng, ["Anechoic", "Hyperechoic/Isoechoic", "Hypoechoic", "Very hypoechoic"] as const),
    shape: pick(rng, ["Wider-than-tall", "Taller-than-wide"] as const),
    margin: pick(rng, ["Smooth", "Ill-defined", "Lobulated/Irregular", "Extrathyroidal extension"] as const),
    echogenicFoci: pick(
      rng,
      ["None", "Comet-tail artifacts", "Macrocalcifications", "Peripheral rim calcifications", "Punctate echogenic foci"] as const,
    ),
    tirads: pick(rng, ["TR1", "TR2", "TR3", "TR4", "TR5"] as const),
  }));

  return {
    rightLobe: { length: num(rng, 3.2, 6.2), width: num(rng, 1.1, 2.8), depth: num(rng, 1.0, 2.7) },
    leftLobe: { length: num(rng, 3.0, 6.0), width: num(rng, 1.1, 2.7), depth: num(rng, 1.0, 2.6) },
    isthmus: num(rng, 1.2, 6.0),
    parenchyma: pick(rng, ["Homogeneous", "Mildly heterogeneous", "Markedly heterogeneous"] as const),
    vascularity: pick(rng, ["Normal", "Increased"] as const),
    cervicalNodes: pick(rng, ["None suspicious", "Suspicious right", "Suspicious left", "Suspicious bilateral"] as const),
    nodules,
  };
}

function buildMockPatientCases(): MockPatientCase[] {
  const rng = createSeededRandom();
  const firstNames = [
    "Ayesha", "Liam", "Noah", "Emma", "Olivia", "Mason", "Sophia", "Ethan", "Mia", "Amelia",
    "Aria", "James", "Logan", "Ava", "Isabella", "Lucas", "Harper", "Elijah", "Evelyn", "Zara",
  ];
  const lastNames = [
    "Khan", "Patel", "Smith", "Johnson", "Brown", "Davis", "Wilson", "Clark", "Lewis", "Walker",
    "Young", "Hall", "Allen", "Wright", "King", "Scott", "Green", "Baker", "Adams", "Nelson",
  ];
  const notes = [
    "Correlate with LFT and clinical exam.",
    "Follow-up suggested if symptoms persist.",
    "Compare with prior imaging when available.",
    "Clinical correlation advised.",
  ];

  return Array.from({ length: 20 }, (_, idx) => {
    const examType: ExamType = rng() < 0.65 ? "Abdomen" : "Thyroid";
    const firstName = pick(rng, firstNames);
    const lastName = pick(rng, lastNames);
    const patient: Patient = {
      id: `00000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`,
      mrn: `MRN-${String(100000 + Math.floor(rng() * 899999))}`,
      firstName,
      lastName,
      dob: makeDob(rng),
      exam: examType === "Thyroid" ? "Thyroid US" : "Complete Abdomen US",
      studyId: `00000000-0000-0000-0001-${String(idx + 1).padStart(12, '0')}`,
      accessionNumber: `ACC-MOCK-${String(1000 + idx)}`,
    };
    return {
      patient,
      examType,
      worksheet: { ...defaultWorksheet },
      thyroid: { ...defaultThyroid },
      ob: { ...defaultOb },
      vascular: { ...defaultVascular },
      notes: "",
      abdomenOrder: [],
    };
  });
}

export const mockPatientCases: MockPatientCase[] = buildMockPatientCases();
export const mockPatients: Patient[] = mockPatientCases.map((entry) => entry.patient);
