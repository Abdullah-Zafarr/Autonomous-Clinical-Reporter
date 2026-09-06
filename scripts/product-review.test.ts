import test from "node:test";
import assert from "node:assert/strict";
import { defaultWorksheet, defaultThyroid, defaultOb, defaultVascular, type Patient } from "../src/lib/sonoflow-types";
import { generateReport, generateThyroidReport, generateObReport, generateVascularReport, validateExamWorksheet, buildHL7, escapeHl7Field, reportToText } from "../src/lib/report-engine";
import { worksheetFieldOptions } from "../src/lib/clinical-workflow-types";
import { DEFAULT_REPORT_TEMPLATES } from "../src/lib/default-report-templates";
import { fetchWithTimeout, postJson, ApiError } from "../src/lib/api-client";

// Pure rendering/service tests use a fake endpoint and never access a backend.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://review.invalid";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-key";
const { renderReportTemplate, evaluateConditionalBlocks } = await import("../src/lib/report-template-engine");
const { supabase } = await import("../src/integrations/supabase/client");
const { saveDraftWorksheet, markWorksheetSigned, updateWorksheetReview } = await import("../src/lib/worksheet-service");
const patient: Patient = { id: "qa", firstName: "Synthetic", lastName: "Review", mrn: "QA-1", dob: "1990-01-01", exam: "Abdomen" };

test("blank worksheets do not invent completed normal examinations", () => {
  assert.equal(generateReport(defaultWorksheet, []).findings.length, 0);
  for (const [generate, data] of [[generateThyroidReport, defaultThyroid], [generateObReport, defaultOb], [generateVascularReport, defaultVascular]] as const) {
    assert.equal((generate as (data: any) => { findings: string[] })(data).findings.length, 0);
  }
});

test("OB and vascular preserve entered findings without inventing a normal impression", () => {
  const ob = generateObReport({ ...defaultOb, gestationalAge: "20w 3d", fetalHeartRate: "145", placentaLocation: "Posterior", presentation: "Breech", biometryNotes: "BPD 48 mm" });
  assert.match(reportToText(ob), /posterior/);
  assert.match(reportToText(ob), /breech/);
  assert.match(reportToText(ob), /BPD 48 mm/);
  assert.doesNotMatch(reportToText(ob), /Single live intrauterine/);
  const vascular = generateVascularReport({ ...defaultVascular, vesselExamined: "Femoral vein", laterality: "Left", flowPatency: "Occluded", thrombusPresence: "Present", waveformNotes: "No flow recorded" });
  assert.match(reportToText(vascular), /left/);
  assert.match(reportToText(vascular), /occluded/);
  assert.match(reportToText(vascular), /Thrombus: present/);
  assert.doesNotMatch(reportToText(vascular), /No acute vascular/);
});

test("invalid numeric input blocks submission across worksheet types", () => {
  for (const bad of ["abc", "14cm", "NaN", "Infinity"]) {
    assert.ok(validateExamWorksheet("Abdomen", { ...defaultWorksheet, liver: { ...defaultWorksheet.liver, size: bad } }).some((i) => i.level === "error"));
    assert.ok(validateExamWorksheet("Thyroid", { ...defaultThyroid, isthmus: bad }).some((i) => i.level === "error"));
    assert.ok(validateExamWorksheet("OB", { ...defaultOb, fetalHeartRate: bad }).some((i) => i.level === "error"));
  }
  assert.equal(validateExamWorksheet("Abdomen", defaultWorksheet).filter((i) => i.level === "error").length, 0);
});

test("HL7 escapes delimiters and cannot inject extra segments", () => {
  const hl7 = buildHL7({ ...patient, lastName: "Review|Injected\rPID|other" }, "Line|one^two&three\\four\nNext", "QA|ACC");
  assert.equal(hl7.split("\r\n").filter((line) => line.startsWith("PID|")).length, 1);
  assert.match(hl7, /Review\\F\\Injected\\X0D\\PID\\F\\other/);
  assert.equal(escapeHl7Field("|^~&\\"), "\\F\\\\S\\\\R\\\\T\\\\E\\");
});

test("all report templates retain recommendations and additional notes", () => {
  const context = { patient, examType: "Thyroid" as const, accession: "QA-1", report: { findings: ["Nodule measures 2.5 cm."], impression: ["Thyroid nodule."], recommendations: ["Recorded follow-up recommendation."] }, additionalNotes: "Compare with prior examination." };
  for (const template of [null, ...DEFAULT_REPORT_TEMPLATES]) {
    const rendered = renderReportTemplate(template, context);
    assert.match(rendered.plainText, /2.5 cm/);
    assert.match(rendered.plainText, /Recorded follow-up recommendation/);
    assert.match(rendered.plainText, /Compare with prior examination/);
  }
});

