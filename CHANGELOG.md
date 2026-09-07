# Sonolynx Change Log

## Final product review

This log records the changes made during the final product review and demo-readiness pass.

### Doctor workspace and visual polish

- Refined the doctor review panel with clearer `Clinical report` language and more deliberate spacing and typography.
- Added explicit `UNSAVED`, `DRAFT`, and `SIGNED` report states.
- Added Save draft, Retry delivery, and state-aware sign controls.
- Added busy-state guards so save, send, sign, and retry actions cannot be triggered repeatedly.
- Prevented signed reports from being overwritten; signing a changed report creates a new draft revision.
- Made the corrections panel collapsible to reduce visual clutter.
- Made History and Images optional panels instead of forcing them into the default doctor layout.
- Adjusted the report panel split so the clinical report receives the primary workspace area.
- Improved mobile sizing and prevented horizontal overflow.
- Kept key images visible below the report content, including after report edits.

### Clinical workflow safety

- Added worksheet loading, retry, and error states.
- Prevented sending incomplete worksheets, empty findings, or reports without a selected study.
- Added guards against editing or signing while a worksheet is loading or being saved.
- Pinned the active worksheet after draft creation.
- Preserved sonographer and author fields when a doctor edits an existing draft.
- Added optimistic unsigned-row guards to review and signing updates.
- Updated patient status to completed after a study is completed.
- Added stale-request protection to authentication role loading so an older request cannot overwrite newer auth state.

### Worksheet coverage

- Added obstetric fields for presentation, placenta, amniotic fluid, biometry notes, and FHR validation.
- Added vascular fields for laterality, flow patency, thrombus, stenosis findings, and waveform notes.
- Added accessible labels and appropriate disabled states to worksheet controls.
- Restricted the HL7 action to the doctor workflow where it belongs.

### Validation and report generation

- Added recursive malformed-number detection for numeric worksheet values.
- Prevented empty OB and vascular worksheets from generating invented findings or impressions.
- Prevented empty thyroid worksheets from generating normal findings or recommendations.
- Changed undocumented dimension wording to `Dimensions not documented`.
- Updated OB and vascular defaults to require clinician review when no impression is entered.
- Preserved recommendations and additional notes through template rendering.
- Added `{{recommendations}}` and `{{additionalNotes}}` template tokens.
- Included signed identity, signing time, and notes in report-generation context.

### Report preview and export

- Improved the report preview header, status treatment, and empty-state messaging.
- Added an accessible report editor with busy-state handling.
- Preserved edited text in raw and A4 preview modes.
- Verified Copy Text output.
- Verified PDF download and inspected the generated A4 PDF visually.
- Improved the structured-report dialog for small screens with responsive sizing and scrolling.

### DICOM workflow

- Tested multi-file DICOM upload.
- Tested multi-frame navigation.
- Tested zoom, reset view, and key-image capture.
- Tested key-image captions and confirmed captured images appear in the report.
- Added/verified image limits and the loaded-series state.

### Patient worklist and accessibility

- Expanded search to patient name, MRN, accession number, and exam name.
- Added clearer no-results messaging.
- Improved exact study selection behavior.
- Added keyboard activation and ARIA labels to worklist, search, refresh, and report controls.
- Added accessible labels to worksheet and dialog controls.

### Admin and product copy

- Replaced the misleading `HIPAA · Production` development badge with `Development workspace`.
- Updated login copy to describe ultrasound reporting and clinical review.
- Masked the admin new-user password field and added appropriate autocomplete behavior.

### Infrastructure and tests

- Updated the resizable-panel wrapper to the current `react-resizable-panels` API.
- Added the `test` and `test:review` npm scripts.
- Added `scripts/product-review.test.ts` with coverage for empty worksheets, OB and vascular data, malformed numerics, HL7 escaping, template notes, conditional blocks, corrections, API retry/cancel behavior, authorship, and signing guards.

## Verification completed

- Product-review test suite: 26 tests passed.
- Randomized clinical rule validation: 5,000 cases checked with zero failures.
- TypeScript typecheck passed.
- Production build passed and generated all application routes.
- Desktop doctor workspace reviewed in the browser.
- Mobile viewport reviewed at 390×844 with no horizontal overflow.
- DICOM upload, frame navigation, zoom, reset, and key-image capture tested.
- Raw report preview, A4 preview, copy, and PDF download tested.
- PDF inspected as a one-page A4 document.
- Backend read-only data and unauthenticated API authorization boundaries checked.

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
