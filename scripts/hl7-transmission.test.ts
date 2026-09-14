import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://review.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-key";

const { supabase } = await import("../src/integrations/supabase/client");
const { transmitHl7 } = await import("../src/lib/hl7-service");

test("transmitHl7 falls back to local receiver when external gateway throws network error", async (t) => {
  const originalEnv = process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL;
  process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL = "https://external-gateway.hospital.internal/api/oru";

  const calls: string[] = [];
  t.mock.method(supabase.auth, "getSession", async () => ({
    data: { session: { access_token: "test-token" } },
    error: null,
  }) as any);

  let hl7Record: any = { id: "hl7-msg-1", status: "pending" };
  t.mock.method(supabase, "from", ((table: string) => {
    const query: any = {
      insert: (payload: any) => {
        hl7Record = { ...hl7Record, ...payload, id: "hl7-msg-1" };
        return query;
      },
      update: (patch: any) => {
        hl7Record = { ...hl7Record, ...patch };
        return query;
      },
      select: () => query,
      eq: () => query,
      single: async () => ({ data: hl7Record, error: null }),
    };
    return query;
  }) as any);

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const urlStr = url.toString();
    calls.push(urlStr);
    if (urlStr.includes("external-gateway")) {
      throw new TypeError("Failed to fetch");
    }
    if (urlStr.includes("/api/hl7/transmit")) {
      return Response.json({ status: "success", mock: true, messageId: "MOCK-999" });
    }
    return new Response("Not Found", { status: 404 });
  });

  try {
    const result = await transmitHl7({
      organizationId: "org-1",
      patientId: "pat-1",
      studyId: "study-1",
      worksheetId: "ws-1",
      accessionNumber: "ACC-123",
      payload: "MSH|^~\\&|...",
      userId: "user-1",
    });

    assert.equal(result.ok, true);
    assert.equal(result.demo, true);
    assert.ok(calls.some((c) => c.includes("external-gateway")));
    assert.ok(calls.some((c) => c.includes("/api/hl7/transmit")));
    assert.equal(hl7Record.status, "sent");
  } finally {
    process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL = originalEnv;
  }
});

test("transmitHl7 skips dead soulflow.ai domain and goes directly to local receiver", async (t) => {
  const originalEnv = process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL;
  process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL = "https://hl7-gateway.soulflow.ai/api/oru";

  const calls: string[] = [];
  t.mock.method(supabase.auth, "getSession", async () => ({
    data: { session: { access_token: "test-token" } },
    error: null,
  }) as any);

  let hl7Record: any = { id: "hl7-msg-2", status: "pending" };
  t.mock.method(supabase, "from", ((table: string) => {
    const query: any = {
      insert: (payload: any) => {
        hl7Record = { ...hl7Record, ...payload, id: "hl7-msg-2" };
        return query;
      },
      update: (patch: any) => {
        hl7Record = { ...hl7Record, ...patch };
        return query;
      },
      select: () => query,
      eq: () => query,
      single: async () => ({ data: hl7Record, error: null }),
    };
    return query;
  }) as any);

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const urlStr = url.toString();
    calls.push(urlStr);
    if (urlStr.includes("/api/hl7/transmit")) {
      return Response.json({ status: "success", mock: true, messageId: "MOCK-100" });
    }
    return new Response("Not Found", { status: 404 });
  });

  try {
    const result = await transmitHl7({
      organizationId: "org-1",
      patientId: "pat-1",
      studyId: "study-1",
      worksheetId: "ws-1",
      accessionNumber: "ACC-456",
      payload: "MSH|^~\\&|...",
      userId: "user-1",
    });

    assert.equal(result.ok, true);
    assert.equal(result.demo, true);
    assert.equal(calls.some((c) => c.includes("soulflow.ai")), false);
    assert.ok(calls.some((c) => c.includes("/api/hl7/transmit")));
  } finally {
    process.env.NEXT_PUBLIC_HL7_EXPORT_API_URL = originalEnv;
  }
});
