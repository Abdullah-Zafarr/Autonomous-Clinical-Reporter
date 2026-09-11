import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getEffectiveOrganizationId } from "@/lib/org-scope";
import { isSchemaCacheError } from "@/lib/supabase-schema-helpers";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRegistered: () => void;
}

type Gender = "Male" | "Female" | "Other";
type Modality = "Ultrasound" | "X-Ray" | "CT";
type ExamOption = "Complete Abdomen" | "Thyroid" | "Pelvic" | "Renal" | "OB" | "Vascular";
type FormErrors = Partial<
  Record<
    | "firstName"
    | "lastName"
    | "dob"
    | "mrn"
    | "medicare"
    | "referring"
    | "providerNumber"
    | "indication",
    string
  >
>;

const generateMrn = () => `MRN-${Math.floor(100000 + Math.random() * 900000)}`;

const modalityCode: Record<Modality, string> = {
  Ultrasound: "US",
  "X-Ray": "XR",
  CT: "CT",
};

export function RegisterPatientDialog({ open, onOpenChange, onRegistered }: Props) {
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [gender, setGender] = useState<Gender | "">("");
  const [autoMrn, setAutoMrn] = useState(true);
  const [mrn, setMrn] = useState("");
  const [medicare, setMedicare] = useState("");

  const [modality, setModality] = useState<Modality>("Ultrasound");
  const [examType, setExamType] = useState<ExamOption>("Complete Abdomen");
  const [referring, setReferring] = useState("");
  const [providerNumber, setProviderNumber] = useState("");
  const [indication, setIndication] = useState("");

  const reset = () => {
    setFirstName("");
    setLastName("");
    setDob(undefined);
    setGender("");
    setAutoMrn(true);
    setMrn("");
    setMedicare("");
    setModality("Ultrasound");
    setExamType("Complete Abdomen");
    setReferring("");
    setProviderNumber("");
    setIndication("");
    setErrors({});
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanMrn = mrn.trim();
    const cleanMedicare = medicare.replace(/\s/g, "");
    const cleanReferring = referring.trim();
    const cleanProvider = providerNumber.trim();
    const cleanIndication = indication.trim();

    if (!cleanFirst) next.firstName = "First name is required.";
    if (!cleanLast) next.lastName = "Last name is required.";
    if (!dob) next.dob = "Date of birth is required.";

    if (!autoMrn && !cleanMrn) {
      next.mrn = "MRN is required when auto-generation is off.";
    } else if (!autoMrn && !/^[-A-Za-z0-9]+$/.test(cleanMrn)) {
      next.mrn = "MRN can only contain letters, numbers, and dashes.";
    }

    if (cleanMedicare && !/^\d{10,11}$/.test(cleanMedicare)) {
      next.medicare = "Medicare number must be 10-11 digits.";
    }

    if (!cleanReferring) next.referring = "Referring physician is required.";
    if (!cleanProvider) next.providerNumber = "Provider number is required.";
    if (!cleanIndication) next.indication = "Clinical indication is required.";

    return next;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix highlighted fields", {
        description: "Both New patient and New study sections must be complete.",
      });
      return;
    }

    const finalMrn = autoMrn || !mrn.trim() ? generateMrn() : mrn.trim();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanMedicare = medicare.replace(/\s/g, "");
    const cleanReferring = referring.trim();
    const cleanProvider = providerNumber.trim();
    const cleanIndication = indication.trim();

    setSaving(true);
    try {
      const organizationId = await getEffectiveOrganizationId();
      if (!organizationId) {
        // Should be unreachable — auto-provision handles this, but guard just in case
        throw new Error("Unable to resolve your organization. Please refresh and try again.");
      }

      const { data: existingPatient } = await (supabase as any)
        .from("patients")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("mrn", finalMrn)
        .maybeSingle();

      if (existingPatient) {
        setErrors((prev) => ({ ...prev, mrn: "This MRN already exists. Use a different MRN or Auto mode." }));
        toast.error("Duplicate MRN", { description: `MRN ${finalMrn} already exists.` });
        return;
      }

      let patientInsert = await (supabase as any)
        .from("patients")
        .insert({
          organization_id: organizationId,
          first_name: cleanFirst,
          last_name: cleanLast,
          dob: format(dob!, "yyyy-MM-dd"),
          mrn: finalMrn,
          gender: gender || null,
          medicare_number: cleanMedicare || null,
        })
        .select()
        .single();

      if (patientInsert.error && isSchemaCacheError(patientInsert.error)) {
        console.warn(
          "[RegisterPatientDialog] Schema cache missing new patient columns (gender/medicare_number). Retrying with base columns."
        );
        patientInsert = await (supabase as any)
          .from("patients")
          .insert({
            organization_id: organizationId,
            first_name: cleanFirst,
            last_name: cleanLast,
            dob: format(dob!, "yyyy-MM-dd"),
            mrn: finalMrn,
          })
          .select()
          .single();
      }

      if (patientInsert.error) throw patientInsert.error;
      const patient = patientInsert.data;

      const accession = `ACC-${finalMrn.replace(/\D/g, "").slice(-6)}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      let studyInsert = await (supabase as any).from("studies").insert({
        organization_id: organizationId,
        patient_id: patient.id,
        modality: modalityCode[modality],
        accession_number: accession,
        description: examType,
        exam_type: examType === "Complete Abdomen" ? "Abdomen" : examType,
        status: "scheduled",
        referring_physician: cleanReferring,
        provider_number: cleanProvider,
        clinical_indication: cleanIndication,
      });

      if (studyInsert.error && isSchemaCacheError(studyInsert.error)) {
        console.warn(
          "[RegisterPatientDialog] Schema cache missing new study columns (referring_physician/provider_number/clinical_indication). Retrying with base columns."
        );
        studyInsert = await (supabase as any).from("studies").insert({
          organization_id: organizationId,
          patient_id: patient.id,
          modality: modalityCode[modality],
          accession_number: accession,
          description: examType,
          exam_type: examType === "Complete Abdomen" ? "Abdomen" : examType,
          status: "scheduled",
        });
      }

      if (studyInsert.error) {
        await supabase.from("patients").delete().eq("id", patient.id);
        throw studyInsert.error;
      }

      toast.success("Patient Registered Successfully", {
        description: `${cleanLast}, ${cleanFirst} - ${finalMrn}`,
      });

      reset();
      onOpenChange(false);
      onRegistered();
    } catch (err: any) {
      console.error("Registration error:", err);
      const msg = err?.message || (err instanceof Error ? err.message : "Failed to register patient");
      toast.error("Registration failed", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Register New Patient & Order Study</DialogTitle>
          <DialogDescription>
            Capture patient demographics and study order. All fields conform to Australian healthcare standards.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Patient Demographics</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">First Name</Label>
                <Input
                  id="fn"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: undefined }));
                  }}
                />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Last Name</Label>
                <Input
                  id="ln"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: undefined }));
                  }}
                />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dob ? format(dob, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dob}
                    onSelect={(value) => {
                      setDob(value);
                      if (errors.dob) setErrors((prev) => ({ ...prev, dob: undefined }));
                    }}
                    disabled={(dateValue) => dateValue > new Date() || dateValue < new Date("1900-01-01")}
                    captionLayout="dropdown"
                    startMonth={new Date(1900, 0)}
                    endMonth={new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {errors.dob && <p className="text-xs text-destructive">{errors.dob}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="mrn">MRN / Medical Record Number</Label>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto</span>
                  <Switch checked={autoMrn} onCheckedChange={setAutoMrn} />
                </div>
              </div>
              <Input
                id="mrn"
                value={autoMrn ? "Auto-generated on save" : mrn}
                onChange={(e) => {
                  setMrn(e.target.value);
                  if (errors.mrn) setErrors((prev) => ({ ...prev, mrn: undefined }));
                }}
                disabled={autoMrn}
                placeholder="MRN-000000"
              />
              {errors.mrn && <p className="text-xs text-destructive">{errors.mrn}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mc">Medicare Number</Label>
              <Input
                id="mc"
                value={medicare}
                onChange={(e) => {
                  setMedicare(e.target.value);
                  if (errors.medicare) setErrors((prev) => ({ ...prev, medicare: undefined }));
                }}
                placeholder="0000 00000 0"
                maxLength={13}
              />
              {errors.medicare && <p className="text-xs text-destructive">{errors.medicare}</p>}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Study / Order Details</h3>

            <div className="space-y-1.5">
              <Label>Modality</Label>
              <Select value={modality} onValueChange={(v) => setModality(v as Modality)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="X-Ray">X-Ray</SelectItem>
                  <SelectItem value="CT">CT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Exam Type</Label>
              <Select value={examType} onValueChange={(v) => setExamType(v as ExamOption)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Complete Abdomen">Complete Abdomen</SelectItem>
                  <SelectItem value="Thyroid">Thyroid</SelectItem>
                  <SelectItem value="Pelvic">Pelvic</SelectItem>
                  <SelectItem value="Renal">Renal</SelectItem>
                  <SelectItem value="OB">OB</SelectItem>
                  <SelectItem value="Vascular">Vascular</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ref">Referring Physician Name</Label>
              <Input
                id="ref"
                value={referring}
                onChange={(e) => {
                  setReferring(e.target.value);
                  if (errors.referring) setErrors((prev) => ({ ...prev, referring: undefined }));
                }}
                placeholder="Dr. Jane Citizen"
              />
              {errors.referring && <p className="text-xs text-destructive">{errors.referring}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pn">Provider Number</Label>
              <Input
                id="pn"
                value={providerNumber}
                onChange={(e) => {
                  setProviderNumber(e.target.value);
                  if (errors.providerNumber) setErrors((prev) => ({ ...prev, providerNumber: undefined }));
                }}
                placeholder="1234567A"
              />
              {errors.providerNumber && <p className="text-xs text-destructive">{errors.providerNumber}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ind">Clinical Indication / Reason for Exam</Label>
              <Textarea
                id="ind"
                value={indication}
                onChange={(e) => {
                  setIndication(e.target.value);
                  if (errors.indication) setErrors((prev) => ({ ...prev, indication: undefined }));
                }}
                placeholder="e.g. RUQ pain, rule out cholelithiasis"
                rows={4}
              />
              {errors.indication && <p className="text-xs text-destructive">{errors.indication}</p>}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save & Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
