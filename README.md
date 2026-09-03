# Sonolynx - Ultrasound Worksheet Workflow

Sonolynx is a professional clinical reporting and ultrasound worksheet workflow platform designed for radiology clinics and sonographers.

## Key Features

- **Dynamic Worksheets**: Support for various ultrasound types (Obstetrics, Pelvic, Abdominal, etc.).
- **Doctor/Sonographer Modes**: Tailored interfaces for different clinical roles.
- **Automated Reporting**: Generate professional clinical reports with a single click.
- **HL7 Integration**: Seamless data transmission to clinical systems.
- **Organization Management**: Multi-clinic support with custom branding.

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