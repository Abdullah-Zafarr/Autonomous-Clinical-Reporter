# Sonolynx - Ultrasound Worksheet Workflow

Sonolynx is a professional clinical reporting and ultrasound worksheet workflow platform designed for radiology clinics and sonographers.

## Key Features

- **Dynamic Worksheets**: Support for various ultrasound types (Obstetrics, Pelvic, Abdominal, etc.).
- **Doctor/Sonographer Modes**: Tailored interfaces for different clinical roles.
- **AI Clinical Report Drafter**: Empower doctors and radiologists to draft structured, ACR-standard clinical reports in seconds using intelligent AI assistance or voice dictation.
- **Automated Reporting**: Generate professional clinical reports with a single click.
- **HL7 Integration**: Seamless data transmission to clinical systems.
- **Organization Management**: Multi-clinic support with custom branding.

## Doctor AI Report Assistant

Sonolynx features an intelligent, guardrailed AI Clinical Drafter built directly into the doctor's review and sign-off workflow:

- **Intelligent Report Generation**: Instantly transform raw findings, measurements, and clinical observations into comprehensive, structured radiology reports (Technique, Findings by organ/system, and Impression).
- **Hands-Free Voice Dictation**: Live microphone dictation powered by speech recognition enables doctors to verbally capture observations hands-free.
- **ACR Guardrails & Clinical Safety**: Powered by high-throughput Groq LLM inference configured with strict radiology transcription guardrails to ensure factual accuracy and prevent hallucinations.
- **Clinical Presets & Quick Templates**: Built-in standardized templates for common exams (e.g., Normal Abdomen, Cholelithiasis, Thyroid, Renal) for rapid drafting.
- **Full Physician-in-the-Loop Control**: Physicians maintain total autonomy to review, edit, refine, and digitally sign reports before final archiving or HL7 transmission.

## AI Report Tools

The workspace also shows **Case Progress** above the clinical panels: Worksheet → Doctor Review → Signed → Sent. It follows saved worksheets, review submissions, signatures, and delivery records, displaying recorded timestamps when available. Local mock acknowledgments are labeled **Demo sent**. The tracker refreshes after workflow actions, on window focus, and every 30 seconds while visible; a refresh button is also available. Run status-transition checks with `npm run test:workflow`.

The doctor report panel includes two labeled buttons using the existing application theme:

- **Edit Report with AI** opens conversational editing with quick instructions, optional browser voice input, and a side-by-side before/after preview. Numeric facts are checked in code, followed by an AI clinical-meaning check. The clinician reviews the proposal before applying it to the draft; this does not sign the report.
- **Patient-friendly Explanation** generates an explanation of the saved signed report in English, Urdu, Arabic, or Spanish. Urdu and Arabic use right-to-left text. A clinician can edit the explanation, compare it with the source, and approve it before copy or UTF-8 text download becomes available. Changing the explanation or language clears approval.

These tools use the existing server-side `GROQ_API_KEY` or `OPENAI_API_KEY` configuration and optional model environment variables. The `/api/report/copilot` endpoint requires a signed-in doctor or radiologist. Explanations require a saved signed worksheet in the clinician's organization. Approvals record the reviewer, language, source hash, explanation text, and approval time in the existing `audit_logs` table; sharing stays disabled if recording approval fails. No new database migration is needed if the existing workflow migrations have been applied.

For a demo, open a case in doctor mode, select **Edit Report with AI**, choose **Make the impression shorter**, then preview and apply. After signing the report, select **Patient-friendly Explanation**, choose a language, generate, review, and approve. Copy/download prepares the explanation for the clinic's usual sharing process; it does not automatically send a message to the patient. Close/reopen starts a fresh explanation review; approved copies remain recorded in the audit log.

Run focused validation with `npm run test:report-ai`. AI checks assist review and do not guarantee clinical equivalence or translation accuracy.

Synthetic worklist data is disabled by default. For a local presentation only, set `NEXT_PUBLIC_ENABLE_DEMO_DATA=true`; keep it false for shared or production environments.

## Screenshots

### Main Interface
![Sonographer Mode](screenshots/sonographer%20mode.PNG)

### Clinical Review
![Doctor View](screenshots/doctor%20view.PNG)

### Worksheet Variety
![Worksheets](screenshots/different%20types%20of%20of%20worksheets.png)

### Administrative Dashboard
![Admin Dashboard](screenshots/admin%20dashboard%201.PNG)

### Report Generation
![Generate Report](screenshots/generate%20report.PNG)

## Tech Stack & Architecture

- **Frontend & Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Styling & UI**: [Tailwind CSS](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons, Shadcn UI
- **Database & Authentication**: [Supabase](https://supabase.com/) (PostgreSQL, Row-Level Security, Session & Role Management)
- **AI Clinical Scribe**: [Groq](https://groq.com/) Cloud LLMs (`openai/gpt-oss-120b`) with ACR radiology transcription guardrails
- **Medical Dictation (STT)**: [Deepgram](https://deepgram.com/) Medical Speech API + Web Speech API for real-time transcription
- **Medical Imaging (PACS)**: Cornerstone.js & DICOMweb viewer (Window/Level, Zoom, Pan, Cine playback)
- **Clinical Interoperability**: HL7 v2.x (`ORU^R01`) export and transmission engine
- **Deployment**: [Vercel](https://vercel.com/) (Production Serverless & Edge Network)

Made as a part of my internship at Bricklix
