import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://radix.app"),
  title: "Radix Radiology",
  description: "Radix is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
  authors: [{ name: "Radix" }],
  openGraph: {
    title: "Radix Radiology",
    description: "Radix is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
    type: "website",
    images: ["/radix-logo.png"],
  },
  twitter: {
    card: "summary",
    site: "@Radix",
    title: "Radix Radiology",
    description: "Radix is a HIPAA-compliant platform for sonographers to document ultrasound findings and generate standardized reports.",
    images: ["/radix-logo.png"],
  },
  icons: {
    icon: "/radix-logo.png",
    shortcut: "/radix-logo.png",
    apple: "/radix-logo.png",
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
