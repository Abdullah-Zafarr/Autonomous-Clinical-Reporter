import { z } from "zod";

const text = z.string().max(5000);
const measurement = z.union([z.string().max(40), z.number().finite()]).transform(String).refine((value) => !value.trim() || Number.isFinite(Number(value)));
const dimensions = z.object({ length: measurement, width: measurement, depth: measurement }).partial();
const nodule = z.object({
  id: z.string().optional().default(() => crypto.randomUUID()),
  location: z.enum(["Right", "Left", "Isthmus"]), size: measurement,
  composition: z.enum(["Solid", "Cystic", "Mixed"]),
  echogenicity: z.enum(["Anechoic", "Hyperechoic/Isoechoic", "Hypoechoic", "Very hypoechoic"]),
  shape: z.enum(["Wider-than-tall", "Taller-than-wide"]),
  margin: z.enum(["Smooth", "Ill-defined", "Lobulated/Irregular", "Extrathyroidal extension"]),
  echogenicFoci: z.enum(["None", "Comet-tail artifacts", "Macrocalcifications", "Peripheral rim calcifications", "Punctate echogenic foci"]),
  tirads: z.enum(["TR1", "TR2", "TR3", "TR4", "TR5"]),
});

export const extractionSchema = z.object({
  abdomen: z.object({
    liver: z.object({ size: measurement, echotexture: z.enum(["Homogeneous", "Diffusely echogenic (fatty infiltration)", "Coarse"]), surface: z.enum(["Smooth", "Nodular"]), focalLesions: z.enum(["None", "Cyst", "Solid Mass"]) }).partial().optional(),
    gallbladder: z.object({ wallThickness: measurement, content: z.enum(["Clear", "Sludge", "Gallstones"]), murphysSign: z.enum(["Negative", "Positive"]) }).partial().optional(),
    biliary: z.object({ cbd: measurement, intrahepatic: z.enum(["Normal", "Dilated"]) }).partial().optional(),
    kidneys: z.object({ rightLength: measurement, leftLength: measurement, corticalEchogenicity: z.enum(["Normal", "Increased"]), hydronephrosis: z.enum(["None", "Mild", "Moderate", "Severe"]), stones: z.enum(["None", "Right", "Left", "Bilateral"]) }).partial().optional(),
    spleen: z.object({ size: measurement, echotexture: z.enum(["Normal", "Heterogeneous"]) }).partial().optional(),
    pancreas: z.object({ visualized: z.enum(["Fully visualized", "Partially visualized", "Obscured by bowel gas"]), echotexture: z.enum(["Normal", "Hypoechoic", "Hyperechoic", "Heterogeneous"]), ductMm: measurement }).partial().optional(),
    vessels: z.object({ portalVeinMm: measurement, aortaState: z.enum(["Normal", "Ectatic", "Aneurysmal"]), aortaMaxApCm: measurement, ivcState: z.enum(["Normal", "Dilated"]) }).partial().optional(),
    ascites: z.object({ volume: z.enum(["None", "Mild", "Moderate", "Large"]) }).partial().optional(),
  }).strict().optional(),
  thyroid: z.object({ rightLobe: dimensions, leftLobe: dimensions, isthmus: measurement, parenchyma: z.enum(["Homogeneous", "Mildly heterogeneous", "Markedly heterogeneous"]), vascularity: z.enum(["Normal", "Increased"]), cervicalNodes: z.enum(["None suspicious", "Suspicious right", "Suspicious left", "Suspicious bilateral"]), nodules: z.array(nodule).max(50) }).partial().optional(),
  ob: z.object({ gestationalAge: text, fetalHeartRate: measurement, presentation: z.enum(["Cephalic", "Breech", "Transverse", "Variable"]), placentaLocation: z.enum(["Anterior", "Posterior", "Fundal", "Low-lying", "Previa"]), amnioticFluid: z.enum(["Normal", "Reduced", "Increased"]), biometryNotes: text, impression: text }).partial().optional(),
  vascular: z.object({ vesselExamined: text, laterality: z.enum(["Right", "Left", "Bilateral", "Midline"]), flowPatency: z.enum(["Patent", "Partially occluded", "Occluded"]), stenosisFindings: text, thrombusPresence: z.enum(["Absent", "Present", "Indeterminate"]), waveformNotes: text, impression: text }).partial().optional(),
  additionalNotes: text.optional(),
}).strict();
