"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Mic,
  MicOff,
  Loader2,
  FileCheck,
  ShieldCheck,
  RotateCcw,
  Stethoscope,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examType: string;
  patient: {
    firstName: string;
    lastName: string;
    mrn: string;
    dob?: string;
  };
  currentReportText?: string;
  onApplyReport: (reportText: string) => void;
}

const SAMPLE_TEMPLATES: Record<string, string> = {
  "Normal Abdomen":
    "Liver normal size and homogeneous. Gallbladder normal without wall thickening or stones. CBD measures 4mm. Pancreas visualized and normal. Spleen normal size. Both kidneys normal in size with preserved corticomedullary differentiation, no hydronephrosis or stones. Aorta and IVC normal caliber. No ascites.",
  "Cholelithiasis":
    "Liver normal. Gallbladder shows multiple mobile echogenic foci with posterior acoustic shadowing consistent with gallstones. Gallbladder wall measures 2.5mm, no pericholecystic fluid, negative sonographic Murphy's sign. CBD measures 4.2mm. Kidneys normal.",
  "Normal Thyroid":
    "Right lobe measures 4.5 x 1.6 x 1.4 cm. Left lobe measures 4.3 x 1.5 x 1.3 cm. Isthmus measures 2.8 mm. Normal homogeneous parenchymal echotexture bilaterally without focal solid or cystic nodules. Normal vascularity on color Doppler. No cervical lymphadenopathy.",
  "Renal / Kidneys":
    "Right kidney measures 10.8 cm, left kidney measures 11.1 cm. Normal cortical thickness bilaterally. No hydronephrosis, calculus, or focal renal mass. Bladder is well-distended with thin, smooth walls and no intraluminal mass or calculus.",
};

export function AiReportAssistantDialog({
  open,
  onOpenChange,
  examType,
  patient,
  currentReportText = "",
  onApplyReport,
}: Props) {
  const [dictation, setDictation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech API for voice dictation
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (event.results[event.results.length - 1].isFinal) {
            setDictation((prev) => (prev ? `${prev} ${currentTranscript.trim()}` : currentTranscript.trim()));
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("[speech] Dictation recognition notice:", err);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.info("Microphone dictation not supported in this browser", {
        description: "You can type or paste measurements directly into the box.",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast.info("Listening...", { description: "Speak measurements or clinical observations." });
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  const handleGenerate = async () => {
    if (!dictation.trim()) {
      toast.error("Please enter measurements or observations first");
      return;
    }

    setGenerating(true);
    setGeneratedText("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/report/ai-assist", {
        method: "POST",
        headers,
        body: JSON.stringify({
          rawFindings: dictation,
          examType,
          patientInfo: patient,
          existingReportText: currentReportText,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Report drafting failed");
      }

      setGeneratedText(data.reportText);
      toast.success("Structured report generated!");
    } catch (err: any) {
      toast.error("Generation failed", {
        description: err?.message || "Could not generate report with AI.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleApply = () => {
    if (!generatedText) return;
    onApplyReport(generatedText);
    toast.success("AI draft inserted into report", {
      description: "Review and make any necessary adjustments before signing.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="space-y-1 pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                AI Clinical Report Drafter
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Physician Scribe Assistant
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Dictate or enter raw measurements. AI organizes your findings into a formal ACR radiology report.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Patient Context Tag */}
          <div className="flex items-center justify-between text-xs bg-muted/40 rounded-lg p-2.5 border">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-semibold text-foreground">
                {patient.lastName}, {patient.firstName}
              </span>
              <span className="text-muted-foreground">· MRN: {patient.mrn}</span>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {examType}
            </Badge>
          </div>

          {/* Quick Insert Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Clinical Presets:
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setDictation("")}
              >
                Clear Input
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SAMPLE_TEMPLATES).map(([name, text]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDictation(text)}
                  className="rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>

          {/* Doctor Dictation Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Doctor Findings & Measurements:
              </label>
              <Button
                type="button"
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs gap-1.5 transition-all",
                  isListening && "animate-pulse"
                )}
                onClick={toggleListening}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" /> Stop Voice
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" /> Voice Dictation
                  </>
                )}
              </Button>
            </div>
            <Textarea
              rows={4}
              placeholder="e.g. Liver 14.5cm homogeneous, Gallbladder wall 2.8mm clear, CBD 4mm, Pancreas unremarkable, Kidneys normal bilaterally, no focal masses, no hydronephrosis..."
              value={dictation}
              onChange={(e) => setDictation(e.target.value)}
              className="resize-none font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Action to Generate */}
          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs gap-2"
              disabled={generating || !dictation.trim()}
              onClick={handleGenerate}
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating Report Draft...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Structured Report
                </>
              )}
            </Button>
          </div>

          {/* Generated Result Area */}
          {generatedText && (
            <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-blue-600" />
                  Generated ACR Clinical Report Draft:
                </span>
                <span className="text-[10px] text-muted-foreground italic">
                  Editable preview
                </span>
              </div>
              <Textarea
                rows={10}
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                className="font-mono text-xs leading-relaxed bg-white border-blue-200 resize-y"
              />
            </div>
          )}

          {/* Regulatory & Safety Disclaimer */}
          <div className="flex items-start gap-2 rounded-md bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p>
              <strong>Clinical Guardrail:</strong> This tool functions strictly as an administrative transcription scribe to organize physician-provided observations into standard ACR report terminology. It does not provide autonomous medical advice, prescriptions, or patient management decisions.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>

          {generatedText ? (
            <Button
              type="button"
              onClick={handleApply}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5"
            >
              Insert into Report <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="text-[11px] text-muted-foreground italic">
              Click &quot;Generate Structured Report&quot; to review draft
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
