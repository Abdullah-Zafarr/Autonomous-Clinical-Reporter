import { useEffect, useRef, useState, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Save, Send, Code2, CheckCircle2, Mic, MicOff, Sparkles, FileText, Loader2, 
  GripVertical, X, Activity, Droplet, Shield, Microscope, GitFork, Waves, 
  Binary, Spline, Plus, Printer
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  useDroppable,
  defaultDropAnimationSideEffects,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

import type {
  WorksheetData,
  ThyroidData,
  ObData,
  VascularData,
  ExamType,
  LiverEcho,
  GbContent,
  FocalLesion,
  LiverSurface,
  MurphysSign,
  DuctState,
  Hydronephrosis,
  KidneyEcho,
  RenalStone,
  SpleenEcho,
  PancreasVisualized,
  PancreasEcho,
  AortaState,
  IvcState,
  Ascites,
} from "@/lib/sonoflow-types";
import { ThyroidWorksheet } from "./ThyroidWorksheet";
import { Logo } from "../sonolynx/Logo";

interface Props {
  data: WorksheetData;
  onChange: (d: WorksheetData) => void;
  thyroid: ThyroidData;
  onThyroidChange: (d: ThyroidData) => void;
  ob: ObData;
  onObChange: (d: ObData) => void;
  vascular: VascularData;
  onVascularChange: (d: VascularData) => void;
  exam: ExamType;
  onExamChange: (e: ExamType) => void;
  abdomenOrder: string[];
  onAbdomenOrderChange: (order: string[]) => void;
  onSaveDraft: () => void;
  onSign: () => void;
  onInspectHL7: () => void;
  onGenerateReport: () => void;
  lastSavedLabel: string;
  additionalNotes: string;
  onAdditionalNotesChange: (v: string) => void;
  validationIssues?: any[];
  canSignAndSend?: boolean;
  sendingReport?: boolean;
  sendingToDoctor?: boolean;
  savingDraft?: boolean;
  isDoctorMode?: boolean;
  isCompact?: boolean;
}

const GLADIA_SAMPLE_RATE = 16000;

function FieldError({ field, issues }: { field: string; issues: any[] }) {
  const issue = issues.find((i) => i.field === field || field.startsWith(i.field + "."));
  if (!issue) return null;
  return (
    <p className={cn(
      "text-[10px] font-bold mt-1",
      issue.level === "error" ? "text-red-600" : "text-amber-600"
    )}>
      {issue.message}
    </p>
  );
}

function getFieldLevel(field: string, issues: any[]): "error" | "warning" | null {
  const issue = issues.find((i) => i.field === field || field.startsWith(i.field + "."));
  return issue ? issue.level as any : null;
}

const ORGAN_METADATA: Record<string, { label: string; icon: any; color: string }> = {
  liver: { label: "Liver", icon: Activity, color: "text-red-500" },
  gallbladder: { label: "Gallbladder", icon: Droplet, color: "text-emerald-500" },
  biliary: { label: "Biliary", icon: Spline, color: "text-green-500" },
  kidneys: { label: "Kidneys", icon: Shield, color: "text-blue-500" },
  spleen: { label: "Spleen", icon: Microscope, color: "text-purple-500" },
  pancreas: { label: "Pancreas", icon: Binary, color: "text-orange-500" },
  vessels: { label: "Vessels", icon: GitFork, color: "text-slate-500" },
  ascites: { label: "Ascites", icon: Waves, color: "text-cyan-500" },
};

function WorksheetDroppableArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "worksheet-area",
  });

  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        "min-h-[400px] rounded-xl transition-colors duration-200",
        isOver && "bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}

