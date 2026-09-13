"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type ClinicalRole = "doctor" | "sonographer" | "admin" | "radiologist" | "all";

export interface ClinicalDoodle {
  id: string;
  name: string;
  role: "doctor" | "sonographer" | "admin" | "general";
  categoryLabel: string;
  description: string;
  bgGradient: string;
  accentColor: string;
  render: (props: { className?: string }) => React.ReactElement;
}

export const CLINICAL_DOODLES: ClinicalDoodle[] = [
  // ==========================================
  // 1. DOCTOR & RADIOLOGIST DOODLES
  // ==========================================
  {
    id: "doc-stethoscope",
    name: "Stethoscope Specialist",
    role: "doctor",
    categoryLabel: "Doctor",
    description: "Attending clinician with stethoscope draped and diagnostic chart",
    bgGradient: "from-blue-500/20 to-indigo-500/10",
    accentColor: "text-blue-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Head */}
        <circle cx="32" cy="20" r="10" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Glasses */}
        <rect x="25" y="17" width="6" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <rect x="33" y="17" width="6" height="5" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <line x1="31" y1="19" x2="33" y2="19" stroke="currentColor" strokeWidth="1.8" />
        {/* Smile */}
        <path d="M29 25C30.5 26.5 33.5 26.5 35 25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        {/* Shoulders / Coat */}
        <path d="M16 52C16 41 23 35 32 35C41 35 48 41 48 52" stroke="currentColor" strokeWidth="2.5" fill="white" strokeLinecap="round" />
        {/* Stethoscope */}
        <path d="M25 36V43C25 46.866 28.134 50 32 50C35.866 50 39 46.866 39 43V36" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" />
        {/* Chest piece */}
        <circle cx="32" cy="52" r="3" fill="#3b82f6" stroke="white" strokeWidth="1" />
        {/* Medical Cross on Lapel */}
        <path d="M42 41V45M40 43H44" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "doc-neuro",
    name: "Neuro & Scan Reader",
    role: "doctor",
    categoryLabel: "Doctor",
    description: "Radiologist inspecting brain parenchyma and neuro-axial CT/MRI",
    bgGradient: "from-cyan-500/20 to-blue-500/10",
    accentColor: "text-cyan-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Lightbox / Screen */}
        <rect x="14" y="12" width="36" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <line x1="14" y1="18" x2="50" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
        {/* Brain Hemispheres Doodle */}
        <path d="M28 26C25 26 22 28 22 31C22 33 23 34 24 35C22 37 23 40 25 41C27 42 29 41 30 40C30.5 41 31 42 32 42C33 42 33.5 41 34 40C35 41 37 42 39 41C41 40 42 37 40 35C41 34 42 33 42 31C42 28 39 26 36 26C35 24 33 23 32 23C31 23 29 24 28 26Z" stroke="#06b6d4" strokeWidth="2" fill="#ecfeff" />
        {/* Center Fissure */}
        <path d="M32 24V41" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="1.5 2" />
        {/* Diagnostic Sparkles */}
        <circle cx="21" cy="15" r="1.5" fill="#06b6d4" />
        <circle cx="43" cy="15" r="1.5" fill="#06b6d4" />
        {/* Scan Loupe */}
        <circle cx="44" cy="42" r="5" stroke="#3b82f6" strokeWidth="2" fill="white" fillOpacity="0.8" />
        <line x1="48" y1="46" x2="53" y2="51" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "doc-clipboard",
    name: "Attending Physician",
    role: "doctor",
    categoryLabel: "Doctor",
    description: "Doctor reviewing patient clinical report and structured observations",
    bgGradient: "from-indigo-500/20 to-purple-500/10",
    accentColor: "text-indigo-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Clipboard */}
        <rect x="18" y="14" width="28" height="38" rx="4" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Clip */}
        <rect x="26" y="10" width="12" height="7" rx="2" stroke="currentColor" strokeWidth="2" fill="#f8fafc" />
        <circle cx="32" cy="13.5" r="1.5" fill="currentColor" />
        {/* Checklist Rows */}
        <line x1="24" y1="24" x2="27" y2="24" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="24" x2="40" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
        
        <line x1="24" y1="31" x2="27" y2="31" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="31" x2="42" y2="31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />
        
        <line x1="24" y1="38" x2="27" y2="38" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        <line x1="30" y1="38" x2="38" y2="38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5" />

        {/* Doctor Signature Stamp */}
        <path d="M25 46C27 44 29 47 31 45C33 43 35 46 39 44" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        {/* Pen */}
        <path d="M43 20L49 14L53 18L47 24Z" fill="#6366f1" stroke="white" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: "doc-coffee",
    name: "Night-Shift Radiologist",
    role: "doctor",
    categoryLabel: "Doctor",
    description: "Dedicated on-call radiologist reading emergency ultrasound with coffee",
    bgGradient: "from-amber-500/20 to-orange-500/10",
    accentColor: "text-amber-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Coffee Mug */}
        <path d="M20 25H40V40C40 44 36 47 30 47C24 47 20 44 20 40V25Z" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Mug Handle */}
        <path d="M40 28H44C47 28 47 37 44 37H40" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Heart Pulse on Mug */}
        <path d="M24 36H27L29 32L31 40L33 34L34 36H37" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Steam */}
        <path d="M26 20C25 17 27 15 26 12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 19C29 16 31 14 30 11" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <path d="M34 20C33 17 35 15 34 12" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        {/* Crescent Moon */}
        <path d="M46 14C44 14 43 15 42.5 16.5C44.5 17.5 45.5 20 44.5 22C46.5 21 47.5 18.5 46.5 16C46.5 15 46.2 14.5 46 14Z" fill="#eab308" />
      </svg>
    ),
  },
  {
    id: "doc-caduceus",
    name: "Clinical Caduceus",
    role: "doctor",
    categoryLabel: "Doctor",
    description: "Classic medical symbol of healing, physician ethics and clinical authority",
    bgGradient: "from-emerald-500/20 to-teal-500/10",
    accentColor: "text-emerald-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Central Rod */}
        <line x1="32" y1="12" x2="32" y2="52" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="11" r="3" fill="#eab308" stroke="currentColor" strokeWidth="1.5" />
        {/* Wings */}
        <path d="M32 18C25 15 17 18 16 23C22 24 28 22 32 23" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" fill="#ecfdf5" />
        <path d="M32 18C39 15 47 18 48 23C42 24 36 22 32 23" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" fill="#ecfdf5" />
        {/* Entwined Serpent */}
        <path d="M26 27C26 25 38 25 38 31C38 37 26 35 26 41C26 47 38 45 38 49" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },

  // ==========================================
  // 2. SONOGRAPHER DOODLES
  // ==========================================
  {
    id: "sono-probe",
    name: "Curved Probe Master",
    role: "sonographer",
    categoryLabel: "Sonographer",
    description: "Curved ultrasound transducer emitting acoustic beam waves into tissue",
    bgGradient: "from-sky-500/20 to-teal-500/10",
    accentColor: "text-sky-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Probe Handle */}
        <rect x="27" y="12" width="10" height="22" rx="4" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Grip Rings */}
        <line x1="28" y1="18" x2="36" y2="18" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        <line x1="28" y1="23" x2="36" y2="23" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
        {/* Cable */}
        <path d="M32 12C32 8 36 6 38 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Probe Head (Curved Array) */}
        <path d="M23 34H41C42 34 43 35 43 36C42 41 38 44 32 44C26 44 22 41 21 36C21 35 22 34 23 34Z" stroke="currentColor" strokeWidth="2.5" fill="#0284c7" />
        {/* Acoustic Sound Waves */}
        <path d="M24 48C28 50 36 50 40 48" stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 53C26 56 38 56 44 53" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "sono-doppler",
    name: "Color Doppler Flow",
    role: "sonographer",
    categoryLabel: "Sonographer",
    description: "Vascular flow mapping with directional red arterial and blue venous Doppler",
    bgGradient: "from-rose-500/15 via-blue-500/15 to-transparent",
    accentColor: "text-rose-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Vessel Outline */}
        <path d="M12 24C24 22 40 22 52 24" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        <path d="M12 40C24 42 40 42 52 40" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
        {/* Red Arterial Flow Arrow (Forward) */}
        <path d="M16 29H34L31 26M34 29L31 32" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Blue Venous Flow Arrow (Reverse) */}
        <path d="M48 35H30L33 32M30 35L33 38" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Ultrasound Sector Beam */}
        <path d="M32 10L18 20M32 10L46 20" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7" />
        <circle cx="32" cy="10" r="2" fill="#f59e0b" />
      </svg>
    ),
  },
  {
    id: "sono-gel",
    name: "Acoustic Gel & Transducer",
    role: "sonographer",
    categoryLabel: "Sonographer",
    description: "Clear ultrasound coupling gel bottle for zero-acoustic-impedance imaging",
    bgGradient: "from-teal-500/20 to-emerald-500/10",
    accentColor: "text-teal-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Gel Bottle */}
        <rect x="22" y="22" width="20" height="28" rx="5" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Bottle Cap / Nozzle */}
        <path d="M28 22V16H36V22" stroke="currentColor" strokeWidth="2" fill="#e2e8f0" />
        <line x1="30" y1="13" x2="34" y2="13" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" />
        {/* Gel Droplet on bottle */}
        <path d="M32 30C32 30 35 34 35 36C35 38 33.5 39.5 32 39.5C30.5 39.5 29 38 29 36C29 34 32 30 32 30Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
        {/* Sparkles */}
        <path d="M47 18L48 21L51 22L48 23L47 26L46 23L43 22L46 21Z" fill="#14b8a6" />
        <path d="M15 32L16 34L18 35L16 36L15 38L14 36L12 35L14 34Z" fill="#14b8a6" />
      </svg>
    ),
  },
  {
    id: "sono-screen",
    name: "Ultrasound Console",
    role: "sonographer",
    categoryLabel: "Sonographer",
    description: "Ergonomic clinical cart with trackball, depth knobs and cine-loop controls",
    bgGradient: "from-blue-500/20 to-slate-500/10",
    accentColor: "text-blue-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Screen Bezel */}
        <rect x="16" y="14" width="32" height="24" rx="3" stroke="currentColor" strokeWidth="2.5" fill="#0f172a" />
        {/* Ultrasound Pie Sector on Screen */}
        <path d="M32 17L22 34C28 36 36 36 42 34Z" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
        {/* Echo Dots */}
        <circle cx="32" cy="27" r="1.5" fill="#e2e8f0" />
        <circle cx="28" cy="31" r="1" fill="#e2e8f0" />
        <circle cx="35" cy="30" r="1" fill="#e2e8f0" />
        {/* Console Stand & Base */}
        <rect x="29" y="38" width="6" height="6" fill="currentColor" />
        <rect x="18" y="44" width="28" height="7" rx="2" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Trackball */}
        <circle cx="32" cy="47.5" r="2.5" fill="#0284c7" />
        {/* Gain Dials */}
        <circle cx="24" cy="47.5" r="1.5" fill="currentColor" fillOpacity="0.6" />
        <circle cx="40" cy="47.5" r="1.5" fill="currentColor" fillOpacity="0.6" />
      </svg>
    ),
  },
  {
    id: "sono-echo",
    name: "Cardiac Echocardiographer",
    role: "sonographer",
    categoryLabel: "Sonographer",
    description: "Phased array cardiac specialist tracking 4-chamber ejection fraction",
    bgGradient: "from-rose-500/20 to-pink-500/10",
    accentColor: "text-rose-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Heart Silhouette */}
        <path d="M32 47C32 47 18 38 18 27C18 21.5 22.5 17 28 17C30.5 17 32 18.5 32 18.5C32 18.5 33.5 17 36 17C41.5 17 46 21.5 46 27C46 38 32 47 32 47Z" stroke="#e11d48" strokeWidth="2.5" fill="#ffe4e6" />
        {/* Sound Pulse Beams Crossing Heart */}
        <path d="M24 28L32 14L40 28" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Valve Sparkle */}
        <circle cx="32" cy="29" r="2.5" fill="#e11d48" />
        <line x1="26" y1="34" x2="38" y2="34" stroke="#e11d48" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    ),
  },

  // ==========================================
  // 3. ADMINISTRATOR DOODLES
  // ==========================================
  {
    id: "admin-shield",
    name: "Governance & Shield",
    role: "admin",
    categoryLabel: "Admin",
    description: "Hospital compliance officer guarding HIPAA safety and tamper-evident audit logs",
    bgGradient: "from-indigo-500/20 to-slate-500/10",
    accentColor: "text-indigo-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Shield Body */}
        <path d="M32 12L46 17V30C46 41 39 49 32 52C25 49 18 41 18 30V17L32 12Z" stroke="currentColor" strokeWidth="2.5" fill="white" strokeLinejoin="round" />
        {/* Inner Shield Shade */}
        <path d="M32 14L44 18.5V30C44 39.5 38 47 32 50V14Z" fill="#6366f1" fillOpacity="0.15" />
        {/* Medical Check / Cross */}
        <path d="M26 31L30 35L38 27" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Trust Star */}
        <circle cx="32" cy="42" r="2" fill="#eab308" />
      </svg>
    ),
  },
  {
    id: "admin-headset",
    name: "Clinical Operations Lead",
    role: "admin",
    categoryLabel: "Admin",
    description: "Radiology department coordinator managing patient worklists and turn-around time",
    bgGradient: "from-teal-500/20 to-blue-500/10",
    accentColor: "text-teal-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Head */}
        <circle cx="32" cy="24" r="10" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Headset Band */}
        <path d="M20 25C20 17 25 12 32 12C39 12 44 17 44 25" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Headset Earpiece */}
        <rect x="18" y="21" width="4" height="8" rx="2" fill="#0d9488" stroke="white" strokeWidth="1" />
        <rect x="42" y="21" width="4" height="8" rx="2" fill="#0d9488" stroke="white" strokeWidth="1" />
        {/* Headset Mic */}
        <path d="M42 27L36 33H33" stroke="#0d9488" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="32" cy="33" r="1.5" fill="#0d9488" />
        {/* Shoulders */}
        <path d="M16 52C16 43 23 38 32 38C41 38 48 43 48 52" stroke="currentColor" strokeWidth="2.5" fill="white" strokeLinecap="round" />
        {/* ID Badge */}
        <rect x="29" y="42" width="6" height="8" rx="1" fill="#0d9488" stroke="white" strokeWidth="0.8" />
      </svg>
    ),
  },
  {
    id: "admin-analytics",
    name: "Quality & Metrics Director",
    role: "admin",
    categoryLabel: "Admin",
    description: "Analytics administrator tracking HL7 dispatch uptime and clinical accuracy",
    bgGradient: "from-blue-500/20 to-indigo-500/10",
    accentColor: "text-blue-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Chart Frame */}
        <rect x="14" y="14" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2.5" fill="white" />
        {/* Grid Axis */}
        <line x1="20" y1="42" x2="44" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="20" x2="20" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        {/* Bars */}
        <rect x="23" y="32" width="4" height="10" rx="1" fill="#93c5fd" />
        <rect x="30" y="26" width="4" height="16" rx="1" fill="#60a5fa" />
        <rect x="37" y="21" width="4" height="21" rx="1" fill="#2563eb" />
        {/* Upward Growth Arrow */}
        <path d="M22 30L29 23L36 26L43 18M43 18H38M43 18V23" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "admin-keymaster",
    name: "PACS Keymaster",
    role: "admin",
    categoryLabel: "Admin",
    description: "Hospital IT administrator managing secure DICOMweb tokens and service keys",
    bgGradient: "from-amber-500/20 to-yellow-500/10",
    accentColor: "text-amber-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Brass Security Key */}
        <circle cx="26" cy="26" r="10" stroke="currentColor" strokeWidth="2.5" fill="white" />
        <circle cx="26" cy="26" r="4" fill="#f59e0b" stroke="currentColor" strokeWidth="1.5" />
        {/* Key Shaft */}
        <line x1="33" y1="33" x2="48" y2="48" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        {/* Teeth */}
        <line x1="42" y1="42" x2="46" y2="38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="46" y1="46" x2="50" y2="42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Verified Lock Badge */}
        <circle cx="48" cy="18" r="4" fill="#10b981" />
        <path d="M46.5 18L47.5 19L49.5 17" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },

  // ==========================================
  // 4. PLAYFUL & UNIVERSAL CLINICAL DOODLES
  // ==========================================
  {
    id: "med-heart",
    name: "Friendly Pulse Heart",
    role: "general",
    categoryLabel: "Universal",
    description: "Smiling myocardium heart with clinical bandage and vibrant pulse",
    bgGradient: "from-rose-500/20 to-red-500/10",
    accentColor: "text-rose-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Heart */}
        <path d="M32 50C32 50 16 39 16 26C16 19.5 21.5 14 28 14C30.5 14 32 15.5 32 15.5C32 15.5 33.5 14 36 14C42.5 14 48 19.5 48 26C48 39 32 50 32 50Z" stroke="#f43f5e" strokeWidth="2.5" fill="#fff1f2" />
        {/* Bandage */}
        <rect x="23" y="27" width="18" height="6" rx="2" transform="rotate(-25 23 27)" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5" />
        {/* Eyes & Smile */}
        <circle cx="27" cy="24" r="1.5" fill="#881337" />
        <circle cx="37" cy="24" r="1.5" fill="#881337" />
        <path d="M30 33C31 34.5 33 34.5 34 33" stroke="#881337" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "med-dna",
    name: "Double-Helix Helix",
    role: "general",
    categoryLabel: "Universal",
    description: "Genomic double-helix strand representing precision medicine",
    bgGradient: "from-purple-500/20 to-indigo-500/10",
    accentColor: "text-purple-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* DNA Strands */}
        <path d="M22 14C22 22 42 26 42 34C42 42 22 46 22 50" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M42 14C42 22 22 26 22 34C22 42 42 46 42 50" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Cross rungs */}
        <line x1="25" y1="18" x2="39" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="28" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="28" y1="44" x2="36" y2="44" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="25" y1="48" x2="39" y2="48" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "med-microscope",
    name: "High-Power Objective",
    role: "general",
    categoryLabel: "Universal",
    description: "Laboratory microscope exploring cellular histology and tissue specimens",
    bgGradient: "from-teal-500/20 to-sky-500/10",
    accentColor: "text-teal-500",
    render: ({ className = "h-full w-full" }) => (
      <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="32" cy="32" r="30" fill="currentColor" fillOpacity="0.12" />
        {/* Microscope Base */}
        <path d="M18 50H46" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <rect x="26" y="44" width="12" height="6" stroke="currentColor" strokeWidth="2" fill="white" />
        {/* Stage */}
        <line x1="22" y1="36" x2="42" y2="36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        {/* Arm */}
        <path d="M38 44C38 32 46 26 42 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* Eyepiece / Body Tube */}
        <line x1="26" y1="18" x2="36" y2="28" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="16" r="3" fill="#0d9488" stroke="white" strokeWidth="1" />
        <line x1="34" y1="30" x2="33" y2="35" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const DEFAULT_ROLE_DOODLES: Record<string, string> = {
  doctor: "doc-stethoscope",
  radiologist: "doc-neuro",
  sonographer: "sono-probe",
  admin: "admin-shield",
};

export function getDefaultDoodleForRole(role?: string | null): string {
  if (!role) return "doc-stethoscope";
  return DEFAULT_ROLE_DOODLES[role.toLowerCase()] || "doc-stethoscope";
}

export function getDoodleById(id?: string | null): ClinicalDoodle | undefined {
  if (!id) return undefined;
  return CLINICAL_DOODLES.find((d) => d.id === id);
}

export function getDoodlesForRole(roleFilter: string): ClinicalDoodle[] {
  if (roleFilter === "all") return CLINICAL_DOODLES;
  if (roleFilter === "general") return CLINICAL_DOODLES.filter((d) => d.role === "general");
  return CLINICAL_DOODLES.filter((d) => d.role === roleFilter || d.role === "general");
}

const DOODLE_STORAGE_KEY_PREFIX = "sonolynx_user_doodle_";

export function getStoredDoodleId(userId?: string | null, role?: string | null): string {
  if (typeof window === "undefined") return getDefaultDoodleForRole(role);
  try {
    const key = `${DOODLE_STORAGE_KEY_PREFIX}${userId || "active"}`;
    const stored = localStorage.getItem(key);
    if (stored && CLINICAL_DOODLES.some((d) => d.id === stored)) {
      return stored;
    }
    // Fallback: check general role storage
    if (role) {
      const roleStored = localStorage.getItem(`${DOODLE_STORAGE_KEY_PREFIX}${role}`);
      if (roleStored && CLINICAL_DOODLES.some((d) => d.id === roleStored)) {
        return roleStored;
      }
    }
  } catch {}
  return getDefaultDoodleForRole(role);
}

export function saveUserDoodleId(doodleId: string, userId?: string | null, role?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const key = `${DOODLE_STORAGE_KEY_PREFIX}${userId || "active"}`;
    localStorage.setItem(key, doodleId);
    if (role) {
      localStorage.setItem(`${DOODLE_STORAGE_KEY_PREFIX}${role}`, doodleId);
    }
    window.dispatchEvent(
      new CustomEvent("sonolynx_doodle_changed", {
        detail: { doodleId, userId, role },
      })
    );
  } catch {}
}

// React Context & Hook for instant reactive updates across the entire app
interface ClinicalDoodleContextValue {
  activeDoodleId: string;
  activeDoodle: ClinicalDoodle;
  setDoodleId: (id: string) => void;
  openPicker: boolean;
  setOpenPicker: (open: boolean) => void;
}

const ClinicalDoodleContext = createContext<ClinicalDoodleContextValue | undefined>(undefined);

export function ClinicalDoodleProvider({
  children,
  userId,
  role,
}: {
  children: React.ReactNode;
  userId?: string | null;
  role?: string | null;
}) {
  const [doodleId, setDoodleIdState] = useState<string>(() => getStoredDoodleId(userId, role));
  const [openPicker, setOpenPicker] = useState(false);

  useEffect(() => {
    setDoodleIdState(getStoredDoodleId(userId, role));
  }, [userId, role]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(DOODLE_STORAGE_KEY_PREFIX)) {
        setDoodleIdState(getStoredDoodleId(userId, role));
      }
    };
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<{ doodleId: string }>;
      if (customEvent.detail?.doodleId) {
        setDoodleIdState(customEvent.detail.doodleId);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("sonolynx_doodle_changed", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sonolynx_doodle_changed", handleCustom);
    };
  }, [userId, role]);

  const setDoodleId = (newId: string) => {
    setDoodleIdState(newId);
    saveUserDoodleId(newId, userId, role);
  };

  const activeDoodle = getDoodleById(doodleId) || CLINICAL_DOODLES[0];

  return (
    <ClinicalDoodleContext.Provider
      value={{
        activeDoodleId: doodleId,
        activeDoodle,
        setDoodleId,
        openPicker,
        setOpenPicker,
      }}
    >
      {children}
    </ClinicalDoodleContext.Provider>
  );
}

export function useClinicalDoodle() {
  const ctx = useContext(ClinicalDoodleContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    const activeDoodle = CLINICAL_DOODLES[0];
    return {
      activeDoodleId: activeDoodle.id,
      activeDoodle,
      setDoodleId: () => {},
      openPicker: false,
      setOpenPicker: () => {},
    };
  }
  return ctx;
}
