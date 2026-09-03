"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { PatientWorklist } from "@/components/sonoflow/PatientWorklist";
import { ClinicalWorksheet } from "@/components/sonoflow/ClinicalWorksheet";
import { ReportPreview } from "@/components/sonoflow/ReportPreview";
import { HL7InspectorDialog } from "@/components/sonoflow/HL7InspectorDialog";
import { StructuredReportDialog } from "@/components/sonoflow/StructuredReportDialog";
import { DicomViewer } from "@/components/sonoflow/DicomViewer";
import { AppNavbar } from "@/components/sonolynx/AppNavbar";
import { DoctorSummary } from "@/components/sonolynx/DoctorSummary";
import { ReportHistory } from "@/components/sonolynx/ReportHistory";
import { SignReportDialog } from "@/components/sonolynx/SignReportDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import dynamic from "next/dynamic";

const ResizablePanelGroup = dynamic(
  () => import("@/components/ui/resizable").then((mod) => mod.ResizablePanelGroup),
  { ssr: false }
);
const ResizablePanel = dynamic(
  () => import("@/components/ui/resizable").then((mod) => mod.ResizablePanel),
  { ssr: false }
);
const ResizableHandle = dynamic(
  () => import("@/components/ui/resizable").then((mod) => mod.ResizableHandle),
  { ssr: false }
);
import { useAuth } from "@/lib/auth-context";
import {
  mockPatients,
  mockPatientCases,
  defaultWorksheet,
  defaultThyroid,
  defaultOb,
  defaultVascular,
  type WorksheetData,
  type ThyroidData,
  type ObData,
  type VascularData,
  type Patient,
  type ExamType,
} from "@/lib/sonoflow-types";
import {
  generateReport,
  generateThyroidReport,
  generateObReport,
  generateVascularReport,
  reportToText,
  buildHL7,
  buildStructuredClinicalReport,
  validateExamWorksheet,
} from "@/lib/report-engine";
import {
  getReportHistory,
  loadWorksheet,
  markWorksheetSigned,
  saveDraftWorksheet,
  updateWorksheetStatus,
  type WorksheetPayload,
  type WorksheetRecord,
} from "@/lib/worksheet-service";
import { enhanceReport } from "@/lib/report-service";
import { transmitHl7 } from "@/lib/hl7-service";
import { writeAuditLog } from "@/lib/audit-service";
import { Monitor, Loader2, PanelLeft, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ReportTemplate, ReportTemplateExamType, ReportBrandingSettings } from "@/lib/report-template-types";
import { getTemplatesByExamType } from "@/lib/report-template-service";
import { renderReportTemplate } from "@/lib/report-template-engine";
import { getBrandingSettings, DEFAULT_BRANDING_SETTINGS } from "@/lib/branding-service";
import { getAvailableTemplatesForTier, shouldShowSonolynxBranding } from "@/lib/template-tier-access";
import { getCurrentUserOrganizationId, getCurrentUserOrganizationTier, type OrganizationTier } from "@/lib/org-scope";

function formatRelative(date: Date | null): string {
  if (!date) return "-";
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 5) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  return date.toLocaleTimeString();
}

function hasPersistedSection(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
}

function examFromLabel(label: string): ExamType {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("thyroid")) return "Thyroid";
  if (normalized.includes("ob")) return "OB";
  if (normalized.includes("vascular")) return "Vascular";
  return "Abdomen";
}

