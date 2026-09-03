import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sonolynx.app"),
  title: "Sonolynx Radiology",
  description: "Sonolynx Radiology is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
  authors: [{ name: "Sonolynx Radiology" }],
  openGraph: {
    title: "Sonolynx Radiology",
    description: "Sonolynx Radiology is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
    type: "website",
    images: ["https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2f985cee-ba63-459a-a5a3-36cc55fddd80/id-preview-9b2da424--f97772e6-9921-4228-ad41-3fc1eadba51e.lovable.app-1776548218290.png"],
  },
  twitter: {
    card: "summary",
    site: "@Sonolynx",
    title: "Sonolynx Radiology",
    description: "Sonolynx Radiology is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
    images: ["/sonolynx-logo.png"],
  },
  icons: {
    icon: "/sonolynx-logo.png",
    shortcut: "/sonolynx-logo.png",
    apple: "/sonolynx-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
