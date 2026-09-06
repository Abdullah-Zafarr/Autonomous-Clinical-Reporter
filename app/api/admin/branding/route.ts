import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { ensureUserOrganization } from "@/lib/org-provision-server";
import type { ReportBrandingSettings } from "@/lib/report-template-types";
import { isUserSuperAdmin } from "@/lib/super-admin";
import { resolveRole } from "@/lib/auth-role";
import { z } from "zod";

export const dynamic = "force-dynamic";

const brandingInputSchema = z.object({
  hospitalName: z.string().max(200),
  hospitalAddress: z.string().max(500),
  hospitalPhone: z.string().max(80),
  hospitalEmail: z.string().max(200),
  hospitalWebsite: z.string().max(500),
  logoUrl: z.string().max(2_500_000),
  showSonolynxBranding: z.boolean(),
  footerText: z.string().max(500),
}).strict();

async function ensureAdmin(req?: Request) {
  const supabase = await createServerClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data: bearerUser } = await supabase.auth.getUser(token);
      if (bearerUser?.user) user = bearerUser.user;
    }
  }

  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };

  const [{ data: profileRow }, { data: roles }] = await Promise.all([
    (supabase as any).from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  const isAdmin = (await isUserSuperAdmin(user)) || resolveRole(profileRow?.role, roles ?? []) === "admin";

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "Forbidden: admin role required" };
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("organization_id, email")
    .eq("id", user.id)
    .maybeSingle();

  let organizationId: string | null = profile?.organization_id ?? null;

  if (!organizationId) {
    // Auto-provision using service role to bypass RLS
    const email = profile?.email ?? user.email ?? "";
    organizationId = await ensureUserOrganization(user.id, email);
  }

  if (!organizationId) {
    return { ok: false as const, status: 400, error: "Unable to resolve organization. Please try again." };
  }

  return { ok: true as const, supabase, user, organizationId };
}

function sanitizeInput(input: ReportBrandingSettings): ReportBrandingSettings {
  const logoUrl = (input.logoUrl || "").trim();
  const allowed =
    logoUrl.startsWith("http://") ||
    logoUrl.startsWith("https://") ||
    /^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(logoUrl);
  return {
    hospitalName: (input.hospitalName || "").trim(),
    hospitalAddress: (input.hospitalAddress || "").trim(),
    hospitalPhone: (input.hospitalPhone || "").trim(),
    hospitalEmail: (input.hospitalEmail || "").trim(),
    hospitalWebsite: (input.hospitalWebsite || "").trim(),
    logoUrl: allowed && logoUrl.length <= 2_500_000 ? logoUrl : "",
    showSonolynxBranding: Boolean(input.showSonolynxBranding),
    footerText: (input.footerText || "").trim(),
  };
}

export async function GET(request: Request) {
  const auth = await ensureAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const db = auth.supabase as any;
    const { data, error } = await db
      .from("report_branding_settings")
      .select("*")
      .eq("organization_id", auth.organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ data: data ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await ensureAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const rawBody = await request.json().catch(() => null);
    const parsedBody = brandingInputSchema.safeParse(rawBody);
    if (!parsedBody.success || JSON.stringify(rawBody ?? {}).length > 2_600_000) {
      return NextResponse.json({ error: "Invalid or oversized branding settings." }, { status: 400 });
    }
    const payload = sanitizeInput(parsedBody.data);
    const db = auth.supabase as any;

    const { data: existing } = await db
      .from("report_branding_settings")
      .select("id")
      .eq("organization_id", auth.organizationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const record = {
      hospital_name: payload.hospitalName,
      hospital_address: payload.hospitalAddress,
      hospital_phone: payload.hospitalPhone,
      hospital_email: payload.hospitalEmail,
      hospital_website: payload.hospitalWebsite,
      logo_url: payload.logoUrl,
      footer_text: payload.footerText,
      show_sonolynx_branding: payload.showSonolynxBranding,
      organization_id: auth.organizationId,
      created_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing?.id) {
      result = await db.from("report_branding_settings").update(record).eq("id", existing.id).select("*").single();
    } else {
      result = await db.from("report_branding_settings").insert(record).select("*").single();
    }
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}
