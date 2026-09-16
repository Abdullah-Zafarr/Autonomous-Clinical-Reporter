# Radix (Autonomous-Clinical-Reporter) - Agent Operating Guidelines

This document serves as the primary system manual, architectural guide, and operational protocol for autonomous AI agents and coding assistants collaborating on the **Radix** repository.

---

## 1. System Overview

**Radix** is an enterprise-grade ultrasound clinical reporting and worksheet workflow platform engineered for modern radiology clinics, sonographers, and reading physicians. It integrates real-time medical dictation, dynamic organ-specific worksheets, ACR-guardrailed AI clinical report drafting, DICOM/PACS viewing, and HL7 v2 clinical data transmission.

### Primary User Personas & Clinical Workflow
1. **Sonographer**:
   - Inputs clinical measurements and anatomical findings into structured worksheets (Abdomen, Thyroid, OB, Vascular).
   - Captures real-time voice dictation (Deepgram / Web Speech API).
   - Resolves validation alerts and submits completed studies for physician review.
   - Reviews and addresses returned field-level correction requests from radiologists.
2. **Doctor / Radiologist**:
   - Inspects patient studies, DICOM frames, and attached key images (up to 6 per study).
   - Uses AI report copilot and clinical presets (+ Normal Abdomen, + Cholelithiasis, etc.) to draft structured reports (Technique, Findings, Impression).
   - Refines findings conversationally with strict numeric preservation checks.
   - Digitally signs and finalizes reports; generates and reviews multilingual patient explanations (English, Urdu, Arabic, Spanish).
3. **Clinic Administrator**:
   - Manages clinic staff roles (admin, doctor, radiologist, sonographer).
   - Configures organization branding, template presets, tier allowances, and monitors immutable audit logs.

---

## 2. Tech Stack & Architecture

| Layer | Technologies | Key Considerations |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router, Turbopack) | Server Components where appropriate; `"use client"` for interactive clinical panels. |
| **Frontend / UI** | React 19, Tailwind CSS v4, Radix UI Primitives, Lucide Icons, Framer Motion | High-density clinical workstation aesthetic; midnight/dark slate theme optimized for reading rooms. |
| **Database & Auth** | Supabase (PostgreSQL 15+, Auth, Storage) | Multi-tenant organization scoping (`organization_id`), strict Row-Level Security (RLS). |
| **Medical Imaging** | Cornerstone.js, DICOMweb, `dicom-parser` | Web-based zero-footprint viewer with window/level, pan, zoom, freehand annotations. |
| **Speech-to-Text** | Deepgram Medical API, Gladia, Web Speech API | Medical vocabulary transcription and real-time streaming. |
| **AI Inference** | Groq Cloud LLM (`openai/gpt-oss-120b`) / OpenAI API | ACR radiology guardrails, deterministic numeric checking, structured JSON outputs. |
| **Interoperability** | HL7 v2.x (`ORU^R01`), FHIR-ready | Standardized clinical transmission and inspection. |
| **PDF Generation** | jsPDF, html2canvas | Standardized vector-ready A4 clinical report exports. |

---

## 3. Directory Structure

```
Autonomous-Clinical-Reporter/
├── app/                              # Next.js App Router
│   ├── admin/                        # Administrative console & clinic governance
│   ├── api/                          # Serverless endpoints
│   │   ├── admin/                    # Tenant & user management APIs
│   │   ├── extract/                  # Worksheet structured data extraction
│   │   ├── gladia/ & stt/            # Voice dictation & transcription endpoints
│   │   ├── hl7/                      # HL7 v2 message generation & transmission
│   │   ├── patients/                 # Patient registry & study worklist
│   │   └── report/                   # AI drafting, conversational copilot, patient explanations
│   ├── copilot-preview/              # Isolated AI copilot workbench
│   ├── developer/                    # Developer tooling & system inspection
│   ├── login/                        # Role-gated clinician authentication
│   ├── layout.tsx                    # Root layout with providers & theme wrapper
│   └── page.tsx                      # Primary clinical workspace (Sonographer & Doctor views)
├── docs/                             # Architecture, FDA compliance, and system documentation
├── public/                           # Static assets, fallback DICOMs, and demo samples
├── scripts/                          # Diagnostic scripts and node test runner suites
├── src/
│   ├── components/
│   │   ├── sonoflow/                 # Core clinical components (Worksheet, DicomViewer, Copilot, Worklist)
│   │   ├── sonolynx/                 # Workflow UI (CorrectionPanel, Settings, TemplateEditor, Progress)
│   │   └── ui/                       # Reusable Radix UI & Shadcn primitives
│   ├── hooks/                        # Custom React hooks (dictation, keyboard shortcuts, media query)
│   ├── integrations/                 # Third-party service client bindings
│   ├── lib/
│   │   ├── clinical-validator.ts     # Deterministic ACR threshold engine (DO NOT BYPASS)
│   │   ├── report-ai-safety.ts       # Numeric preservation & safety assertion rules
│   │   ├── report-engine.ts          # Structured report generation logic
│   │   ├── report-template-engine.ts # A4 report formatting presets & styles
│   │   ├── hl7-service.ts            # HL7 ORU^R01 creation and delivery tracking
│   │   ├── audit-service.ts          # Immutable audit logging service
│   │   ├── org-scope.ts              # Multi-tenant boundary enforcement
│   │   └── supabase-*.ts             # Supabase client, server, and service role configurations
│   └── types/                        # TypeScript domain types & data models
├── supabase/
│   └── migrations/                   # Sequential SQL migrations (RLS, schema, triggers)
└── tests/                            # Comprehensive end-to-end and unit test suites
```