function DraggableOrganButton({ id, meta, isActive, onAdd }: { id: string; meta: any; isActive: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${id}`,
    data: {
      type: "palette-item",
      organId: id
    }
  });

  const Icon = meta.icon;

  return (
    <Button
      ref={setNodeRef}
      variant="outline"
      size="sm"
      onClick={onAdd}
      className={cn(
        "h-8 shrink-0 gap-1.5 bg-card hover:border-primary/50 transition-all",
        isActive && "border-primary/30 opacity-60",
        isDragging && "opacity-20 grayscale"
      )}
      {...attributes}
      {...listeners}
    >
      <Icon className="h-3.5 w-3.5 text-primary/70" />
      <span className="text-[13px]">{meta.label}</span>
    </Button>
  );
}

function SortableOrganSection({ id, children, onRemove, isDoctorMode }: { id: string; children: React.ReactNode; onRemove: () => void; isDoctorMode?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(
        "group relative mb-3 transition-opacity",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className={cn("absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100", isDragging && "hidden")}>
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      
      {!isDoctorMode && (
        <div className={cn("flex items-center justify-between absolute right-12 top-4 z-10 opacity-0 transition-opacity group-hover:opacity-100", isDragging && "hidden")}>
           <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
           >
              <X className="h-3 w-3" />
           </Button>
        </div>
      )}

      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RadioRow({
  value,
  options,
  onChange,
  name,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <div key={opt} className="flex items-center gap-2">
          <RadioGroupItem value={opt} id={`${name}-${opt}`} />
          <Label htmlFor={`${name}-${opt}`} className="text-sm font-normal cursor-pointer">
            {opt}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

function encodePcm16(samples: Float32Array) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

const ClinicalNotesSection = ({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (v: string) => void 
}) => (
  <div className="mt-8 border-t pt-6 pb-2">
    <div className="flex items-center justify-between mb-3">
      <Label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        <FileText className="h-3 w-3" /> Additional Clinical Notes
      </Label>
      {value && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onChange("")}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
        >
          Clear
        </Button>
      )}
    </div>
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Any additional observations, patient history, or clinical context..."
      className="min-h-[80px] bg-muted/5 text-sm resize-none transition-all focus:ring-1 focus:ring-primary/20 border-dashed"
    />
    <p className="mt-2 text-[10px] text-muted-foreground/60 italic">
      Findings entered here are automatically integrated into the final clinical report.
    </p>
  </div>
);

export function ClinicalWorksheet({
  data,
  onChange,
  thyroid,
  onThyroidChange,
  ob,
  onObChange,
  vascular,
  onVascularChange,
  exam,
  onExamChange,
  abdomenOrder,
  onAbdomenOrderChange,
  onSaveDraft,
  onSign,
  onInspectHL7,
  onGenerateReport,
  lastSavedLabel,
  additionalNotes,
  onAdditionalNotesChange,
  validationIssues = [],
  canSignAndSend = true,
  sendingReport = false,
  sendingToDoctor = false,
  savingDraft = false,
  isDoctorMode = false,
  isCompact = false,
}: Props) {
  const [expandedItems, setExpandedItems] = useState<string[]>(abdomenOrder);
  const [activeId, setActiveId] = useState<string | null>(null);
  const prevOrderRef = useRef<string[]>(abdomenOrder);

  useEffect(() => {
    const newlyAdded = abdomenOrder.filter(id => !prevOrderRef.current.includes(id));
    if (newlyAdded.length > 0) {
      setExpandedItems(prev => [...prev, ...newlyAdded]);
    }
    prevOrderRef.current = abdomenOrder;
  }, [abdomenOrder]);

  const update = <K extends keyof WorksheetData>(section: K, patch: Partial<WorksheetData[K]>) =>
    onChange({ ...data, [section]: { ...data[section], ...patch } });
  const updateOb = (patch: Partial<ObData>) => onObChange({ ...ob, ...patch });
  const updateVascular = (patch: Partial<VascularData>) => onVascularChange({ ...vascular, ...patch });

  const [dictationText, setDictationText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sttMode, setSttMode] = useState<"deepgram" | "gladia" | "browser" | null>(null);
  const sttRef = useRef<{
    audioContext: AudioContext;
    processor: AudioWorkletNode;
    source: MediaStreamAudioSourceNode;
    stream: MediaStream;
    socket: WebSocket;
  } | null>(null);
  const browserSttRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");
  const partialTextRef = useRef<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const stopAudioSession = () => {
    const runtime = sttRef.current;
    sttRef.current = null;
    if (!runtime) return;
    try {
      runtime.audioContext.close();
    } catch {}
    try {
      runtime.stream.getTracks().forEach((track) => track.stop());
    } catch {}
    try {
      if (runtime.socket.readyState === WebSocket.OPEN || runtime.socket.readyState === WebSocket.CONNECTING) {
        runtime.socket.close();
      }
    } catch {}
  };

  const stopBrowserStt = () => {
    if (browserSttRef.current) {
      try {
        browserSttRef.current.stop();
      } catch {}
      browserSttRef.current = null;
    }
  };

  const stopListening = () => {
    stopAudioSession();
    stopBrowserStt();
    setIsListening(false);
    setSttMode(null);
  };

  useEffect(() => {
    return () => {
      stopAudioSession();
      stopBrowserStt();
    };
  }, []);

  const startBrowserStt = (fallbackReason?: string) => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser", {
        description: "Please use Chrome, Edge, or Safari, or check microphone permissions.",
      });
      setIsListening(false);
      setSttMode(null);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      baseTextRef.current = dictationText ? dictationText.replace(/\s+$/, "") + " " : "";

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) {
            baseTextRef.current += transcript.trim() + " ";
            setDictationText(baseTextRef.current.trimStart());
          } else {
            interim += transcript;
            setDictationText((baseTextRef.current + interim).trimStart());
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("[Browser STT] error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          toast.error("Microphone access denied", { description: "Please enable microphone permissions in your browser." });
          stopListening();
        }
      };

      recognition.onend = () => {
        // Only restart if the user didn't intentionally stop
        if (browserSttRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      browserSttRef.current = recognition;
      setSttMode("browser");
      setIsListening(true);
      toast.info("Using Browser Speech Recognition", {
        description: fallbackReason || "Live dictation ready.",
        duration: 3000,
      });
    } catch (e: any) {
      console.error("[Browser STT] startup error:", e);
      stopListening();
      toast.error("Could not start speech recognition", { description: e?.message || "Check microphone permissions." });
    }
  };

  const startListening = async () => {
    if (isListening) return;

    // 1. Try Deepgram Streaming (Medical Model)
    try {
      const tokenRes = await fetch("/api/stt/deepgram/token");
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const deepgramKey = tokenData?.key;

        if (deepgramKey) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          const audioContext = new AudioContext({ sampleRate: 16000 });
          await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");

          const source = audioContext.createMediaStreamSource(stream);
          const processor = new AudioWorkletNode(audioContext, "pcm-processor");
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.4;

          const socketUrl =
            "wss://api.deepgram.com/v1/listen?model=nova-2-medical&smart_format=true&encoding=linear16&sample_rate=16000";
          const socket = new WebSocket(socketUrl, ["token", deepgramKey]);

          baseTextRef.current = dictationText ? dictationText.replace(/\s+$/, "") + " " : "";

          socket.onopen = () => {
            processor.port.onmessage = (event) => {
              if (socket.readyState === WebSocket.OPEN && event.data) {
                const pcmBuffer = floatTo16BitPCM(event.data);
                socket.send(pcmBuffer);
              }
            };
            source.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(audioContext.destination);
          };

          socket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data);
              if (message.type === "Results") {
                const alt = message.channel?.alternatives?.[0];
                const text = alt?.transcript?.trim();
                if (!text) return;
                if (message.is_final) {
                  baseTextRef.current += text + " ";
                  partialTextRef.current = "";
                  setDictationText(baseTextRef.current.trimStart());
                } else {
                  partialTextRef.current = text;
                  setDictationText((baseTextRef.current + partialTextRef.current).trimStart());
                }
              }
            } catch (err) {
              console.warn("[Deepgram STT] message parse notice:", err);
            }
          };

          socket.onerror = (err) => {
            console.warn("[Deepgram STT] socket error, falling back to browser STT:", err);
            stopAudioSession();
            startBrowserStt("Switched to browser speech recognition.");
          };

          socket.onclose = (ev) => {
            if (!ev.wasClean && sttRef.current?.socket === socket) {
              stopAudioSession();
              startBrowserStt("Connection interrupted; switched to browser speech recognition.");
            }
          };

          sttRef.current = { audioContext, processor, source, stream, socket };
          setSttMode("deepgram");
          setIsListening(true);
          toast.success("Listening with Deepgram Medical AI", { duration: 2500 });
          return;
        }
      }
    } catch (deepgramError) {
      console.info("[STT] Deepgram initialization failed, attempting fallback:", deepgramError);
    }

    // 2. Try Gladia if available
    try {
      const sessionResponse = await fetch("/api/gladia/live", { method: "POST" });
      if (sessionResponse.ok) {
        const session = await sessionResponse.json();
        if (session.url) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          const audioContext = new AudioContext({ sampleRate: GLADIA_SAMPLE_RATE });
          await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");

          const source = audioContext.createMediaStreamSource(stream);
          const processor = new AudioWorkletNode(audioContext, "pcm-processor");
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.4;

          const socket = new WebSocket(session.url);
          baseTextRef.current = dictationText ? dictationText.replace(/\s+$/, "") + " " : "";

          socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "transcript") {
              const text = message.data?.utterance?.text?.trim();
              if (!text) return;
              if (message.data?.is_final) {
                baseTextRef.current += text + " ";
                partialTextRef.current = "";
                setDictationText(baseTextRef.current.trimStart());
              } else {
                partialTextRef.current = text;
                setDictationText((baseTextRef.current + partialTextRef.current).trimStart());
              }
            }
          };

          socket.onopen = () => {
            processor.port.onmessage = (event) => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "audio_chunk", data: { chunk: encodePcm16(event.data) } }));
              }
            };
            source.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(audioContext.destination);
          };

          sttRef.current = { audioContext, processor, source, stream, socket };
          setSttMode("gladia");
          setIsListening(true);
          toast.success("Listening with Gladia AI", { duration: 2500 });
          return;
        }
      }
    } catch (gladiaError) {
      console.info("[STT] Gladia initialization failed, using browser fallback:", gladiaError);
    }

    // 3. Guaranteed fallback: Browser Web Speech API
    startBrowserStt();
  };

  const handleProcess = async () => {
    const text = dictationText.trim();
    if (!text) return;
    setIsProcessing(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          currentState: { abdomen: data, thyroid, ob, vascular },
          currentExam: exam,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const updates = await response.json();
      
      if (updates.abdomen) {
        const next = { ...data };
        const newOrgans: string[] = [];
        Object.keys(updates.abdomen).forEach((key) => {
          const k = key as keyof WorksheetData;
          if (typeof updates.abdomen[k] === "object" && updates.abdomen[k] !== null) {
            next[k] = { ...next[k], ...updates.abdomen[k] } as any;
            if (!abdomenOrder.includes(k)) newOrgans.push(k);
          } else {
            next[k] = updates.abdomen[k] as any;
          }
        });
        if (newOrgans.length > 0) {
          onAbdomenOrderChange([...abdomenOrder, ...newOrgans]);
        }
        onChange(next);
      }
      if (updates.thyroid) {
        const next = { ...thyroid };
        Object.keys(updates.thyroid).forEach((key) => {
          const k = key as keyof ThyroidData;
          if (typeof updates.thyroid[k] === "object" && updates.thyroid[k] !== null && !Array.isArray(updates.thyroid[k])) {
            (next as any)[k] = { ...(next as any)[k], ...updates.thyroid[k] };
          } else {
            (next as any)[k] = updates.thyroid[k];
          }
        });
        onThyroidChange(next);
      }
      if (updates.ob) onObChange({ ...ob, ...updates.ob });
      if (updates.vascular) onVascularChange({ ...vascular, ...updates.vascular });
      if (updates.additionalNotes) {
        const current = additionalNotes?.trim() || "";
        const newNote = updates.additionalNotes.trim();
        if (newNote) {
          onAdditionalNotesChange(current ? `${current}\n${newNote}` : newNote);
        }
      }
      
      setDictationText("");
      toast.success("Findings extracted");
    } catch (e) {
      toast.error("Extraction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Handle dropping from palette
    if (active.data.current?.type === "palette-item") {
      const organId = active.data.current.organId;
      if (!abdomenOrder.includes(organId)) {
        const overIndex = abdomenOrder.indexOf(over.id as string);
        const nextOrder = [...abdomenOrder];
        if (overIndex === -1) {
          nextOrder.push(organId);
        } else {
          nextOrder.splice(overIndex, 0, organId);
        }
        onAbdomenOrderChange(nextOrder);
        toast.success(`${ORGAN_METADATA[organId].label} added to report`);
      } else {
        toast.info(`${ORGAN_METADATA[organId].label} is already in your report`);
      }
      return;
    }

    // Handle sorting existing items
    if (active.id !== over.id) {
      const oldIndex = abdomenOrder.indexOf(active.id as string);
      const newIndex = abdomenOrder.indexOf(over.id as string);
      onAbdomenOrderChange(arrayMove(abdomenOrder, oldIndex, newIndex));
    }
  };

  const addOrgan = (id: string) => {
    if (!abdomenOrder.includes(id)) {
      onAbdomenOrderChange([...abdomenOrder, id]);
      toast.success(`${ORGAN_METADATA[id].label} added to report`);
    } else {
      toast.info(`${ORGAN_METADATA[id].label} is already in your report`);
    }
  };

  const removeOrgan = (id: string) => {
    onAbdomenOrderChange(abdomenOrder.filter((o) => o !== id));
  };

  const renderOrganSection = (id: string) => {
    switch (id) {
      case "liver":
        return (
          <AccordionItem value="liver" key="liver" className={cn("rounded-lg border bg-card px-4", getFieldLevel("liver", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Liver</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Size (cm)">
                <Input
                  inputMode="decimal"
                  placeholder="e.g. 14.2"
                  value={data.liver.size}
                  onChange={(e) => update("liver", { size: e.target.value })}
                  className={cn(getFieldLevel("liver.size", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("liver.size", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="liver.size" issues={validationIssues} />
              </Field>
              <Field label="Echotexture">
                <Select value={data.liver.echotexture} onValueChange={(v) => update("liver", { echotexture: v as LiverEcho })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Homogeneous">Homogeneous</SelectItem>
                    <SelectItem value="Diffusely echogenic (fatty infiltration)">Diffusely echogenic (fatty infiltration)</SelectItem>
                    <SelectItem value="Coarse">Coarse</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Surface">
                <RadioRow name="liver-surface" value={data.liver.surface} options={["Smooth", "Nodular"]} onChange={(v) => update("liver", { surface: v as LiverSurface })} />
              </Field>
              <Field label="Focal Lesions">
                <RadioRow name="liver-focal" value={data.liver.focalLesions} options={["None", "Cyst", "Solid Mass"]} onChange={(v) => update("liver", { focalLesions: v as FocalLesion })} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "gallbladder":
        return (
          <AccordionItem value="gallbladder" key="gallbladder" className={cn("rounded-lg border bg-card px-4", getFieldLevel("gallbladder", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Gallbladder</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Wall Thickness (mm)">
                <Input 
                  inputMode="decimal" 
                  placeholder="e.g. 2.5" 
                  value={data.gallbladder.wallThickness} 
                  onChange={(e) => update("gallbladder", { wallThickness: e.target.value })} 
                  className={cn(getFieldLevel("gallbladder.wallThickness", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("gallbladder.wallThickness", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="gallbladder.wallThickness" issues={validationIssues} />
              </Field>
              <Field label="Content">
                <Select value={data.gallbladder.content} onValueChange={(v) => update("gallbladder", { content: v as GbContent })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clear">Clear</SelectItem>
                    <SelectItem value="Sludge">Sludge</SelectItem>
                    <SelectItem value="Gallstones">Gallstones</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Murphy's Sign">
                <RadioRow name="gb-murphy" value={data.gallbladder.murphysSign} options={["Negative", "Positive"]} onChange={(v) => update("gallbladder", { murphysSign: v as MurphysSign })} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "biliary":
        return (
          <AccordionItem value="biliary" key="biliary" className={cn("rounded-lg border bg-card px-4", getFieldLevel("biliary", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Biliary Tree</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Common Bile Duct / CBD (mm)">
                <Input 
                  inputMode="decimal" 
                  placeholder="e.g. 4" 
                  value={data.biliary.cbd} 
                  onChange={(e) => update("biliary", { cbd: e.target.value })} 
                  className={cn(getFieldLevel("biliary.cbd", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("biliary.cbd", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="biliary.cbd" issues={validationIssues} />
              </Field>
              <Field label="Intrahepatic Ducts">
                <RadioRow name="biliary-ihd" value={data.biliary.intrahepatic} options={["Normal", "Dilated"]} onChange={(v) => update("biliary", { intrahepatic: v as DuctState })} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "kidneys":
        return (
          <AccordionItem value="kidneys" key="kidneys" className={cn("rounded-lg border bg-card px-4", getFieldLevel("kidneys", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Kidneys</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Right (cm)">
                  <Input 
                    inputMode="decimal" 
                    value={data.kidneys.rightLength} 
                    onChange={(e) => update("kidneys", { rightLength: e.target.value })} 
                    className={cn(getFieldLevel("kidneys", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("kidneys", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                  />
                </Field>
                <Field label="Left (cm)">
                  <Input 
                    inputMode="decimal" 
                    value={data.kidneys.leftLength} 
                    onChange={(e) => update("kidneys", { leftLength: e.target.value })} 
                    className={cn(getFieldLevel("kidneys", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("kidneys", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                  />
                </Field>
              </div>
              <FieldError field="kidneys" issues={validationIssues} />
              <Field label="Hydronephrosis">
                <RadioRow name="kidney-hydro" value={data.kidneys.hydronephrosis} options={["None", "Mild", "Moderate", "Severe"]} onChange={(v) => update("kidneys", { hydronephrosis: v as Hydronephrosis })} />
              </Field>
              <Field label="Renal Stones">
                <RadioRow name="kidney-stones" value={data.kidneys.stones} options={["None", "Right", "Left", "Bilateral"]} onChange={(v) => update("kidneys", { stones: v as RenalStone })} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "spleen":
        return (
          <AccordionItem value="spleen" key="spleen" className={cn("rounded-lg border bg-card px-4", getFieldLevel("spleen", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Spleen</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Size (cm)">
                <Input 
                  inputMode="decimal" 
                  value={data.spleen.size} 
                  onChange={(e) => update("spleen", { size: e.target.value })} 
                  className={cn(getFieldLevel("spleen.size", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("spleen.size", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="spleen.size" issues={validationIssues} />
              </Field>
              <Field label="Echotexture"><RadioRow name="spleen-echo" value={data.spleen.echotexture} options={["Normal", "Heterogeneous"]} onChange={(v) => update("spleen", { echotexture: v as SpleenEcho })} /></Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "pancreas":
        return (
          <AccordionItem value="pancreas" key="pancreas" className={cn("rounded-lg border bg-card px-4", getFieldLevel("pancreas", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Pancreas</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Visualization">
                <Select value={data.pancreas.visualized} onValueChange={(v) => update("pancreas", { visualized: v as PancreasVisualized })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fully visualized">Fully visualized</SelectItem>
                    <SelectItem value="Partially visualized">Partially visualized</SelectItem>
                    <SelectItem value="Obscured by bowel gas">Obscured by bowel gas</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Main Duct (mm)">
                <Input 
                  inputMode="decimal" 
                  value={data.pancreas.ductMm} 
                  onChange={(e) => update("pancreas", { ductMm: e.target.value })} 
                  className={cn(getFieldLevel("pancreas.ductMm", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("pancreas.ductMm", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="pancreas.ductMm" issues={validationIssues} />
              </Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "vessels":
        return (
          <AccordionItem value="vessels" key="vessels" className={cn("rounded-lg border bg-card px-4", getFieldLevel("vessels", validationIssues) === "error" && "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]")}>
            <AccordionTrigger className="text-sm font-semibold">Vessels (Portal/Aorta/IVC)</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Portal Vein (mm)">
                <Input 
                  inputMode="decimal" 
                  value={data.vessels.portalVeinMm} 
                  onChange={(e) => update("vessels", { portalVeinMm: e.target.value })} 
                  className={cn(getFieldLevel("vessels.portalVeinMm", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("vessels.portalVeinMm", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="vessels.portalVeinMm" issues={validationIssues} />
              </Field>
              <Field label="Aorta AP (cm)">
                <Input 
                  inputMode="decimal" 
                  value={data.vessels.aortaMaxApCm} 
                  onChange={(e) => update("vessels", { aortaMaxApCm: e.target.value })} 
                  className={cn(getFieldLevel("vessels.aortaMaxApCm", validationIssues) === "error" && "border-red-500 bg-red-50/50", getFieldLevel("vessels.aortaMaxApCm", validationIssues) === "warning" && "border-amber-500 bg-amber-50/50")}
                />
                <FieldError field="vessels.aortaMaxApCm" issues={validationIssues} />
              </Field>
              <Field label="Aorta Appearance"><RadioRow name="aorta-state" value={data.vessels.aortaState} options={["Normal", "Ectatic", "Aneurysmal"]} onChange={(v) => update("vessels", { aortaState: v as AortaState })} /></Field>
            </AccordionContent>
          </AccordionItem>
        );
      case "ascites":
        return (
          <AccordionItem value="ascites" key="ascites" className="rounded-lg border bg-card px-4">
            <AccordionTrigger className="text-sm font-semibold">Ascites</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <Field label="Volume"><RadioRow name="ascites-volume" value={data.ascites.volume} options={["None", "Mild", "Moderate", "Large"]} onChange={(v) => update("ascites", { volume: v as Ascites })} /></Field>
            </AccordionContent>
          </AccordionItem>
        );
      default:
        return null;
    }
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo size="sm" className="opacity-90" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Clinical Worksheet</h2>
            <p className="text-[10px] text-muted-foreground">Structured findings · Auto-generates report in real time</p>
          </div>
        </div>
          <div className="flex items-center gap-2">
            {!isDoctorMode && (
              <span className={cn(
                "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                isListening ? "bg-red-500/10 text-red-600 animate-pulse" : "bg-muted text-muted-foreground"
              )}>
                <div className={cn("h-1.5 w-1.5 rounded-full", isListening ? "bg-red-500" : "bg-muted-foreground")} />
                {isListening
                  ? sttMode === "deepgram"
                    ? "Listening (Deepgram Medical)..."
                    : sttMode === "browser"
                      ? "Listening (Browser Speech)..."
                      : "Listening..."
                  : "Microphone Off"}
              </span>
            )}
          </div>
      </header>

      {/* Smart Dictation */}
      {!isDoctorMode && (
        <div className="border-b bg-card px-4 py-4 sm:px-6">
          <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-card p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Smart Clinical Dictation
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={isListening} onClick={startListening} className="h-8 gap-1.5"><Mic className="h-3.5 w-3.5" /> Start</Button>
                <Button size="sm" variant="destructive" disabled={!isListening} onClick={stopListening} className="h-8 gap-1.5"><MicOff className="h-3.5 w-3.5" /> Stop</Button>
                <div className="mx-2 h-4 w-px bg-border" />
                <Button size="sm" disabled={isProcessing || !dictationText.trim()} onClick={handleProcess} className="h-8 gap-1.5">
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isProcessing ? "Processing..." : "Process Text"}
                </Button>
              </div>
            </div>
            <Textarea
              value={dictationText}
              onChange={(e) => setDictationText(e.target.value)}
              placeholder="e.g. 'Fatty liver. Normal gallbladder...'"
              className="min-h-[80px] bg-background font-mono text-[13px]"
            />
          </div>
        </div>
      )}

      <Tabs value={exam} onValueChange={(v) => onExamChange(v as ExamType)} className="flex min-h-0 flex-1 flex-col">
        <div className="border-b bg-card px-4 pt-3 sm:px-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="Abdomen">Abdomen</TabsTrigger>
            <TabsTrigger value="Thyroid">Thyroid</TabsTrigger>
            <TabsTrigger value="OB">OB</TabsTrigger>
            <TabsTrigger value="Vascular">Vascular</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <TabsContent value="Abdomen" className="mt-0 outline-none">
            <DndContext 
              sensors={sensors} 
              collisionDetection={closestCenter} 
              onDragStart={(e) => setActiveId(e.active.id as string)}
              onDragEnd={(event) => {
                handleDragEnd(event);
                setActiveId(null);
              }}
              onDragCancel={() => setActiveId(null)}
              modifiers={[restrictToWindowEdges]}
            >
              {/* Organ Palette (Navbar) */}
              {!isDoctorMode && (
                <div className="bg-muted/30 px-4 py-2 sm:px-6 border-b mb-4 rounded-b-lg">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2 shrink-0">Add Organ:</span>
                    {Object.entries(ORGAN_METADATA).map(([id, meta]) => (
                      <DraggableOrganButton 
                        key={id} 
                        id={id} 
                        meta={meta} 
                        isActive={abdomenOrder.includes(id)} 
                        onAdd={() => addOrgan(id)} 
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="min-h-0 flex-1 px-4 py-4 sm:px-6">
                <WorksheetDroppableArea>
                  <SortableContext items={abdomenOrder} strategy={verticalListSortingStrategy}>
                    <Accordion 
                      type="multiple" 
                      value={expandedItems} 
                      onValueChange={setExpandedItems}
                      className="space-y-3"
                    >
                      {abdomenOrder.map((id) => (
                        <SortableOrganSection key={id} id={id} onRemove={() => removeOrgan(id)} isDoctorMode={isDoctorMode}>
                          {renderOrganSection(id)}
                        </SortableOrganSection>
                      ))}
                    </Accordion>
                    {abdomenOrder.length === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center h-[300px]">
                        <div className="rounded-full bg-primary/5 p-4 mb-4">
                          <Plus className="h-8 w-8 text-primary/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Your report is empty.</p>
                        <p className="text-xs text-muted-foreground">Drag organ icons from the top bar or click them to add.</p>
                      </div>
                    )}
                  </SortableContext>
                </WorksheetDroppableArea>

                <DragOverlay
                  dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({}),
                  }}
                >
                  {activeId ? (
                    activeId.startsWith("palette-") ? (
                      <div className="flex h-8 items-center gap-2 rounded-md border border-primary/50 bg-background px-3 py-1 shadow-lg opacity-80 cursor-grabbing">
                        {(() => {
                           const organId = activeId.replace("palette-", "");
                           const meta = ORGAN_METADATA[organId];
                           const Icon = meta.icon;
                           return (
                             <>
                               <Icon className="h-4 w-4 text-primary" />
                               <span className="text-sm font-medium">{meta.label}</span>
                             </>
                           );
                        })()}
                      </div>
                    ) : (
                      <div className="flex h-12 w-full items-center justify-between rounded-lg border-2 border-primary/50 bg-background px-6 shadow-xl opacity-90 cursor-grabbing">
                        <span className="font-semibold text-primary">{ORGAN_METADATA[activeId]?.label}</span>
                        <GripVertical className="h-5 w-5 text-primary" />
                      </div>
                    )
                  ) : null}
                </DragOverlay>
                
                <ClinicalNotesSection value={additionalNotes} onChange={onAdditionalNotesChange} />
              </div>
            </DndContext>
          </TabsContent>

          <TabsContent value="Thyroid" className="mt-0 p-4 sm:p-6">
            <ThyroidWorksheet data={thyroid} onChange={onThyroidChange} isDoctorMode={isDoctorMode} />
            <ClinicalNotesSection value={additionalNotes} onChange={onAdditionalNotesChange} />
          </TabsContent>
          
          <TabsContent value="OB" className="mt-0 p-4 sm:p-6">
             <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <Field label="Gestational Age"><Input placeholder="e.g. 20w 3d" value={ob.gestationalAge} onChange={(e) => updateOb({ gestationalAge: e.target.value })} /></Field>
                   <Field label="Fetal Heart Rate (bpm)"><Input value={ob.fetalHeartRate} onChange={(e) => updateOb({ fetalHeartRate: e.target.value })} /></Field>
                </div>
                <Field label="Impression"><Textarea value={ob.impression} onChange={(e) => updateOb({ impression: e.target.value })} /></Field>
             </div>
             <ClinicalNotesSection value={additionalNotes} onChange={onAdditionalNotesChange} />
          </TabsContent>

          <TabsContent value="Vascular" className="mt-0 p-4 sm:p-6">
             <div className="rounded-lg border bg-card p-4 space-y-4">
                <Field label="Vessel Examined"><Input value={vascular.vesselExamined} onChange={(e) => updateVascular({ vesselExamined: e.target.value })} /></Field>
                <Field label="Impression"><Textarea value={vascular.impression} onChange={(e) => updateVascular({ impression: e.target.value })} /></Field>
             </div>
             <ClinicalNotesSection value={additionalNotes} onChange={onAdditionalNotesChange} />
          </TabsContent>
        </div>

      </Tabs>

      <footer className="border-t bg-card px-3 py-2 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={onInspectHL7} className={cn("h-8 sm:h-9 gap-2 px-3", isCompact && "w-8 p-0")}>
              <Code2 className="h-4 w-4" /> 
              {!isCompact && <span>Inspect HL7</span>}
            </Button>
            <Button variant="outline" size="sm" onClick={onGenerateReport} className={cn("h-8 sm:h-9 gap-2 px-3", isCompact && "w-8 p-0")}>
              <FileText className="h-4 w-4" /> 
              {!isCompact && <span>Generate</span>}
            </Button>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            {!isCompact && (
              <div className="hidden xl:block text-right mr-1 shrink-0">
                {validationIssues.some(i => i.level === "error") ? (
                   <p className="text-[10px] font-bold text-red-600 uppercase">Blocked</p>
                ) : (
                   <p className="text-[10px] font-medium text-muted-foreground uppercase truncate max-w-[80px]">{lastSavedLabel}</p>
                )}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={savingDraft} className={cn("h-8 sm:h-9 gap-2 shrink-0 px-3", isCompact && "w-8 p-0")}>
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 
              {!isCompact && <span>Draft</span>}
            </Button>
            

            <Button 
              size="sm" 
              onClick={onSign} 
              disabled={!canSignAndSend || sendingReport || sendingToDoctor} 
              className={cn(
                "h-8 px-3 sm:h-9 gap-2 shrink-0", 
                isDoctorMode && "bg-emerald-600 hover:bg-emerald-700 text-white",
                !isDoctorMode && "bg-blue-600 hover:bg-blue-700 text-white",
                isCompact && "px-1 min-w-0 flex-1 sm:flex-none"
              )}
            >
              {sendingReport || sendingToDoctor ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDoctorMode ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )} 
              {!isCompact && <span>{isDoctorMode ? "Finalize" : "Send to Doctor"}</span>}
              {isCompact && <span className="text-[10px] font-bold uppercase">{isDoctorMode ? "OK" : ""}</span>}
            </Button>
          </div>
        </div>
      </footer>
    </section>
  );
}
