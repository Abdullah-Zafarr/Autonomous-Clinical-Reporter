import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { getServiceClient } from "@/lib/supabase-service";
import { isUserSuperAdmin } from "@/lib/super-admin";

interface DeletePatientPayload {
  patientId?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const { data: bearerUser } = await supabase.auth.getUser(token);
        if (bearerUser?.user) {
          user = bearerUser.user;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as DeletePatientPayload;
    const patientId = payload.patientId?.trim();
    if (!patientId) {
      return NextResponse.json({ error: "Missing patientId" }, { status: 400 });
    }

    const service = getServiceClient();
    if (!service) {
      return NextResponse.json({ error: "Database service unavailable" }, { status: 500 });
    }

    const isSuperAdmin = await isUserSuperAdmin(user, service);

    // Fetch patient record to verify existence and check organization boundary
    const { data: patient, error: findError } = await (service as any)
      .from("patients")
      .select("id, first_name, last_name, mrn, organization_id")
      .eq("id", patientId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!patient) {
      return NextResponse.json({ error: "Patient record not found" }, { status: 404 });
    }

    // Organization boundary validation
    if (!isSuperAdmin) {
      const { data: profile } = await (service as any)
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .maybeSingle();

      const userOrgId = profile?.organization_id;
      if (userOrgId && patient.organization_id && userOrgId !== patient.organization_id) {
        return NextResponse.json(
          { error: "Forbidden: Cannot delete patients outside your organization" },
          { status: 403 }
        );
      }
    }

    // Perform deletion with cascade
    // In PostgreSQL, studies/worksheets have ON DELETE CASCADE or SET NULL
    // Explicitly delete associated studies to be thorough and clean up storage
    const { error: deleteStudiesErr } = await (service as any)
      .from("studies")
      .delete()
      .eq("patient_id", patientId);

    if (deleteStudiesErr) {
      console.warn("[delete-patient] Warning deleting linked studies:", deleteStudiesErr.message);
    }

    const { error: deletePatientErr } = await (service as any)
      .from("patients")
      .delete()
      .eq("id", patientId);

    if (deletePatientErr) {
      return NextResponse.json({ error: deletePatientErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deletedPatientId: patientId,
      name: [patient.first_name, patient.last_name].map((s) => s?.trim()).filter(Boolean).join(" "),
      mrn: patient.mrn,
    });
  } catch (error: any) {
    console.error("[delete-patient] Internal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete patient" },
      { status: 500 }
    );
  }
}
