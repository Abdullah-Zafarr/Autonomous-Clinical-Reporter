import type { Patient, AbdomenWorksheet, ThyroidWorksheet, ObWorksheet, VascularWorksheet } from "../../src/lib/sonoflow-types";
import { defaultWorksheet, defaultThyroid, defaultOb, defaultVascular } from "../../src/lib/sonoflow-types";

export const mockPatient: Patient = {
  id: "test-patient-001",
  firstName: "Jane",
  lastName: "Doe",
  mrn: "MRN-100293",
  dob: "1988-04-12",
  exam: "Abdomen",
};

export const mockAbdomenWithFindings: AbdomenWorksheet = {
  ...defaultWorksheet,
  liver: {
    ...defaultWorksheet.liver,
    size: "14.5",
    echogenicity: "Mildly increased",
    surface: "Smooth",
    lesions: "None",
  },
  gallbladder: {
    ...defaultWorksheet.gallbladder,
    wallThickness: "2.8",
    calculi: "Absent",
    murphySign: "Negative",
  },
  pancreas: {
    ...defaultWorksheet.pancreas,
    echogenicity: "Normal",
    duct: "1.5",
  },
  spleen: {
    ...defaultWorksheet.spleen,
    length: "10.2",
    echogenicity: "Homogeneous",
  },
  rightKidney: {
    ...defaultWorksheet.rightKidney,
    length: "11.0",
    corticalThickness: "1.6",
    hydronephrosis: "None",
  },
  leftKidney: {
    ...defaultWorksheet.leftKidney,
    length: "11.4",
    corticalThickness: "1.7",
    hydronephrosis: "None",
  },
};

export const mockThyroidWithNodule: ThyroidWorksheet = {
  ...defaultThyroid,
  rightLobe: {
    length: "4.8",
    width: "1.7",
    depth: "1.6",
  },
  leftLobe: {
    length: "4.5",
    width: "1.5",
    depth: "1.4",
  },
  isthmus: "2.4",
  nodules: [
    {
      id: "nodule-1",
      location: "Right mid-pole",
      size: "1.2 x 0.9 x 1.1",
      composition: "Solid",
      echogenicity: "Hypoechoic",
      shape: "Wider-than-tall",
      margin: "Smooth",
      echogenicFoci: "None",
      tirads: "TR4",
    },
  ],
};

export const mockKeyImagePayload = {
  id: "img-capture-001",
  frameIndex: 14,
  caption: "Right thyroid lobe nodule in transverse plane with caliper measurements",
  dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  hasMarkup: true,
};
