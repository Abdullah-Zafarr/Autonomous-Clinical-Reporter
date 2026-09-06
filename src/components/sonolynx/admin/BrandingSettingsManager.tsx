"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ReportBrandingSettings } from "@/lib/report-template-types";
import { DEFAULT_BRANDING_SETTINGS, getBrandingSettings, updateBrandingSettings } from "@/lib/branding-service";

export function BrandingSettingsManager() {
  const [form, setForm] = useState<ReportBrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getBrandingSettings().then((settings) => {
      if (!active) return;
      setForm(settings);
    });
    return () => {
      active = false;
    };
  }, []);

  const onLogoUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage("Logo too large. Max 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      setForm((prev) => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      await updateBrandingSettings(form);
      setMessage("Branding settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save branding settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Hospital / Lab Branding</h3>
      <p className="mb-3 text-xs text-muted-foreground">Configure organization branding used in report templates.</p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Hospital Name" value={form.hospitalName} onChange={(value) => setForm((prev) => ({ ...prev, hospitalName: value }))} />
        <Field label="Hospital Phone" value={form.hospitalPhone} onChange={(value) => setForm((prev) => ({ ...prev, hospitalPhone: value }))} />
        <Field label="Hospital Email" value={form.hospitalEmail} onChange={(value) => setForm((prev) => ({ ...prev, hospitalEmail: value }))} />
        <Field label="Hospital Website" value={form.hospitalWebsite} onChange={(value) => setForm((prev) => ({ ...prev, hospitalWebsite: value }))} />
      </div>

      <div className="mt-3 space-y-1.5">
        <Label>Hospital Address</Label>
        <Textarea value={form.hospitalAddress} onChange={(event) => setForm((prev) => ({ ...prev, hospitalAddress: event.target.value }))} />
      </div>

      <div className="mt-3 space-y-1.5">
        <Label>Footer Text</Label>
        <Input value={form.footerText} onChange={(event) => setForm((prev) => ({ ...prev, footerText: event.target.value }))} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Logo URL</Label>
          <Input value={form.logoUrl} onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))} placeholder="https://example.com/logo.png" />
        </div>
        <div className="space-y-1.5">
          <Label>Upload Logo (PNG/JPG/WEBP/SVG)</Label>
          <Input type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" onChange={onLogoUpload} />
        </div>
      </div>

      {form.logoUrl && (
        <div className="mt-3 rounded-md border p-2">
          {/* Logo URLs are tenant-configured and may use any clinic domain. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={form.logoUrl} alt="Branding logo preview" width={180} height={60} className="h-14 w-auto object-contain" />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          id="showSonolynxBranding"
          type="checkbox"
          checked={form.showSonolynxBranding}
          onChange={(event) => setForm((prev) => ({ ...prev, showSonolynxBranding: event.target.checked }))}
        />
        <Label htmlFor="showSonolynxBranding">Show Sonolynx branding footer when tier rules allow</Label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Branding"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
