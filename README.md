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