export default function SonolynxApp() {
  const { loading, user, role } = useAuth();

  const router = useRouter();
  
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const initialMockCase = mockPatientCases[0];
  const [patient, setPatient] = useState<Patient>(initialMockCase?.patient ?? mockPatients[0]);
  const [worksheet, setWorksheet] = useState<WorksheetData>(initialMockCase?.worksheet ?? defaultWorksheet);
  const [thyroid, setThyroid] = useState<ThyroidData>(initialMockCase?.thyroid ?? defaultThyroid);
  const [ob, setOb] = useState<ObData>(initialMockCase?.ob ?? defaultOb);
  const [vascular, setVascular] = useState<VascularData>(initialMockCase?.vascular ?? defaultVascular);
  const [exam, setExam] = useState<ExamType>(initialMockCase?.examType ?? "Abdomen");
  const [showDicom, setShowDicom] = useState(false);
  const [showWorklist, setShowWorklist] = useState(false);
  const [hl7Open, setHl7Open] = useState(false);
  const [structuredReportOpen, setStructuredReportOpen] = useState(false);
  const [dialogReportText, setDialogReportText] = useState("");
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [currentWorksheet, setCurrentWorksheet] = useState<WorksheetRecord | null>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [worksheetPanelSize, setWorksheetPanelSize] = useState(40);
  const isCompact = worksheetPanelSize < 38;
  
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(new Date());
  const [worklistRefresh, setWorklistRefresh] = useState(0);
  const [additionalNotes, setAdditionalNotes] = useState(initialMockCase?.notes ?? "");
  const [availableDoctors, setAvailableDoctors] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [abdomenOrder, setAbdomenOrder] = useState<string[]>([]);
  const [sendingToDoctor, setSendingToDoctor] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [brandingSettings, setBrandingSettings] = useState<ReportBrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [templateTier, setTemplateTier] = useState<OrganizationTier>("individual");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUserOrganizationId().then((id) => {
      if (!active) return;
      setOrganizationId(id);
    });
    getCurrentUserOrganizationTier().then((tier) => {
      if (!active) return;
      setTemplateTier(tier);
    });
    return () => {
      active = false;
    };
  }, []);

  // Automatically load the first active real patient and study on login
  useEffect(() => {
    if (!user?.id || loading) return;
    let active = true;

    const loadInitialActiveCase = async () => {
      try {
        const isDoc = role === "doctor" || role === "radiologist";
        if (isDoc) {
          const { data: docStudies, error: docErr } = await (supabase as any)
            .from("studies")
            .select(
              "id, accession_number, assigned_to, description, exam_type, status, patient_id, study_date," +
                "patients:patient_id(id, mrn, first_name, last_name, dob)"
            )
            .eq("assigned_to", user.id)
            .order("study_date", { ascending: false })
            .limit(1);

          if (!docErr && docStudies && docStudies.length > 0 && active) {
            const row = docStudies[0];
            const pat = row.patients ?? {};
            const loadedPatient: Patient = {
              id: pat.id ?? row.patient_id ?? row.id,
              mrn: pat.mrn ?? "—",
              firstName: pat.first_name ?? "",
              lastName: pat.last_name ?? "",
              dob: pat.dob ?? "—",
              exam: row.exam_type || row.description || "Ultrasound",
              studyId: row.id,
              accessionNumber: row.accession_number ?? null,
              studyStatus: row.status ?? null,
            };
            setPatient(loadedPatient);
            setExam(examFromLabel(loadedPatient.exam));
            return;
          }
        }

        // For sonographers / general: load the first patient with studies
        const { data: patientsData, error: patErr } = await (supabase as any)
          .from("patients")
          .select(
            "id, mrn, first_name, last_name, dob, studies(id, accession_number, assigned_to, description, exam_type, status)"
          )
          .order("created_at", { ascending: false })
          .limit(1);

        if (!patErr && patientsData && patientsData.length > 0 && active) {
          const p = patientsData[0];
          const studies: any[] = Array.isArray(p.studies) ? p.studies : [];
          const study = studies[0] ?? null;
          const loadedPatient: Patient = {
            id: p.id,
            mrn: p.mrn,
            firstName: p.first_name,
            lastName: p.last_name,
            dob: p.dob,
            exam: study?.exam_type || study?.description || "Ultrasound",
            studyId: study?.id,
            accessionNumber: study?.accession_number,
            studyStatus: study?.status,
          };
          setPatient(loadedPatient);
          setExam(examFromLabel(loadedPatient.exam));
        }
      } catch (err) {
        console.warn("[app] Initial active patient auto-load notice:", err);
      }
    };

    loadInitialActiveCase();
    return () => {
      active = false;
    };
  }, [user?.id, role, loading]);

  useEffect(() => {
    setLastSaved(new Date());
  }, [worksheet, thyroid, ob, vascular, exam, abdomenOrder]);

  const accession = useMemo(
    () => patient.accessionNumber || `ACC-${patient.mrn.replace(/\D/g, "").slice(-6)}-${new Date().getFullYear()}`,
    [patient],
  );

  const report = useMemo(() => {
    if (exam === "Thyroid") return generateThyroidReport(thyroid);
    if (exam === "OB") return generateObReport(ob);
    if (exam === "Vascular") return generateVascularReport(vascular);
    return generateReport(worksheet, abdomenOrder);
  }, [exam, worksheet, thyroid, ob, vascular, abdomenOrder]);

  const validationIssues = useMemo(() => {
    const data = exam === "Thyroid" ? thyroid : exam === "OB" ? ob : exam === "Vascular" ? vascular : worksheet;
    return validateExamWorksheet(exam, data);
  }, [exam, thyroid, worksheet, ob, vascular]);

  const [editedReportText, setEditedReportText] = useState("");

  const finalReportText = useMemo(() => {
    if (editedReportText) return editedReportText;
    const base = reportToText(report);
    const notes = additionalNotes.trim();
    return notes ? `${base}\n\n**ADDITIONAL NOTES:**\n${notes}` : base;
  }, [report, additionalNotes, editedReportText]);

  const hl7 = useMemo(() => buildHL7(patient, finalReportText, accession, exam), [patient, finalReportText, accession, exam]);

  const structuredReportText = useMemo(
    () =>
      buildStructuredClinicalReport({
        patient,
        accession,
        exam,
        report,
        worksheet,
        thyroid,
        ob,
        vascular,
        additionalNotes,
      }),
    [patient, accession, exam, report, worksheet, thyroid, ob, vascular, additionalNotes],
  );

  const worksheetPayload = useMemo<WorksheetPayload>(
    () => ({ abdomen: worksheet, abdomenOrder, thyroid, ob, vascular, additionalNotes }),
    [worksheet, abdomenOrder, thyroid, ob, vascular, additionalNotes],
  );

  const isAdmin = role === "admin";
  const isDoctorView = role === "doctor" || role === "radiologist" || role === "admin";
  const isSonographerView = role === "sonographer";
  const hasCriticalErrors = validationIssues.some((issue) => issue.level === "error");
  
  // Doctors/Admins sign/finalize. Sonographers can "sign" (which sends to doctor)
  const canSignAndSend = isDoctorView 
    ? !hasCriticalErrors 
    : (isSonographerView && !hasCriticalErrors);

  const canSeeReportHistory = role === "radiologist";
  const canInspectHl7 = isDoctorView;
  const selectedTemplate = useMemo(
    () => availableTemplates.find((item) => item.id === selectedTemplateId) ?? null,
    [availableTemplates, selectedTemplateId],
  );
  const renderedTemplateDocument = useMemo(
    () =>
      renderReportTemplate(
        selectedTemplate,
        {
          patient,
          examType: exam,
          accession,
          report,
          signedBy: user?.email ?? null,
          signedAt: null,
          worksheetSummary: report.findings.slice(0, 3).join(" "),
          studyDate: new Date().toLocaleDateString(),
          referringPhysician: "",
          patientAge: "",
          patientGender: "",
        },
        brandingSettings,
      ),
    [selectedTemplate, patient, exam, accession, report, user?.email, brandingSettings],
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!patient.studyId) {
        setCurrentWorksheet(null);
        return;
      }
      try {
        // For doctors: first read the pinned active_worksheet_id from the study
        // so we load exactly what the sonographer submitted — not just "most recent".
        let activeWorksheetId: string | null = null;
        if (isDoctorView) {
          const { data: studyRow, error: studyErr } = await (supabase as any)
            .from("studies")
            .select("active_worksheet_id")
            .eq("id", patient.studyId)
            .maybeSingle();
          // Column may not exist on older DBs — ignore that specific error
          if (!studyErr) {
            activeWorksheetId = studyRow?.active_worksheet_id ?? null;
          } else {
            console.warn("[worksheet-load] Could not read active_worksheet_id:", studyErr.message);
          }
        }

        const existing = await loadWorksheet(patient.studyId, undefined, activeWorksheetId);
        if (!active) return;
        if (!existing) {
          setEditedReportText("");
          return;
        }
        setCurrentWorksheet(existing);
        console.info(
          "[worksheet-load] Hydrating state from record:",
          existing.id,
          "Type:",
          existing.worksheet_type,
          activeWorksheetId ? "(pinned)" : "(most-recent)"
        );

        // Restore the exam type tab from the saved record
        if (existing.worksheet_type) {
          setExam(existing.worksheet_type as ExamType);
        }

        const payload = existing.data as Partial<WorksheetPayload>;

        console.log("[worksheet-load] Payload extracted:", {
          hasAbdomen: !!payload.abdomen,
          orderLength: payload.abdomenOrder?.length ?? 0,
          notesLength: payload.additionalNotes?.length ?? 0,
        });

        if (hasPersistedSection(payload.abdomen)) setWorksheet(payload.abdomen as unknown as WorksheetData);
        if (payload.abdomenOrder) {
          setAbdomenOrder(payload.abdomenOrder);
        }
        if (hasPersistedSection(payload.thyroid)) setThyroid(payload.thyroid as unknown as ThyroidData);
        if (hasPersistedSection(payload.ob)) setOb(payload.ob as unknown as ObData);
        if (hasPersistedSection(payload.vascular)) setVascular(payload.vascular as unknown as VascularData);
        if (typeof payload.additionalNotes === "string") setAdditionalNotes(payload.additionalNotes);
        setEditedReportText(isDoctorView && existing.report_text ? existing.report_text : "");

        setLastSaved(existing.updated_at ? new Date(existing.updated_at) : new Date());
      } catch (error) {
        console.warn("[worksheet-load] Notice:", (error as any)?.message || error);
        toast.error("Worksheet load notice", {
          description: error instanceof Error ? error.message : "Unable to load worksheet",
        });
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [isDoctorView, patient.studyId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingHistory(true);
      try {
        const history = await getReportHistory(patient.id);
        if (active) setReportHistory(history);
      } catch (error) {
        console.warn("[report-history] Failed to load:", (error as any)?.message || error);
        if (active) setReportHistory([]);
      } finally {
        if (active) setLoadingHistory(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [patient.id, worklistRefresh]);

  useEffect(() => {
    let active = true;
    const loadDoctors = async () => {
      if (!isSonographerView) return;

      // Get the default-org ID so we always show system-level doctors
      const { data: defaultOrg } = await (supabase as any)
        .from("organizations")
        .select("id")
        .eq("code", "default-org")
        .maybeSingle();

      // Build org list: current user's org + default org + null (legacy)
      const orgsToInclude = [...new Set([organizationId, defaultOrg?.id].filter(Boolean))];

      // Fetch doctors from both profiles and user_roles to ensure complete coverage
      const [{ data: profDoctors, error }, { data: roleRows }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id, email, role, organization_id")
          .or("role.eq.doctor,role.eq.radiologist")
          .order("email", { ascending: true }),
        (supabase as any)
          .from("user_roles")
          .select("user_id, role")
          .or("role.eq.doctor,role.eq.radiologist"),
      ]);

      if (error) console.error("[loadDoctors] fetch error:", error);
      if (!active) return;

      const doctorsMap = new Map<string, { id: string; email: string }>();

      (profDoctors ?? []).forEach((row: any) => {
        if (row?.id && row?.email) {
          doctorsMap.set(row.id, { id: row.id, email: row.email });
        }
      });

      const missingUserIds = (roleRows ?? [])
        .map((r: any) => r.user_id)
        .filter((id: string) => id && !doctorsMap.has(id));

      if (missingUserIds.length > 0) {
        const { data: extraProfiles } = await (supabase as any)
          .from("profiles")
          .select("id, email")
          .in("id", missingUserIds);

        (extraProfiles ?? []).forEach((row: any) => {
          if (row?.id && row?.email) {
            doctorsMap.set(row.id, { id: row.id, email: row.email });
          }
        });
      }

      const doctorList = Array.from(doctorsMap.values());
      console.log("[loadDoctors] found", doctorList.length, "total doctors available");
      setAvailableDoctors(doctorList);

      // If only one doctor exists in the clinic, auto-select them
      setSelectedDoctorId((prev) => {
        if (prev && doctorList.some((d) => d.id === prev)) return prev;
        if (doctorList.length === 1) return doctorList[0].id;
        return "";
      });
    };
    loadDoctors();
    return () => {
      active = false;
    };
  }, [isSonographerView, organizationId]);

  useEffect(() => {
    let active = true;
    const loadAssignedDoctor = async () => {
      if (!isSonographerView || !patient.studyId) {
        setSelectedDoctorId("");
        return;
      }
      const { data } = await (supabase as any).from("studies").select("assigned_to").eq("id", patient.studyId).maybeSingle();
      if (!active) return;
      setSelectedDoctorId(data?.assigned_to ?? "");
    };
    loadAssignedDoctor();
    return () => {
      active = false;
    };
  }, [isSonographerView, patient.studyId]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const settings = await getBrandingSettings();
      if (!active) return;
      setBrandingSettings(settings);
    };
    run();
    return () => {
      active = false;
    };
  }, [structuredReportOpen]);

  useEffect(() => {
    const mapExam = (value: ExamType): ReportTemplateExamType => {
      if (value === "Abdomen") return "abdomen";
      if (value === "Thyroid") return "thyroid";
      if (value === "OB") return "ob";
      return "vascular";
    };

    let active = true;
    const run = async () => {
      const byExam = await getTemplatesByExamType(mapExam(exam));
      if (!active) return;
      const templates = getAvailableTemplatesForTier(templateTier, mapExam(exam), byExam);
      
      setAvailableTemplates(templates);
      setSelectedTemplateId((prev) =>
        prev && templates.some((item) => item.id === prev) ? prev : templates[0]?.id ?? "",
      );
    };

    run().catch(() => {
      if (!active) return;
      setAvailableTemplates([]);
      setSelectedTemplateId("");
    });

    return () => {
      active = false;
    };
  }, [exam, templateTier]);

  const handleSelectPatient = (p: Patient) => {
    // Reset to clean defaults immediately so the form is blank while loading
    setWorksheet(defaultWorksheet);
    setThyroid(defaultThyroid);
    setOb(defaultOb);
    setVascular(defaultVascular);
    setAdditionalNotes("");
    setAbdomenOrder([]);
    setCurrentWorksheet(null);
    setEditedReportText("");
    // Set exam type from the study label as a sensible default;
    // the useEffect will override it with the actual saved worksheet_type
    setExam(examFromLabel(p.exam));
    // Set the patient LAST so the studyId change triggers the load useEffect
    setPatient(p);
    setShowWorklist(false);
  };

  const handleSaveDraft = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!user || !patient.studyId) {
      if (!silent) toast.error("Draft save blocked", { description: "Select a study and ensure you are signed in." });
      return null;
    }
    setSavingDraft(true);
    try {
      const saved = await saveDraftWorksheet({
        worksheetId: currentWorksheet?.id,
        patientId: patient.id,
        studyId: patient.studyId,
        userId: user.id,
        worksheetType: exam,
        data: worksheetPayload,
        reportText: finalReportText,
      });
      setCurrentWorksheet(saved);
      setLastSaved(saved.updated_at ? new Date(saved.updated_at) : new Date());
      await writeAuditLog({
        userId: user.id,
        patientId: patient.id,
        studyId: patient.studyId,
        worksheetId: saved.id,
        action: "worksheet_save_draft",
        status: "success",
        metadata: { worksheetType: exam },
      });
      if (!silent) toast.success("Draft saved", { description: `Worksheet for ${patient.lastName}, ${patient.firstName} persisted.` });
      return saved;
    } catch (error: any) {
      const description = error?.message || (typeof error === 'string' ? error : "Unable to save draft");
      if (!silent) toast.error("Draft save failed", { description });
      throw error;
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSign = () => {
    if (isSonographerView) {
      handleSendToDoctor();
      return;
    }
    
    if (!canSignAndSend) {
      toast.error("Signing restricted", { description: "Only doctor, radiologist, or admin roles can sign and send." });
      return;
    }
    if (validationIssues.some((issue) => issue.level === "error")) {
      toast.error("Cannot sign report", { description: "Resolve critical validation issues first." });
      return;
    }
    setSignDialogOpen(true);
  };

  const handleConfirmSignAndSend = async () => {
    if (!user || !patient.studyId) {
      toast.error("Sign/send blocked", { description: "Select a study and ensure you are signed in." });
      return;
    }
    setSendingReport(true);
    try {
      // Prune data to only include the active exam type and selected Abdomen sections
      const isAbdomen = exam === "Abdomen";
      const isThyroid = exam === "Thyroid";
      const isOb = exam === "OB";
      const isVascular = exam === "Vascular";

      const prunedWorksheet = isAbdomen ? { ...worksheet } : ({} as any);
      if (isAbdomen) {
        Object.keys(prunedWorksheet).forEach((key) => {
          if (!abdomenOrder.includes(key)) {
            delete prunedWorksheet[key];
          }
        });
      }

      // Preserve doctor edits if present; otherwise generate enhanced report text
      let reportText = editedReportText.trim();
      if (!reportText) {
        const enhanced = await enhanceReport({
          exam,
          localReport: report,
          worksheet: isAbdomen ? prunedWorksheet : ({} as any),
          thyroid: isThyroid ? thyroid : ({} as any),
          ob: isOb ? ob : ({} as any),
          vascular: isVascular ? vascular : ({} as any),
          additionalNotes,
        });
        if (enhanced.warning) toast.warning("Report notice", { description: enhanced.warning });
        reportText = reportToText(enhanced.report);
      }

      // Finalize the worksheet in Supabase
      let signed: WorksheetRecord;
      if (currentWorksheet?.id) {
        signed = await markWorksheetSigned({
          worksheetId: currentWorksheet.id,
          userId: user.id,
          data: worksheetPayload,
          reportText,
        });
      } else {
        const draft = await saveDraftWorksheet({
          patientId: patient.id!,
          studyId: patient.studyId!,
          userId: user.id,
          worksheetType: exam,
          data: worksheetPayload,
          reportText,
        });
        signed = await markWorksheetSigned({
          worksheetId: draft.id,
          userId: user.id,
          data: worksheetPayload,
          reportText,
        });
      }

      setCurrentWorksheet(signed);

      // Update study status to 'completed'
      if (patient.studyId) {
        try {
          await (supabase as any)
            .from("studies")
            .update({
              status: "completed",
              active_worksheet_id: signed.id,
            })
            .eq("id", patient.studyId);
        } catch (studyErr) {
          console.warn("[finalize] study status update notice:", studyErr);
        }
      }

      // Transmit HL7 and update status
      try {
        const sendResult = await transmitHl7({
          organizationId,
          patientId: patient.id!,
          studyId: patient.studyId!,
          worksheetId: signed.id,
          accessionNumber: accession,
          payload: buildHL7(patient, reportText, accession, exam),
          userId: user.id,
        });

        if (sendResult.ok) {
          await updateWorksheetStatus(signed.id, "transmitted");
          writeAuditLog({
            userId: user.id,
            patientId: patient.id,
            studyId: patient.studyId,
            worksheetId: signed.id,
            hl7MessageId: sendResult.messageId,
            action: "sign_send_hl7",
            status: "sent",
            metadata: { worksheetType: exam, accession },
          });
          toast.success("Report Finalized & Transmitted", {
            description: `ORU^R01 sent for accession ${accession}.`,
          });
        } else {
          writeAuditLog({
            userId: user.id,
            patientId: patient.id,
            studyId: patient.studyId,
            worksheetId: signed.id,
            hl7MessageId: sendResult.messageId,
            action: "sign_send_hl7",
            status: "failed",
            metadata: { worksheetType: exam, accession, error: sendResult.errorMessage },
          });
          toast.success("Report Finalized", {
            description: "Signed successfully. HL7 dispatch queued.",
          });
        }
      } catch (hl7Error: any) {
        console.warn("[finalize] HL7 transmission notice:", hl7Error);
        toast.success("Report Finalized", {
          description: "Signed successfully and locked in record.",
        });
      }

      setSignDialogOpen(false);
      setWorklistRefresh((n) => n + 1);
      if (patient.id) {
        setReportHistory(await getReportHistory(patient.id));
      }
    } catch (error: any) {
      const errMsg = error?.message ?? (typeof error === "string" ? error : null);
      console.error("[sign-and-send] Error:", errMsg ?? JSON.stringify(error));
      toast.error("Failed to finalize report", { description: errMsg ?? "An unexpected error occurred." });
    } finally {
      setSendingReport(false);
    }
  };

  const handleSendToDoctor = async () => {
    if (!isSonographerView) return;
    if (!user) {
      toast.error("Not authenticated", { description: "Please log in and try again." });
      return;
    }
    if (!patient.studyId) {
      toast.error("No study selected", { description: "Select a patient from the Worklist first before sending." });
      return;
    }

    let doctorIdToSend = selectedDoctorId;
    if (!doctorIdToSend) {
      if (availableDoctors.length === 1) {
        doctorIdToSend = availableDoctors[0].id;
        setSelectedDoctorId(doctorIdToSend);
      } else if (availableDoctors.length > 1) {
        toast.warning("Select doctor email", {
          description: "Please choose which doctor to assign this study to from the top bar.",
        });
        return;
      } else {
        toast.error("No doctors found", {
          description: "No doctor accounts available in the directory.",
        });
        return;
      }
    }

    setSendingToDoctor(true);
    try {
      // Save draft first before sending
      const saved = await handleSaveDraft({ silent: true });
      if (!saved) throw new Error("Unable to save the worksheet before assignment.");

      // Update the study: assign to doctor, set status, and pin active worksheet
      const studyUpdate: Record<string, unknown> = {
        assigned_to: doctorIdToSend,
        status: "review_pending",
        active_worksheet_id: saved.id,
      };

      const { error: updateError } = await (supabase as any)
        .from("studies")
        .update(studyUpdate)
        .eq("id", patient.studyId);

      if (updateError) {
        if (
          (updateError.code === "42703" || updateError.code === "PGRST204") &&
          `${updateError?.message ?? ""}`.toLowerCase().includes("active_worksheet_id")
        ) {
          console.warn("[sendToDoctor] active_worksheet_id column missing — retrying without it");
          const { error: retryError } = await (supabase as any)
            .from("studies")
            .update({ assigned_to: doctorIdToSend, status: "review_pending" })
            .eq("id", patient.studyId);
          if (retryError) throw retryError;
        } else {
          throw updateError;
        }
      }

      const doctor = availableDoctors.find((item) => item.id === doctorIdToSend);
      await writeAuditLog({
        userId: user.id,
        patientId: patient.id,
        studyId: patient.studyId,
        worksheetId: saved.id,
        action: "send_to_doctor",
        status: "success",
        metadata: { doctorId: doctorIdToSend, doctorEmail: doctor?.email ?? null },
      });
      toast.success("Sent to Doctor", {
        description: doctor ? `Case assigned to ${doctor.email}.` : "Case assigned to doctor for review.",
      });
      setWorklistRefresh((n) => n + 1);
    } catch (error: any) {
      const errMsg = error?.message ?? (typeof error === "string" ? error : null);
      console.error("[send-to-doctor] Error:", errMsg ?? JSON.stringify(error));
      toast.error("Send failed", { description: errMsg ?? "Unable to assign this case to doctor." });
    } finally {
      setSendingToDoctor(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const gridCols = isDoctorView
    ? "grid-cols-1 lg:grid-cols-[40%_30%_30%]"
    : showDicom
      ? "grid-cols-1 lg:grid-cols-[40%_30%_30%]"
      : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-[58%_42%]";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <AppNavbar onPatientRegistered={() => setWorklistRefresh((n) => n + 1)} />
      <div className="flex min-h-10 shrink-0 items-center gap-3 border-b bg-card px-3 py-1 sm:px-4">
        <Button variant="outline" size="sm" onClick={() => setShowWorklist(true)} className="h-7">
          <PanelLeft className="mr-1.5 h-3.5 w-3.5" />
          Worklist
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => {
            router.push("/");
            toast.info("Clinical Workspace is already active", {
              description: "You are currently viewing the clinical tools.",
              icon: <Activity className="h-4 w-4" />
            });
          }} 
          className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Clinical Workspace
        </Button>
        {!isDoctorView && (
          <div className="ml-auto">
            <Button variant={showDicom ? "default" : "outline"} size="sm" onClick={() => setShowDicom((v) => !v)} className="h-7">
              <Monitor className="mr-1.5 h-3.5 w-3.5" />
              {showDicom ? "Hide DICOM" : "View DICOM Images"}
            </Button>
          </div>
        )}
      </div>

      {isSonographerView && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 sm:px-4">
          <span className="text-xs font-medium text-muted-foreground">Send case to doctor:</span>
          <select
            value={selectedDoctorId}
            onChange={(event) => setSelectedDoctorId(event.target.value)}
            className="h-8 min-w-64 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">Select doctor email</option>
            {availableDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.email}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={handleSendToDoctor} disabled={sendingToDoctor || !selectedDoctorId}>
            {sendingToDoctor ? "Sending..." : "Send to Doctor"}
          </Button>
        </div>
      )}

      {!mounted ? (
        <div className="flex-1 flex items-center justify-center">
          <Activity className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {isSonographerView && (
          <>
            <ResizablePanel 
              defaultSize={40} 
              minSize={30}
              onResize={(size: number) => setWorksheetPanelSize(size)}
            >
              <div className="h-full min-w-0 overflow-hidden">
                <ClinicalWorksheet
                  data={worksheet}
                  onChange={setWorksheet}
                  thyroid={thyroid}
                  onThyroidChange={setThyroid}
                  ob={ob}
                  onObChange={setOb}
                  vascular={vascular}
                  onVascularChange={setVascular}
                  exam={exam}
                  onExamChange={setExam}
                  abdomenOrder={abdomenOrder}
                  onAbdomenOrderChange={setAbdomenOrder}
                  onSaveDraft={handleSaveDraft}
                  onSign={handleSign}
                  onInspectHL7={() => {
                    if (!canInspectHl7) {
                      toast.info("HL7 inspect disabled", {
                        description: "HL7 inspection is available for doctor and radiologist roles.",
                      });
                      return;
                    }
                    setHl7Open(true);
                  }}
                  onGenerateReport={() => {
                    setDialogReportText(structuredReportText);
                    setStructuredReportOpen(true);
                  }}
                  lastSavedLabel={`${formatRelative(lastSaved)}${savingDraft ? " (saving...)" : ""}`}
                  additionalNotes={additionalNotes}
                  onAdditionalNotesChange={setAdditionalNotes}
                  canSignAndSend={canSignAndSend}
                  validationIssues={validationIssues}
                  sendingReport={sendingReport}
                  sendingToDoctor={sendingToDoctor}
                  savingDraft={savingDraft}
                  isDoctorMode={isDoctorView}
                  isCompact={isCompact}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        <ResizablePanel defaultSize={isDoctorView ? 50 : 50} minSize={25}>
          <div className="h-full min-w-0 overflow-hidden border-t lg:border-t-0">
            <ReportPreview
              patient={patient}
              accession={accession}
              report={report}
              additionalNotes={additionalNotes}
              validationIssues={validationIssues}
              onPrint={() => {
                setDialogReportText(structuredReportText);
                setStructuredReportOpen(true);
              }}
              isDoctorMode={isDoctorView}
              editableText={editedReportText || finalReportText}
              hasBeenEdited={!!editedReportText}
              onEditableTextChange={setEditedReportText}
              onSign={() => setSignDialogOpen(true)}
            />
          </div>
        </ResizablePanel>

        {(isDoctorView || showDicom) && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={isDoctorView ? 50 : 40} minSize={20}>
              <div className="h-full min-w-0 overflow-hidden border-t lg:border-t-0">
                <DicomViewer accession={accession} />
              </div>
            </ResizablePanel>
          </>
        )}
        </ResizablePanelGroup>
      )}

      {canSeeReportHistory && (
        <ReportHistory
          patient={patient}
          items={reportHistory}
          loading={loadingHistory}
          onOpen={(text) => {
            setDialogReportText(text);
            setStructuredReportOpen(true);
          }}
        />
      )}

      <Sheet open={showWorklist} onOpenChange={setShowWorklist}>
        <SheetContent side="left" className="h-dvh w-[100vw] max-w-[420px] border-r border-white/20 bg-card/70 p-0 backdrop-blur-xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Worklist and Daily Summary</SheetTitle>
          </SheetHeader>
          <div className="flex h-full min-h-0 flex-col">
            <DoctorSummary />
            <div className="min-h-0 flex-1 overflow-hidden">
              <PatientWorklist selectedId={patient.id} onSelect={handleSelectPatient} refreshKey={worklistRefresh} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <HL7InspectorDialog open={hl7Open} onOpenChange={setHl7Open} hl7={hl7} />
      <SignReportDialog
        open={signDialogOpen}
        onOpenChange={setSignDialogOpen}
        patient={patient}
        exam={exam}
        accession={accession}
        issues={validationIssues}
        busy={sendingReport}
        onConfirm={handleConfirmSignAndSend}
      />
      <StructuredReportDialog
        open={structuredReportOpen}
        onOpenChange={setStructuredReportOpen}
        baseReportText={dialogReportText || structuredReportText}
        templates={availableTemplates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        renderedDocument={renderedTemplateDocument}
        tier={templateTier}
        branding={brandingSettings}
      />
      <Toaster richColors position="top-right" closeButton duration={3000} />
    </div>
  );
}
