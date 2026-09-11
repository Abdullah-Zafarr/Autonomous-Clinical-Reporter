"use client";

import { useEffect, useRef, useState } from "react";
import {
  Languages,
  MessageSquareText,
  Sparkles,
  Loader2,
  CheckCheck,
  Copy,
  Download,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { explanationLanguages } from "@/lib/report-ai-safety";
import { toast } from "sonner";

type Mode = "edit" | "explain";
interface Props {
  reportText: string;
  worksheetId?: string;
  signed: boolean;
  patientLabel: string;
  onApply: (text: string) => void;
}
interface Result {
  text: string;
  summary?: string;
  sourceHash?: string;
  sourceText?: string;
}
interface SpeechSession {
  start: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  lang: string;
}

export function ReportCopilot({ reportText, worksheetId, signed, patientLabel, onApply }: Props) {
  const [mode, setMode] = useState<Mode | null>(null);
  return (
    <>
      <section
        className="border-b bg-gradient-to-r from-primary/5 via-background to-transparent px-4 py-3 sm:px-5"
        aria-label="AI report tools"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>AI Report Tools</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Clinician reviewed</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            className="h-auto max-w-sm justify-start gap-2.5 whitespace-normal bg-background px-3 py-2 text-left hover:bg-blue-50/60 hover:border-blue-200 transition-all border-border shadow-xs"
            onClick={() => setMode("edit")}
          >
            <MessageSquareText className="h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <span className="block text-xs font-semibold text-foreground leading-tight">Edit Report with AI</span>
              <span className="block text-[10px] font-normal text-muted-foreground leading-tight">
                Ask for changes · Preview before applying
              </span>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto max-w-sm justify-start gap-2.5 whitespace-normal bg-background px-3 py-2 text-left hover:bg-primary/5 hover:border-primary/30 transition-all border-border shadow-xs"
            onClick={() => setMode("explain")}
          >
            <Languages className="h-4 w-4 shrink-0 text-primary" />
            <div>
              <span className="block text-xs font-semibold text-foreground leading-tight">Patient-friendly Explanation</span>
              <span className="block text-[10px] font-normal text-muted-foreground leading-tight">
                English · Urdu · More languages
              </span>
            </div>
          </Button>
        </div>
      </section>
      {mode && (
        <CopilotDialog
          {...{ reportText, worksheetId, signed, patientLabel, onApply }}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

function CopilotDialog({
  mode,
  onClose,
  reportText,
  worksheetId,
  signed,
  patientLabel,
  onApply,
}: Props & { mode: Mode; onClose: () => void }) {
  const editing = mode === "edit";
  const [instruction, setInstruction] = useState("");
  const [language, setLanguage] = useState<(typeof explanationLanguages)[number]>("English");
  const [result, setResult] = useState<Result | null>(null);
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [approval, setApproval] = useState<{ approvedAt: string; approvedBy: string } | null>(null);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechSession | null>(null);
  const controller = useRef<AbortController | null>(null);
  const rtl = language === "Urdu" || language === "Arabic";
  const stale = editing && !!result && original !== reportText;
  const available = editing ? !!reportText.trim() : signed && !!worksheetId;

  useEffect(
    () => () => {
      controller.current?.abort();
      recognition.current?.abort();
    },
    [],
  );

  async function request(body: unknown) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 60000);
    try {
      const response = await fetch("/api/report/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
      return data;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setResult(null);
    setApproval(null);
    setReviewed(false);
    recognition.current?.abort();
    setListening(false);
    const source = reportText;
    try {
      const data: Result = await request(
        editing
          ? { action: "edit", reportText: source, instruction }
          : { action: "explain", worksheetId, language },
      );
      setOriginal(editing ? source : (data.sourceText ?? ""));
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error && err.name !== "AbortError"
          ? err.message
          : "The request timed out or was cancelled. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!result || !reviewed) return;
    setBusy(true);
    setError("");
    try {
      const data = await request({
        action: "approve",
        worksheetId,
        language,
        sourceHash: result.sourceHash,
        explanation: result.text,
      });
      setApproval(data);
      toast.success("Explanation approved for sharing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  function dictate() {
    if (listening) {
      recognition.current?.abort();
      setListening(false);
      return;
    }
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechSession;
      webkitSpeechRecognition?: new () => SpeechSession;
    };
    const Speech = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Speech) {
      setError("Voice input is unavailable in this browser. Type your instruction below.");
      return;
    }
    const session = new Speech();
    recognition.current = session;
    session.lang = "en-US";
    session.onresult = (event) => {
      setInstruction((text) => `${text} ${event.results[0][0].transcript}`.trim());
      setResult(null);
      setReviewed(false);
    };
    session.onend = () => setListening(false);
    session.onerror = () => {
      setListening(false);
      setError("Voice input failed. Check microphone permission or type your instruction.");
    };
    try {
      session.start();
      setListening(true);
      setError("");
    } catch {
      setError("Unable to start the microphone. Type your instruction instead.");
    }
  }

  const exportText = () =>
    `${patientLabel}\nPatient-friendly explanation (${language})\n\n${result?.text}\n\nApproved by ${approval?.approvedBy} on ${approval?.approvedAt}\nAccompanies the signed clinical report.`;
  async function copy() {
    if (!approval) return;
    try {
      await navigator.clipboard.writeText(exportText());
      toast.success("Approved explanation copied");
    } catch {
      setError("Clipboard access failed. Use Download explanation instead.");
    }
  }
  function download() {
    if (!approval) return;
    const url = URL.createObjectURL(
      new Blob(["\ufeff", exportText()], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `patient-explanation-${language.toLowerCase()}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editing ? (
              <MessageSquareText className="h-5 w-5 text-blue-600" />
            ) : (
              <Languages className="h-5 w-5 text-primary" />
            )}
            {editing ? "Conversational Report Editing" : "Patient-friendly Explanation"}
          </DialogTitle>
          <DialogDescription>
            {patientLabel} ·{" "}
            {editing
              ? "Request a wording change, compare both versions, then apply it to your draft."
              : "Explain the saved signed report in the patient's language, review, and approve before sharing."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!available && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {editing
                ? "Create a report first to use conversational editing."
                : "Sign and finalize this report first. Patient explanations use the saved signed version."}
            </div>
          )}
          {editing ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {[
                  "Make the impression shorter",
                  "Use clearer wording without changing clinical meaning",
                  "Organize the findings by organ",
                ].map((prompt) => (
                  <Button
                    key={prompt}
                    size="sm"
                    variant="outline"
                    className="h-auto whitespace-normal text-xs"
                    disabled={busy}
                    onClick={() => {
                      setInstruction(prompt);
                      setResult(null);
                      setReviewed(false);
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="ai-edit-instruction" className="text-sm font-medium">
                  Your editing instruction
                </label>
                <Button size="sm" variant="outline" disabled={busy} onClick={dictate}>
                  {listening ? (
                    <MicOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Mic className="mr-2 h-4 w-4" />
                  )}
                  {listening ? "Stop listening" : "Speak instruction"}
                </Button>
              </div>
              <Textarea
                id="ai-edit-instruction"
                value={instruction}
                maxLength={1500}
                disabled={busy}
                onChange={(event) => {
                  setInstruction(event.target.value);
                  setResult(null);
                  setReviewed(false);
                }}
                placeholder={"Try: Move the sentence about the liver into Findings."}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="explanation-language" className="block text-sm font-medium">
                Patient's language
              </label>
              <select
                id="explanation-language"
                className="h-10 w-full rounded-md border bg-background px-3 sm:w-72"
                disabled={busy}
                value={language}
                onChange={(event) => {
                  setLanguage(event.target.value as typeof language);
                  setResult(null);
                  setApproval(null);
                  setReviewed(false);
                }}
              >
                {explanationLanguages.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Urdu and Arabic use right-to-left text. Review the chosen language before approving.
              </p>
            </div>
          )}
          <Button
            disabled={busy || !available || (editing && !instruction.trim())}
            onClick={generate}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {busy ? "Working…" : editing ? "Preview AI Changes" : "Generate Patient Explanation"}
          </Button>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {stale && (
            <p role="alert" className="text-sm text-amber-700">
              The report changed while this preview was open. Generate a fresh preview before
              applying.
            </p>
          )}
          {result && (
            <>
              <div className="rounded-md bg-muted p-3 text-xs">
                {editing
                  ? result.summary
                  : approval
                    ? `Approved for sharing by ${approval.approvedBy}`
                    : "Draft explanation · Awaiting clinician approval"}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    {editing ? "Before · Current report" : "Source · Signed clinical report"}
                  </h3>
                  <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                    {original}
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">
                    {editing ? "After · Proposed changes" : `Patient explanation · ${language}`}
                  </h3>
                  {editing ? (
                    <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-blue-200 bg-blue-50/30 p-4 text-sm leading-relaxed">
                      {result.text}
                    </div>
                  ) : (
                    <Textarea
                      aria-label="Review and edit patient explanation"
                      lang={
                        language === "Urdu"
                          ? "ur"
                          : language === "Arabic"
                            ? "ar"
                            : language === "Spanish"
                              ? "es"
                              : "en"
                      }
                      dir={rtl ? "rtl" : "ltr"}
                      className="min-h-64 text-sm leading-loose"
                      maxLength={24000}
                      value={result.text}
                      disabled={busy}
                      onChange={(event) => {
                        setResult({ ...result, text: event.target.value });
                        setApproval(null);
                        setReviewed(false);
                      }}
                    />
                  )}
                </section>
              </div>
              <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={reviewed}
                  disabled={busy || !!approval}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                <span>
                  {editing
                    ? "I reviewed the changes and confirmed measurements, laterality, and clinical meaning are preserved."
                    : "I reviewed this explanation against the signed report and approve its accuracy in the selected language."}
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <Button
                    disabled={busy || !reviewed || stale}
                    onClick={() => {
                      onApply(result.text);
                      toast.success("AI changes applied to the report draft");
                      onClose();
                    }}
                  >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Apply Changes to Draft
                  </Button>
                ) : (
                  <>
                    <Button
                      disabled={busy || !reviewed || !!approval || !result.text.trim()}
                      onClick={approve}
                    >
                      <CheckCheck className="mr-2 h-4 w-4" />
                      {approval ? "Approved for Sharing" : "Approve for Sharing"}
                    </Button>
                    <Button variant="outline" disabled={!approval || busy} onClick={copy}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Approved Text
                    </Button>
                    <Button variant="outline" disabled={!approval || busy} onClick={download}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Explanation
                    </Button>
                  </>
                )}
              </div>
              {!editing && (
                <p className="text-xs text-muted-foreground">
                  Changing the text or language requires a new approval. Copy or download the
                  approved explanation to share it through your clinic's usual process.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
