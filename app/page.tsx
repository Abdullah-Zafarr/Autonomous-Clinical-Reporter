"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { WorkflowProgress } from "@/components/sonolynx/WorkflowProgress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/hooks/use-mobile";

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
  updateWorksheetReview,
  type WorksheetPayload,
  type WorksheetRecord,
} from "@/lib/worksheet-service";
import {
  worksheetFieldOptions,
  type KeyReportImage,
  type WorksheetCorrection,
} from "@/lib/clinical-workflow-types";
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

const demoDataEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";
const emptyPatient: Patient = {
  id: "",
  mrn: "—",
  firstName: "",
  lastName: "",
  dob: "—",
  exam: "Ultrasound",
};

export default function SonolynxApp() {
  const { loading, user, role } = useAuth();

  const router = useRouter();
  const isMobile = useIsMobile();
  
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  const initialMockCase = mockPatientCases[0];
  const [patient, setPatient] = useState<Patient>(demoDataEnabled ? (initialMockCase?.patient ?? mockPatients[0]) : emptyPatient);
  const [worksheet, setWorksheet] = useState<WorksheetData>(defaultWorksheet);
  const [thyroid, setThyroid] = useState<ThyroidData>(defaultThyroid);
  const [ob, setOb] = useState<ObData>(defaultOb);
  const [vascular, setVascular] = useState<VascularData>(defaultVascular);
  const [exam, setExam] = useState<ExamType>("Abdomen");
  const [showDicom, setShowDicom] = useState(false);
  const [showWorklist, setShowWorklist] = useState(false);
  const [hl7Open, setHl7Open] = useState(false);
  const [structuredReportOpen, setStructuredReportOpen] = useState(false);
  const [dialogReportText, setDialogReportText] = useState("");
  const [dialogExactText, setDialogExactText] = useState(false);
  const [dialogKeyImages, setDialogKeyImages] = useState<KeyReportImage[]>([]);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [currentWorksheet, setCurrentWorksheet] = useState<WorksheetRecord | null>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [worksheetPanelSize, setWorksheetPanelSize] = useState(40);
  const isCompact = worksheetPanelSize < 38;
  
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loadingWorksheet, setLoadingWorksheet] = useState(false);
  const [worksheetLoadError, setWorksheetLoadError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const draftVersion = useRef(0);
  const [isDirty, setIsDirty] = useState(false);
  const isInitialMount = useRef(true);
  const initialCaseLoadedForUser = useRef<string | null>(null);
  const [worklistRefresh, setWorklistRefresh] = useState(0);
  const [editedReportText, setEditedReportText] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [availableDoctors, setAvailableDoctors] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [abdomenOrder, setAbdomenOrder] = useState<string[]>([]);
  const [sendingToDoctor, setSendingToDoctor] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [brandingSettings, setBrandingSettings] = useState<ReportBrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [templateTier, setTemplateTier] = useState<OrganizationTier>("individual");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [keyImages, setKeyImages] = useState<KeyReportImage[]>([]);
  const [corrections, setCorrections] = useState<WorksheetCorrection[]>([]);
  const [returningForCorrection, setReturningForCorrection] = useState(false);
  const [, forceTick] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    if (loading || !user?.id) return;
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
  }, [loading, user?.id]);

  // Automatically load the first active real patient and study on login
  useEffect(() => {
    if (!user?.id || loading) return;
    if (initialCaseLoadedForUser.current === user.id) return;
    initialCaseLoadedForUser.current = user.id;
    let active = true;

    const loadInitialActiveCase = async () => {
      try {
        const currentOrganizationId = await getCurrentUserOrganizationId();
        // Never auto-load an unscoped patient/study. A missing organisation
        // link must be repaired by an administrator before clinical data is
        // shown.
        if (!currentOrganizationId) return;

        const isDoc = role === "doctor" || role === "radiologist";
        if (isDoc) {
          const { data: docStudies, error: docErr } = await (supabase as any)
            .from("studies")
            .select(
              "id, accession_number, assigned_to, description, exam_type, status, patient_id, study_date," +
                "patients:patient_id(id, mrn, first_name, last_name, dob)"
            )
            .eq("assigned_to", user.id)
            .eq("organization_id", currentOrganizationId)
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
          .eq("organization_id", currentOrganizationId)
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
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setIsDirty(true);
    draftVersion.current += 1;
  }, [worksheet, thyroid, ob, vascular, exam, abdomenOrder, additionalNotes, editedReportText, keyImages, corrections]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

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

  const finalReportText = useMemo(() => {
    if (editedReportText !== null) return editedReportText;
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
    () => ({ abdomen: worksheet, abdomenOrder, thyroid, ob, vascular, additionalNotes, keyImages, corrections }),
    [worksheet, abdomenOrder, thyroid, ob, vascular, additionalNotes, keyImages, corrections],
  );

  const correctionFields = useMemo(() => {
    const section = exam === "Thyroid" ? thyroid : exam === "OB" ? ob : exam === "Vascular" ? vascular : worksheet;
    return worksheetFieldOptions(section, exam.toLowerCase());
  }, [exam, worksheet, thyroid, ob, vascular]);

  const isAdmin = role === "admin";
  const isDoctorView = role === "doctor" || role === "radiologist" || role === "admin";
  const isSonographerView = role === "sonographer";
  const hasCriticalErrors = validationIssues.some((issue) => issue.level === "error");
  
  // Doctors/Admins sign/finalize. Sonographers can "sign" (which sends to doctor)
  const canSignAndSend = isDoctorView 
    ? !hasCriticalErrors 
    : (isSonographerView && !hasCriticalErrors);

  const canSeeReportHistory = isDoctorView;
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
          additionalNotes,
          signedBy: currentWorksheet?.signed_by ?? null,
          signedAt: currentWorksheet?.signed_at ?? null,
          worksheetSummary: report.findings.slice(0, 3).join(" "),
          studyDate: new Date().toLocaleDateString(),
          referringPhysician: "",
          patientAge: "",
          patientGender: "",
        },
        brandingSettings,
      ),
    [selectedTemplate, patient, exam, accession, report, additionalNotes, currentWorksheet?.signed_by, currentWorksheet?.signed_at, brandingSettings],
  );

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadingWorksheet(true);
      setWorksheetLoadError(false);
      setLastSaved(null);
      if (!patient.studyId) {
        setCurrentWorksheet(null);
        setLoadingWorksheet(false);
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
          isInitialMount.current = true;
          setCurrentWorksheet(null);
          setWorksheet(defaultWorksheet);
          setThyroid(defaultThyroid);
          setOb(defaultOb);
          setVascular(defaultVascular);
          setAbdomenOrder([]);
          setAdditionalNotes("");
          setKeyImages([]);
          setCorrections([]);
          setEditedReportText(null);
          setIsDirty(false);
          return;
        }
        isInitialMount.current = true;
        setIsDirty(false);
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

        setWorksheet(hasPersistedSection(payload.abdomen) ? payload.abdomen as unknown as WorksheetData : defaultWorksheet);
        if (payload.abdomenOrder) {
          setAbdomenOrder(payload.abdomenOrder);
        }
        setThyroid(hasPersistedSection(payload.thyroid) ? payload.thyroid as unknown as ThyroidData : defaultThyroid);
        setOb(hasPersistedSection(payload.ob) ? payload.ob as unknown as ObData : defaultOb);
        setVascular(hasPersistedSection(payload.vascular) ? payload.vascular as unknown as VascularData : defaultVascular);
        if (typeof payload.additionalNotes === "string") setAdditionalNotes(payload.additionalNotes);
        setKeyImages(Array.isArray(payload.keyImages) ? payload.keyImages : []);
        setCorrections(Array.isArray(payload.corrections) ? payload.corrections : []);
        setEditedReportText(isDoctorView && existing.report_text ? existing.report_text : null);

        setLastSaved(existing.updated_at ? new Date(existing.updated_at) : new Date());
      } catch (error) {
        if (!active) return;
        setWorksheetLoadError(true);
        console.warn("[worksheet-load] Notice:", (error as any)?.message || error);
        toast.error("Worksheet load notice", {
          description: error instanceof Error ? error.message : "Unable to load worksheet",
        });
      } finally {
        if (active) setLoadingWorksheet(false);
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
      if (!organizationId) {
        setAvailableDoctors([]);
        setSelectedDoctorId("");
        return;
      }

      // Profiles are the tenant boundary. Resolve the role table only for
      // those profiles so a doctor from another clinic can never be assigned.
      const [{ data: clinicProfiles, error }, { data: roleRows }] = await Promise.all([
        (supabase as any)
          .from("profiles")
          .select("id, email, role, organization_id")
          .eq("organization_id", organizationId)
          .order("email", { ascending: true }),
        (supabase as any)
          .from("user_roles")
          .select("user_id, role")
          .or("role.eq.doctor,role.eq.radiologist"),
      ]);

      if (error) console.error("[loadDoctors] fetch error:", error);
      if (!active) return;

      const clinicProfileIds = new Set((clinicProfiles ?? []).map((row: any) => row.id));
      const roleMap = new Map<string, string>();
      (roleRows ?? []).forEach((row: any) => {
        if (clinicProfileIds.has(row?.user_id) && (row.role === "doctor" || row.role === "radiologist")) {
          roleMap.set(row.user_id, row.role);
        }
      });

      const doctorsMap = new Map<string, { id: string; email: string }>();

      (clinicProfiles ?? []).forEach((row: any) => {
        const resolvedRole = row?.role || roleMap.get(row?.id);
        if (row?.id && row?.email && (resolvedRole === "doctor" || resolvedRole === "radiologist")) {
          doctorsMap.set(row.id, { id: row.id, email: row.email });
        }
      });

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
      if (!organizationId) {
        setSelectedDoctorId("");
        return;
      }
      const { data } = await (supabase as any)
        .from("studies")
        .select("assigned_to")
        .eq("id", patient.studyId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (!active) return;
      setSelectedDoctorId(data?.assigned_to ?? "");
    };
    loadAssignedDoctor();
    return () => {
      active = false;
    };
  }, [isSonographerView, patient.studyId, organizationId]);

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
    if (p.id === patient.id && p.studyId === patient.studyId && !worksheetLoadError) {
      setShowWorklist(false);
      return;
    }
    if (savingDraft || sendingToDoctor || sendingReport || returningForCorrection) {
      toast.info("Please wait for the current save or send to finish.");
      return;
    }
    if (isDirty && !window.confirm("Discard unsaved changes and open another case?")) return;
    isInitialMount.current = true;
    setIsDirty(false);
    // Reset to clean defaults immediately so the form is blank while loading
    setWorksheet(defaultWorksheet);
    setThyroid(defaultThyroid);
    setOb(defaultOb);
    setVascular(defaultVascular);
    setAdditionalNotes("");
    setKeyImages([]);
    setCorrections([]);
    setAbdomenOrder([]);
    setCurrentWorksheet(null);
    setEditedReportText(null);
    setLastSaved(null);
    setWorksheetLoadError(false);
    setLoadingWorksheet(!!p.studyId);
    // Set exam type from the study label as a sensible default;
    // the useEffect will override it with the actual saved worksheet_type
    setExam(examFromLabel(p.exam));
    // Set the patient LAST so the studyId change triggers the load useEffect
    setPatient(p);
    setShowWorklist(false);
  };

  const handleSaveDraft = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (loadingWorksheet || worksheetLoadError || savingDraft || sendingReport || returningForCorrection) {
      if (!silent) toast.info("Wait for the case to finish loading or saving before making another save.");
      return null;
    }
    if (!user || !patient.studyId) {
      if (!silent) toast.error("Draft save blocked", { description: "Select a study and ensure you are signed in." });
      return null;
    }
    setSavingDraft(true);
    const savingVersion = draftVersion.current;
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
      if (saved.id !== currentWorksheet?.id) {
        const { error: pinError } = await (supabase as any).from("studies")
          .update({ active_worksheet_id: saved.id }).eq("id", patient.studyId).eq("organization_id", organizationId);
        if (pinError) throw pinError;
      }
      setCurrentWorksheet(saved);
      setLastSaved(saved.updated_at ? new Date(saved.updated_at) : new Date());
      setIsDirty(draftVersion.current !== savingVersion);
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
      if (silent) throw error;
      return null;
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSign = () => {
    if (loadingWorksheet || worksheetLoadError || savingDraft || sendingReport || returningForCorrection) return;
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
    if (sendingReport || savingDraft || loadingWorksheet || worksheetLoadError || returningForCorrection) return;
    if (!isDoctorView || hasCriticalErrors || !finalReportText.trim() || (!report.findings.length && !editedReportText?.trim() && !additionalNotes.trim())) {
      toast.error("Cannot sign report", { description: "A clinician must review a nonempty report and resolve blocking issues first." });
      return;
    }
    if (patient.studyStatus === "correction_requested" || corrections.some((item) => item.status === "open")) {
      toast.warning("Correction review still open", {
        description: "Wait for the sonographer to resolve and resubmit every requested field before signing.",
      });
      return;
    }
    if (!user || !patient.studyId) {
      toast.error("Sign/send blocked", { description: "Select a study and ensure you are signed in." });
      return;
    }
    setSendingReport(true);
    try {
      // Sign exactly the report the clinician reviewed, including additional notes.
      // AI wording changes are previewed and applied through the report tools first.
      const reportText = finalReportText;

      // Finalize the worksheet in Supabase
      let signed: WorksheetRecord;
      if (currentWorksheet?.id && !currentWorksheet.signed_at && !currentWorksheet.signed_by) {
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
      isInitialMount.current = true;
      setEditedReportText(reportText);
      setIsDirty(false);

      // Update study status to 'completed'
      if (patient.studyId) {
        try {
          const { error: studyUpdateError } = await (supabase as any)
            .from("studies")
            .update({
              status: "completed",
              active_worksheet_id: signed.id,
            })
            .eq("id", patient.studyId)
            .eq("organization_id", organizationId);
          if (studyUpdateError) throw studyUpdateError;
          setPatient((current) => ({ ...current, studyStatus: "completed" }));
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
          const transmitted = await updateWorksheetStatus(signed.id, "transmitted");
          setCurrentWorksheet(transmitted);
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
          toast.success(sendResult.demo ? "Report finalized · Demo delivery" : "Report Finalized & Transmitted", {
            description: sendResult.demo ? "Acknowledged by the local demo receiver; not sent to a clinical system." : `ORU^R01 sent for accession ${accession}.`,
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
          toast.warning("Report signed · Delivery failed", {
            description: "The signed report is saved. Check the HL7 gateway before retrying delivery.",
          });
        }
      } catch (hl7Error: any) {
        console.warn("[finalize] HL7 transmission notice:", hl7Error);
        toast.warning("Report signed · Delivery pending", {
          description: "The signed report is saved, but delivery could not be confirmed.",
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
    if (sendingToDoctor || savingDraft || sendingReport || loadingWorksheet || worksheetLoadError) return;
    if (hasCriticalErrors || (!report.findings.length && !additionalNotes.trim())) {
      toast.error("Cannot submit worksheet", { description: "Record findings and resolve critical validation issues before sending to a doctor." });
      return;
    }
    if (!user) {
      toast.error("Not authenticated", { description: "Please log in and try again." });
      return;
    }
    if (!patient.studyId) {
      toast.error("No study selected", { description: "Select a patient from the Worklist first before sending." });
      return;
    }
    if (corrections.some((item) => item.status === "open")) {
      toast.warning("Resolve requested corrections", {
        description: "Resolve every open field request before resubmitting the case.",
      });
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
        .eq("id", patient.studyId)
        .eq("organization_id", organizationId);

      if (updateError) {
        if (
          (updateError.code === "42703" || updateError.code === "PGRST204") &&
          `${updateError?.message ?? ""}`.toLowerCase().includes("active_worksheet_id")
        ) {
          console.warn("[sendToDoctor] active_worksheet_id column missing — retrying without it");
          const { error: retryError } = await (supabase as any)
            .from("studies")
            .update({ assigned_to: doctorIdToSend, status: "review_pending" })
            .eq("id", patient.studyId)
            .eq("organization_id", organizationId);
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
      setPatient((current) => ({ ...current, studyStatus: "review_pending" }));
      setWorklistRefresh((n) => n + 1);
    } catch (error: any) {
      const errMsg = error?.message ?? (typeof error === "string" ? error : null);
      console.error("[send-to-doctor] Error:", errMsg ?? JSON.stringify(error));
      toast.error("Send failed", { description: errMsg ?? "Unable to assign this case to doctor." });
    } finally {
      setSendingToDoctor(false);
    }
  };

  const handleRetryDelivery = async () => {
    if (sendingReport || savingDraft || isDirty || !user || !patient.studyId || !currentWorksheet?.signed_at || !currentWorksheet.report_text) return;
    setSendingReport(true);
    try {
      const result = await transmitHl7({ organizationId, patientId: patient.id, studyId: patient.studyId, worksheetId: currentWorksheet.id, accessionNumber: accession, payload: buildHL7(patient, currentWorksheet.report_text, accession, exam), userId: user.id });
      if (!result.ok) throw new Error(result.errorMessage || "Delivery could not be confirmed.");
      setCurrentWorksheet(await updateWorksheetStatus(currentWorksheet.id, "transmitted"));
      toast.success(result.demo ? "Demo delivery acknowledged" : "Report delivered", { description: result.demo ? "Acknowledged by the local demo receiver." : "The existing signed report was delivered." });
    } catch (error) {
      toast.error("Delivery failed", { description: error instanceof Error ? error.message : "The signed report remains saved." });
    } finally {
      setSendingReport(false);
      setWorklistRefresh((value) => value + 1);
    }
  };

  const handleReturnForCorrection = async () => {
    if (!isDoctorView || returningForCorrection || sendingReport || savingDraft || loadingWorksheet || currentWorksheet?.signed_at) return;
    if (!user?.id || !patient.studyId || !currentWorksheet?.id) {
      toast.error("Return unavailable", { description: "Open a saved worksheet before returning a case." });
      return;
    }
    if (!corrections.some((item) => item.status === "open")) {
      toast.info("Add a correction request", { description: "Select a worksheet field and describe the required change first." });
      return;
    }
    setReturningForCorrection(true);
    try {
      const updated = await updateWorksheetReview({
        worksheetId: currentWorksheet.id,
        studyId: patient.studyId,
        data: worksheetPayload,
        studyStatus: "correction_requested",
      });
      setCurrentWorksheet(updated);
      setPatient((current) => ({ ...current, studyStatus: "correction_requested" }));
      setIsDirty(false);
      await writeAuditLog({
        userId: user.id,
        patientId: patient.id,
        studyId: patient.studyId,
        worksheetId: currentWorksheet.id,
        action: "return_for_correction",
        status: "success",
        metadata: {
          openCorrections: corrections.filter((item) => item.status === "open").length,
          fields: corrections.filter((item) => item.status === "open").map((item) => item.fieldPath),
        },
      });
      setWorklistRefresh((value) => value + 1);
      toast.success("Returned to sonographer", { description: "The requested fields are recorded on the worksheet." });
    } catch (error) {
      toast.error("Return failed", { description: error instanceof Error ? error.message : "Unable to return this case." });
    } finally {
      setReturningForCorrection(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Clinic role not assigned</h1>
          <p className="text-sm text-muted-foreground">
            Your account is signed in, but a clinical role has not been assigned. Contact your clinic administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <AppNavbar onPatientRegistered={() => setWorklistRefresh((n) => n + 1)} />
      <div className="flex min-h-10 shrink-0 items-center gap-3 border-b bg-card px-3 py-1 sm:px-4">
        <Button variant="outline" size="sm" onClick={() => setShowWorklist(true)} className="h-7">
          <PanelLeft className="mr-1.5 h-3.5 w-3.5" />
          Worklist
        </Button>
        <span className="hidden text-xs text-muted-foreground sm:inline">{isDoctorView ? "Clinical review" : "Clinical workspace"}</span>
          <div className="ml-auto flex items-center gap-2">
            {canInspectHl7 && <Button variant="ghost" size="sm" className="h-7" onClick={() => setHl7Open(true)}>HL7</Button>}
            {canSeeReportHistory && <Button variant={showHistory ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => setShowHistory((value) => !value)}>History{reportHistory.length > 0 ? ` (${reportHistory.length})` : ""}</Button>}
            <Button variant={showDicom ? "default" : "outline"} size="sm" onClick={() => setShowDicom((v) => !v)} className="h-7">
              <Monitor className="mr-1.5 h-3.5 w-3.5" />
              {showDicom ? "Hide images" : "Images"}
            </Button>
          </div>
      </div>

      {isSonographerView && (
        <div className="flex shrink-0 flex-col border-b bg-card xl:flex-row xl:items-center">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 xl:shrink-0 xl:border-r">
            <span className="text-xs font-medium text-muted-foreground">Send case to doctor:</span>
            <select
              value={selectedDoctorId}
              aria-label="Assign doctor"
              onChange={(event) => setSelectedDoctorId(event.target.value)}
              className="h-8 w-full min-w-0 rounded-md border bg-background px-2 text-xs sm:w-auto sm:min-w-64"
            >
              <option value="">Select doctor email</option>
              {availableDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.email}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={handleSendToDoctor} disabled={sendingToDoctor || savingDraft || loadingWorksheet || worksheetLoadError || hasCriticalErrors || !patient.studyId || !selectedDoctorId}>
              {sendingToDoctor ? "Sending..." : "Send to Doctor"}
            </Button>
          </div>
          <WorkflowProgress
            key={patient.studyId ?? patient.id}
            studyId={patient.studyId}
            worksheetId={currentWorksheet?.study_id === patient.studyId ? currentWorksheet?.id : undefined}
            revision={`${currentWorksheet?.updated_at ?? ""}-${worklistRefresh}`}
            patientLabel={`${patient.lastName}, ${patient.firstName}`}
            busy={savingDraft || sendingToDoctor || sendingReport}
            compact
          />
        </div>
      )}

      {!isSonographerView && (
        <WorkflowProgress
          key={patient.studyId ?? patient.id}
          studyId={patient.studyId}
          worksheetId={currentWorksheet?.study_id === patient.studyId ? currentWorksheet?.id : undefined}
          revision={`${currentWorksheet?.updated_at ?? ""}-${worklistRefresh}`}
          patientLabel={`${patient.lastName}, ${patient.firstName}`}
          busy={savingDraft || sendingToDoctor || sendingReport}
        />
      )}

      {!patient.id ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <PanelLeft className="h-8 w-8 text-primary" />
          <h1 className="text-lg font-semibold">Select a case to begin</h1>
          <p className="max-w-sm text-sm text-muted-foreground">Open your worklist to review a study{isSonographerView ? ", or register a patient to start a new examination" : " assigned to you"}.</p>
          <Button onClick={() => setShowWorklist(true)}>Open worklist</Button>
        </div>
      ) : worksheetLoadError ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <h2 className="font-semibold">This worksheet could not be loaded</h2>
          <p className="text-sm text-muted-foreground">Reopen the case from the worklist or reload the workspace before editing.</p>
          <Button onClick={() => window.location.reload()}>Reload workspace</Button>
        </div>
      ) : !mounted || loadingWorksheet ? (
        <div className="flex-1 flex items-center justify-center">
          <Activity className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <ResizablePanelGroup direction={isMobile ? "vertical" : "horizontal"} className="flex-1 min-h-0">
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
                    setDialogExactText(false);
                    setDialogReportText(structuredReportText);
                    setDialogKeyImages(keyImages);
                    setStructuredReportOpen(true);
                  }}
                  lastSavedLabel={`${formatRelative(lastSaved)}${savingDraft ? " (saving...)" : isDirty ? " • Unsaved" : ""}`}
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

        <ResizablePanel defaultSize={isDoctorView ? 60 : 50} minSize={25}>
          <div className="h-full min-w-0 overflow-hidden border-t lg:border-t-0">
            <ReportPreview
              key={`${patient.id}-${patient.studyId}-${currentWorksheet?.signed_at ?? "draft"}`}
              patient={patient}
              accession={accession}
              report={report}
              additionalNotes={additionalNotes}
              validationIssues={validationIssues}
              onPrint={() => {
                setDialogExactText(editedReportText !== null);
                setDialogKeyImages(keyImages);
                setDialogReportText(editedReportText !== null ? `Patient: ${patient.lastName}, ${patient.firstName}\nMRN: ${patient.mrn}\nAccession: ${accession}\nExam: ${exam}\n\n${finalReportText}` : structuredReportText);
                setStructuredReportOpen(true);
              }}
              isDoctorMode={isDoctorView}
              editableText={finalReportText}
              worksheetId={currentWorksheet?.study_id === patient.studyId ? currentWorksheet?.id : undefined}
              isSigned={currentWorksheet?.study_id === patient.studyId && !!currentWorksheet?.signed_at && !!currentWorksheet?.signed_by && currentWorksheet.status !== "draft"}
              canUseAiTools={role === "doctor" || role === "radiologist"}
              hasBeenEdited={editedReportText !== null}
              onEditableTextChange={setEditedReportText}
              onSign={handleSign}
              onSaveDraft={() => { void handleSaveDraft(); }}
              onRetryDelivery={currentWorksheet?.signed_at && currentWorksheet.status !== "transmitted" ? handleRetryDelivery : undefined}
              busy={savingDraft || sendingReport || returningForCorrection}
              dirty={isDirty}
              canSign={canSignAndSend && !!patient.studyId && !!finalReportText.trim() && (report.findings.length > 0 || !!editedReportText?.trim() || !!additionalNotes.trim()) && !corrections.some((item) => item.status === "open") && patient.studyStatus !== "correction_requested"}
              keyImages={keyImages}
              correctionFields={correctionFields}
              corrections={corrections}
              onCorrectionsChange={currentWorksheet?.signed_at ? undefined : setCorrections}
              currentUserId={user?.id ?? ""}
              studyStatus={patient.studyStatus}
              returningForCorrection={returningForCorrection}
              onReturnForCorrection={handleReturnForCorrection}
            />
          </div>
        </ResizablePanel>

        {showDicom && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={20}>
              <div className="h-full min-w-0 overflow-hidden border-t lg:border-t-0">
                <DicomViewer
                  key={patient.studyId ?? patient.id}
                  accession={accession}
                  keyImages={keyImages}
                  onKeyImagesChange={setKeyImages}
                  currentUserId={user?.id}
                  canSelectKeyImages={isDoctorView}
                />
              </div>
            </ResizablePanel>
          </>
        )}
        </ResizablePanelGroup>
      )}

      {canSeeReportHistory && showHistory && (
        <ReportHistory
          patient={patient}
          items={reportHistory}
          loading={loadingHistory}
          onOpen={(text, historyKeyImages) => {
            setDialogExactText(true);
            setDialogReportText(text);
            setDialogKeyImages(historyKeyImages);
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
              <PatientWorklist selectedId={patient.id} selectedStudyId={patient.studyId} onSelect={handleSelectPatient} refreshKey={worklistRefresh} />
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
        useExactText={dialogExactText}
        templates={availableTemplates}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        renderedDocument={renderedTemplateDocument}
        tier={templateTier}
        branding={brandingSettings}
        keyImages={dialogKeyImages}
      />
      <Toaster richColors position="top-right" closeButton duration={3000} />
    </div>
  );
}
