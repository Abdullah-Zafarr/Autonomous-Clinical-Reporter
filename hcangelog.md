# Sonolynx Change Log

This file records the major features and reliability improvements implemented in the current Sonolynx project.

## 2026-09-06 — Admin Login Routing Fix

- Route administrators to `/admin` after sign-in; clinical roles continue to `/`.
- Wait for the authenticated role to load before choosing the login destination.
- Remove the unconditional clinical-workspace navigation after password sign-in.
- Preserve intentional access to the Clinical Workspace through the navigation menu.
- Add regression checks for admin routing, clinical roles, and stale role rows.

## 2026-09-06 — Key Images and Worksheet Correction Workflow

### Key images inside reports

- Added a doctor-facing **Add key image** action to the DICOM viewer.
- Captures the currently rendered ultrasound frame after window/level, pan, and zoom adjustments.
- Added freehand red markup and clinical captions before an image is accepted.
- Supports up to six selected key images per worksheet, including removal before finalization.
- Stores validated JPEG or PNG image data with the worksheet so images remain tied to the report revision.
- Displays key images beside report findings in the live report preview.
- Includes key images and captions in branded A4 previews, browser print views, downloaded PDFs, and signed-report history exports.
- Added payload validation and image-size limits for persisted key images.

### Return case for correction

- Added a doctor-facing worksheet correction panel.
- Builds correction targets from the active worksheet and displays the field's current value.
- Lets reviewers attach comments to exact abdomen, thyroid, obstetric, or vascular fields.
- Supports multiple requests in one return cycle and lets reviewers remove an accidental request before returning the case.
- Added the `correction_requested` study state and surfaced it in Case Progress.
- Blocks report signing while a correction cycle remains open.
- Shows returned requests to sonographers in the clinical workspace.
- Lets sonographers record a resolution note for each requested field.
- Blocks resubmission until every open correction is resolved.
- Preserves resolved requests as part of the worksheet review history.
- Records return and resubmission workflow activity through the existing audit system.
- Added an organization- and assignment-scoped Supabase update policy for assigned reviewers.

### Validation

- Added workflow coverage for the correction-requested state.
- Passed TypeScript validation, ESLint, the production Next.js build, and all workflow tests.
- Visually verified the doctor correction workflow in the running application with no browser errors.

## 2026-09-06 — AI Report Tools and Case Progress

- Added conversational **Edit Report with AI** with quick instructions and optional voice input.
- Added a side-by-side original/proposed report comparison before applying edits.
- Added deterministic numeric-fact checks and an AI clinical-meaning review step.
- Kept all AI changes inside the physician review flow; applying an edit does not sign a report.
- Added clinician-reviewed patient-friendly explanations in English, Urdu, Arabic, and Spanish.
- Added right-to-left display for Urdu and Arabic.
- Added approval-gated copy and UTF-8 download for patient explanations.
- Records explanation approval, reviewer, source hash, language, text, and time in audit logs.
- Added the Worksheet → Doctor Review → Signed → Sent progress tracker.
- Added refresh on workflow actions, focus, and a 30-second visible polling interval.
- Distinguishes local mock delivery from real delivery with a **Demo sent** label.
- Added focused report-AI and workflow validation commands.
- Disabled synthetic worklist records by default and added `NEXT_PUBLIC_ENABLE_DEMO_DATA` for local demonstrations.

## Clinical Workflow and Reporting

- Added secure login and role-aware administrator, doctor, radiologist, and sonographer workspaces.
- Added patient and study registration with validation, duplicate-MRN checks, and rollback handling.
- Added assigned doctor worklists with real-time updates and polling fallback.
- Added deterministic `active_worksheet_id` loading so a reviewer opens the worksheet that was actually submitted.
- Added draft persistence, worksheet hydration, signing, report history, and status transitions.
- Added exam-specific structured report generation for Abdomen, Thyroid, Obstetric, and Vascular ultrasound.
- Added inline clinical validation and signing guards.
- Added report editing, structured previews, branded A4 templates, printing, and compressed PDF downloads.
- Added HL7 v2 `ORU^R01` inspection, transmission, acknowledgment tracking, and delivery failure reporting.

## Worksheet Coverage

- Added configurable drag-and-drop ordering for abdomen worksheet sections.
- Expanded abdomen reporting for liver surface, gallbladder, biliary tree, kidneys, spleen, pancreas, portal vein, aorta, IVC, and ascites.
- Added renal cortical echogenicity, stone laterality, duct measurements, and clinically relevant threshold logic.
- Expanded thyroid reporting with lobe dimensions, isthmus thickness, parenchyma, vascularity, cervical lymph nodes, and detailed TI-RADS nodule descriptors.
- Added obstetric fields for gestational age, fetal heart rate, presentation, placenta, amniotic fluid, biometry notes, and impression.
- Added vascular fields for vessel, laterality, patency, stenosis, thrombus, waveform, and impression.
- Added clinical notes and voice-assisted worksheet capture through Deepgram, Gladia, and browser speech recognition.

## Imaging

- Added local DICOM upload and DICOMweb study, series, instance, and frame retrieval.
- Added cine-style frame navigation.
- Added interactive window/level, pan, zoom, explicit zoom controls, and view reset.
- Connected DICOM retrieval to the selected study accession number.

## Administration, Security, and Multi-Tenancy

- Added organization-scoped patients, studies, worksheets, HL7 messages, templates, branding, and staff administration.
- Added role and organization management with protected server routes.
- Added report-template and branding management with organization tier controls.
- Hardened row-level security for assigned clinical staff and tenant boundaries.
- Added audit logging for worksheet saves, review handoffs, signatures, AI explanation approvals, and delivery activity.
- Added administrative health and operational views without exposing secrets to the browser.
- Removed hardcoded service credentials from database utilities and documented environment-based configuration.

## Reliability and Compatibility

- Added compatibility between legacy `form_data` records and the current worksheet `data` payload.
- Added schema fallbacks for deployments whose PostgREST cache has not yet refreshed.
- Expanded worksheet and HL7 status constraints for signed, transmitted, and failed outcomes.
- Fixed role-enum and `has_role()` compatibility for doctor, radiologist, sonographer, and administrator accounts.
- Added deterministic save-before-assignment behavior and clearer user-facing failure messages.
- Added focused TypeScript, lint, randomized clinical-rule, report-AI, workflow, and production-build validation commands.

## Required Migration for the Latest Features

Apply `supabase/migrations/20260906010000_key_images_and_correction_workflow.sql` before using the return-for-correction workflow in a deployed environment.
