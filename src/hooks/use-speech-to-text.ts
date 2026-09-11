"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";

export function floatTo16BitPCM(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export type STTEngine = "deepgram" | "browser" | null;

export interface UseSpeechToTextOptions {
  onTranscriptChange?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
}

export function useSpeechToText(options?: UseSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [sttMode, setSttMode] = useState<STTEngine>(null);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");

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
  const shouldRestartBrowserRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stopAudioSession = useCallback(() => {
    const runtime = sttRef.current;
    sttRef.current = null;
    if (!runtime) return;

    try {
      if (runtime.socket.readyState === WebSocket.OPEN || runtime.socket.readyState === WebSocket.CONNECTING) {
        runtime.socket.close();
      }
    } catch {}

    try {
      runtime.stream.getTracks().forEach((track) => track.stop());
    } catch {}

    try {
      runtime.audioContext.close();
    } catch {}
  }, []);

  const stopBrowserStt = useCallback(() => {
    shouldRestartBrowserRef.current = false;
    if (browserSttRef.current) {
      try {
        browserSttRef.current.stop();
      } catch {}
      browserSttRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    stopAudioSession();
    stopBrowserStt();
    setIsListening(false);
    setSttMode(null);
    setInterimText("");
  }, [stopAudioSession, stopBrowserStt]);

  useEffect(() => {
    return () => {
      stopAudioSession();
      stopBrowserStt();
    };
  }, [stopAudioSession, stopBrowserStt]);

  const startBrowserStt = useCallback((initialBaseText: string, fallbackNotice?: string) => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser", {
        description: "Please use Chrome, Edge, or Safari, or ensure microphone access is permitted.",
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

      baseTextRef.current = initialBaseText ? initialBaseText.replace(/\s+$/, "") + " " : "";
      shouldRestartBrowserRef.current = true;

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            baseTextRef.current += text.trim() + " ";
            partialTextRef.current = "";
          } else {
            interim += text;
          }
        }

        const fullCurrent = (baseTextRef.current + interim).trimStart();
        setTranscript(fullCurrent);
        setInterimText(interim.trim());
        optionsRef.current?.onTranscriptChange?.(fullCurrent);
      };

      recognition.onerror = (event: any) => {
        console.warn("[Browser STT] error:", event.error);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          shouldRestartBrowserRef.current = false;
          toast.error("Microphone access denied", {
            description: "Please grant microphone permissions in your browser address bar.",
          });
          stopListening();
        } else if (event.error === "network") {
          shouldRestartBrowserRef.current = false;
          toast.error("Speech service network error", {
            description: "Browser speech recognition could not connect to server.",
          });
          stopListening();
        } else if (event.error !== "no-speech") {
          // Non-fatal, do not restart unconditionally if aborted
          if (event.error === "aborted") {
            shouldRestartBrowserRef.current = false;
          }
        }
      };

      recognition.onend = () => {
        if (shouldRestartBrowserRef.current && browserSttRef.current) {
          try {
            recognition.start();
          } catch {
            shouldRestartBrowserRef.current = false;
            setIsListening(false);
            setSttMode(null);
          }
        } else {
          setIsListening(false);
          setSttMode(null);
        }
      };

      recognition.start();
      browserSttRef.current = recognition;
      setSttMode("browser");
      setIsListening(true);
      if (fallbackNotice) {
        toast.info("Using Browser Speech Recognition", {
          description: fallbackNotice,
          duration: 3000,
        });
      }
    } catch (e: any) {
      console.error("[Browser STT] startup error:", e);
      stopListening();
      toast.error("Could not start speech recognition", {
        description: e?.message || "Check microphone permissions.",
      });
    }
  }, [stopListening]);

  const startListening = useCallback(async (currentText: string = "") => {
    if (isListening) return;

    const base = currentText ? currentText.replace(/\s+$/, "") + " " : "";
    baseTextRef.current = base;
    partialTextRef.current = "";

    // 1. Try Deepgram Streaming (Medical Model)
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const tokenRes = await fetch("/api/stt/deepgram/token", { headers });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        const deepgramKey = tokenData?.key;

        if (deepgramKey) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });

          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000,
          });
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          await audioContext.audioWorklet.addModule("/worklets/pcm-processor.js");

          const source = audioContext.createMediaStreamSource(stream);
          const processor = new AudioWorkletNode(audioContext, "pcm-processor");
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 1.3;

          const socketUrl =
            "wss://api.deepgram.com/v1/listen?model=nova-2-medical&smart_format=true&encoding=linear16&sample_rate=16000";

          // Note: Deepgram browser subprotocol is 'token', not 'bearer'
          const socket = new WebSocket(socketUrl, ["token", deepgramKey]);

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
                  const full = baseTextRef.current.trimStart();
                  setTranscript(full);
                  setInterimText("");
                  optionsRef.current?.onTranscriptChange?.(full);
                } else {
                  partialTextRef.current = text;
                  const full = (baseTextRef.current + text).trimStart();
                  setTranscript(full);
                  setInterimText(text);
                  optionsRef.current?.onTranscriptChange?.(full);
                }
              }
            } catch (err) {
              console.warn("[Deepgram STT] message parse notice:", err);
            }
          };

          socket.onerror = (err) => {
            console.warn("[Deepgram STT] socket error, falling back to browser STT:", err);
            stopAudioSession();
            startBrowserStt(baseTextRef.current, "Switched to browser speech recognition.");
          };

          socket.onclose = (ev) => {
            if (!ev.wasClean && sttRef.current?.socket === socket) {
              stopAudioSession();
              startBrowserStt(baseTextRef.current, "Connection interrupted; switched to browser speech recognition.");
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
      console.info("[STT] Deepgram initialization notice, using fallback:", deepgramError);
    }

    // 2. Guaranteed fallback: Browser Web Speech API
    startBrowserStt(baseTextRef.current);
  }, [isListening, startBrowserStt, stopAudioSession]);

  const syncTranscript = useCallback((newText: string) => {
    baseTextRef.current = newText ? newText.replace(/\s+$/, "") + " " : "";
    partialTextRef.current = "";
    setTranscript(newText);
    setInterimText("");
  }, []);

  return {
    isListening,
    sttMode,
    transcript,
    interimText,
    startListening,
    stopListening,
    setTranscript,
    syncTranscript,
  };
}