test("conditional template blocks include only matching values", () => {
  const content = "{% if size >= 2 %}Size threshold{% endif %} {% if side == Left %}Left side{% endif %}";
  assert.equal(evaluateConditionalBlocks(content, { size: 3, side: "Left" }), "Size threshold Left side");
  assert.equal(evaluateConditionalBlocks(content, { size: 1, side: "Right" }).trim(), "");
});

test("correction field paths include nested nodule fields but exclude IDs", () => {
  const fields = worksheetFieldOptions({ nodules: [{ id: "internal", size: "2.5", location: "Left" }] }, "thyroid");
  assert.deepEqual(fields.map((field) => field.path), ["thyroid.nodules.0.size", "thyroid.nodules.0.location"]);
  assert.equal(fields[0].value, "2.5");
});

test("API errors do not retry authorization failures", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response("Unauthorized", { status: 401 }); });
  await assert.rejects(fetchWithTimeout("https://review.invalid", { retries: 3, retryDelayMs: 0 }), (e: unknown) => e instanceof ApiError && e.status === 401);
  assert.equal(calls, 1);
});

test("API retries transient failures and parses JSON", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return calls === 1 ? new Response("Busy", { status: 503 }) : Response.json({ ok: true }); });
  assert.deepEqual(await postJson("https://review.invalid", {}, { retries: 1, retryDelayMs: 0 }), { ok: true });
  assert.equal(calls, 2);
});

test("caller cancellation does not retry a request", async (t) => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new DOMException("Aborted", "AbortError"); });
  await assert.rejects(fetchWithTimeout("https://review.invalid", { signal: controller.signal, retries: 3 }));
  assert.equal(calls, 1);
});

test("worksheet revisions retain authorship and signing uses unsigned-row guards", async (t) => {
  const calls: Array<{ table: string; method: string; args: any[] }> = [];
  let existing: any = { status: "draft", signed_at: null, signed_by: null, user_id: "sonographer", created_by: "sonographer", sonographer_id: "sonographer" };
  t.mock.method(supabase.auth, "getSession", async () => ({ data: { session: { user: { id: "doctor" } } }, error: null }) as any);
  t.mock.method(supabase, "from", ((table: string) => {
    let mutation: any = null;
    const result = () => ({ data: table === "profiles" ? { organization_id: "clinic" } : mutation ? { ...mutation, id: mutation.id || "new-revision", data: mutation.data, worksheet_type: "Abdomen" } : existing, error: null });
    const query: any = { then: (resolve: any) => Promise.resolve(result()).then(resolve) };
    for (const method of ["select", "eq", "is", "insert", "update"]) query[method] = (...args: any[]) => { calls.push({ table, method, args }); if (method === "insert" || method === "update") mutation = args[0]; return query; };
    query.maybeSingle = query.single = async () => result();
    return query;
  }) as any);
  const data = { abdomen: defaultWorksheet, thyroid: defaultThyroid, ob: defaultOb, vascular: defaultVascular, additionalNotes: "" };
  const params = { worksheetId: "original", patientId: "patient", studyId: "study", userId: "doctor", worksheetType: "Abdomen" as const, data, reportText: "Reviewed text" };
  await saveDraftWorksheet(params);
  const first = calls.find((call) => call.method === "update")!.args[0];
  assert.equal(first.sonographer_id, "sonographer");
  assert.equal(first.created_by, "sonographer");
  calls.length = 0;
  existing = { ...existing, signed_at: "2026-09-06", signed_by: "doctor", status: "signed" };
  await saveDraftWorksheet(params);
  assert.equal(calls.find((call) => call.method === "insert")!.args[0].id, undefined);
  calls.length = 0;
  await markWorksheetSigned({ worksheetId: "new-revision", userId: "doctor", data, reportText: "Reviewed text" });
  assert.ok(calls.some((call) => call.method === "is" && call.args[0] === "signed_at" && call.args[1] === null));
  calls.length = 0;
  await updateWorksheetReview({ worksheetId: "draft", studyId: "study", data, studyStatus: "correction_requested" });
  assert.ok(calls.some((call) => call.method === "is" && call.args[0] === "signed_by"));
});