---

## 4. Critical Medical & Clinical Safety Rules

Autonomous agents **MUST STRICTLY ADHERE** to the following non-negotiable safety guardrails:

### 1. Deterministic Clinical Thresholds Over AI Assertions
- **Source of Truth**: [`src/lib/clinical-validator.ts`](file:///c:/Users/Hp/Downloads/milestone-project-radix/Autonomous-Clinical-Reporter/src/lib/clinical-validator.ts) enforces ACR and standard anatomical bounds (e.g. liver size, gallbladder wall thickness, CBD caliber, aortic aneurysm thresholds, thyroid nodule TI-RADS criteria).
- **Rule**: Never disable, bypass, or weaken clinical validation errors. Validation errors must actively block unsafe report submission or digital sign-off.

### 2. Numeric Facts & Unit Preservation
- **Source of Truth**: [`src/lib/report-ai-safety.ts`](file:///c:/Users/Hp/Downloads/milestone-project-radix/Autonomous-Clinical-Reporter/src/lib/report-ai-safety.ts).
- **Rule**: When editing or summarizing reports via AI (`preservesNumericFacts`), every measurement, decimal value, and unit (`mm`, `cm`, `mL`, `bpm`, `%`, etc.) present in the original finding must be preserved exactly. Hallucinating or omitting numbers is a critical safety failure.

### 3. Physician-in-the-Loop Mandate
- AI generates drafts, suggests refinements, and aids transcription; it **never** finalizes or digitally signs clinical reports autonomously.
- Digital sign-off requires authenticated doctor/radiologist credentialing and produces an immutable audit log entry.

### 4. Patient Privacy & HIPAA / RLS Isolation
- All database queries for studies, worksheets, patients, and audit records must be scoped to the authenticated user's `organization_id` ([`src/lib/org-scope.ts`](file:///c:/Users/Hp/Downloads/milestone-project-radix/Autonomous-Clinical-Reporter/src/lib/org-scope.ts)).
- Never leak Protected Health Information (PHI) in client-side console logs or unauthenticated error traces.
- Keep synthetic demo data strictly disabled in production (`NEXT_PUBLIC_ENABLE_DEMO_DATA=false`).

### 5. Multilingual Patient Explanations
- Simplified translations (English, Urdu, Arabic, Spanish) must undergo explicit clinician review and approval before sharing/downloading is unlocked.
- Editing an explanation resets the approval status and requires re-approval.

---

## 5. Development & Testing Commands

Agents must run verification commands after introducing changes:

### Build & Typecheck
```bash
# Type check TypeScript codebase
npm run typecheck

# Run Next.js production build check
npm run build
```

### Automated Test Suites
```bash
# Run all tests in tests/ and scripts/
npm run test:suite

# Run AI report copilot and numeric safety tests
npm run test:report-ai

# Run case workflow progression and state-transition tests
npm run test:workflow

# Run product review and end-to-end workflow verification
npm run test:review

# Validate randomized findings against ACR clinical rules
npm run validate:rules
```

### Linting & Formatting
```bash
# Run ESLint across the codebase
npm run lint

# Format code with Prettier
npm run format
```

---

## 6. Coding Standards & Agent Best Practices

1. **TypeScript Strictness**:
   - Maintain strict type safety. Avoid `any` types; define explicit interfaces in `src/types/` or `src/lib/`.
   - Do not suppress TypeScript errors with `@ts-ignore` or `@ts-nocheck` without explicit architectural justification.

2. **Database Migrations**:
   - Never mutate or overwrite historical SQL migration files in `supabase/migrations/` that have already been deployed.
   - Always create new sequential migration files for schema changes, indexing, or RLS policies.

3. **Component Architecture**:
   - Separate complex state management and business logic into custom hooks or services in `src/lib/`.
   - Preserve existing accessibility attributes (`aria-*`, role attributes) and Radix UI primitives.
   - Maintain dark-slate styling consistency matching the existing design system in `app/globals.css`.

4. **Error Handling & Audit Trail**:
   - Critical user actions (report draft creation, edits, correction requests, approvals, sign-offs, and HL7 transmissions) must invoke `logAuditEvent` from [`src/lib/audit-service.ts`](file:///c:/Users/Hp/Downloads/milestone-project-radix/Autonomous-Clinical-Reporter/src/lib/audit-service.ts).
   - API endpoints must return descriptive error messages with appropriate HTTP status codes (e.g. 400 for validation errors, 401/403 for unauthorized tenant access).
