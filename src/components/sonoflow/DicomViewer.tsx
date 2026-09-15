"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Wifi,
  Maximize2,
  Upload,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ImagePlus,
  Trash2,
  Undo2,
  Eye,
  Pencil,
  Highlighter,
  MoveRight,
  Circle,
  Check,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchWithTimeout } from "@/lib/api-client";
import type { KeyReportImage } from "@/lib/clinical-workflow-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

let csInitialized = false;

const EYE_FADE_MASK =
  "radial-gradient(ellipse 50% 50% at 50% 50%, #000 85%, rgba(0, 0, 0, 0.92) 91%, rgba(0, 0, 0, 0.45) 97%, transparent 100%)";

const FINDING_PRESETS = [
  "Gallbladder wall thickening",
  "Cholelithiasis",
  "Hepatic cyst",
  "Renal calculi",
  "Hydronephrosis",
  "Nodule / Mass",
  "Fluid collection",
  "Acoustic shadowing",
];

function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  width: number
) {
  const headlen = Math.max(14, width * 3.5);
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Body
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number
) {
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  const cx = Math.min(x1, x2) + rx;
  const cy = Math.min(y1, y2) + ry;
  if (rx < 2 || ry < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function compressImageToJpeg(dataUrl: string, maxWidth = 1200, quality = 0.82): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return Promise.resolve("");
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 600) * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

function isDicomFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".dcm") || file.type === "application/dicom") {
    return true;
  }
  if (file.type.startsWith("image/")) {
    return false;
  }
  if (/\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name)) {
    return false;
  }
  return true;
}

interface DicomViewerProps {
  accession?: string;
  keyImages?: KeyReportImage[];
  onKeyImagesChange?: (images: KeyReportImage[]) => void;
  currentUserId?: string;
  canSelectKeyImages?: boolean;
  selectedKeyImageId?: string | null;
  onSelectKeyImage?: (id: string | null) => void;
}

export function DicomViewer({
  accession,
  keyImages = [],
  onKeyImagesChange,
  currentUserId = "",
  canSelectKeyImages = false,
  selectedKeyImageId,
  onSelectKeyImage,
}: DicomViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const csRef = useRef<any>(null);
  const csToolsRef = useRef<any>(null);
  const csLoaderRef = useRef<any>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState("Waiting for images...");
  const [loading, setLoading] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    dataUrl: string;
    frameNumber: number;
    existingImageId?: string;
  } | null>(null);
  const [caption, setCaption] = useState("");
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  // Drawing studio tools & history
  type AnnotationTool = "pen" | "highlighter" | "arrow" | "circle";
  const [activeTool, setActiveTool] = useState<AnnotationTool>("pen");
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [highlightColor, setHighlightColor] = useState<string>("#ef4444");
  const [stampNoteOnImage, setStampNoteOnImage] = useState<boolean>(true);
  const [canUndo, setCanUndo] = useState(false);
  const undoStackRef = useRef<ImageData[]>([]);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const preDragCanvasDataRef = useRef<ImageData | null>(null);

  // Attached image viewing state
  const [internalSelectedKeyImageId, setInternalSelectedKeyImageId] = useState<string | null>(null);
  const [userExplicitlyDismissedKeyImage, setUserExplicitlyDismissedKeyImage] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, startPanX: 0, startPanY: 0 });
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false);
  const [eyeFadeEnabled, setEyeFadeEnabled] = useState(false);

  const currentSelectedId = selectedKeyImageId !== undefined ? selectedKeyImageId : internalSelectedKeyImageId;

  // Active key image to display full-size
  const activeKeyImage = useMemo(() => {
    if (keyImages.length === 0) return null;
    if (currentSelectedId) {
      return keyImages.find((img) => img.id === currentSelectedId) ?? null;
    }
    // Default to first attached image if no DICOM studies are loaded
    if (imageIds.length === 0 && !userExplicitlyDismissedKeyImage) {
      return keyImages[0];
    }
    return null;
  }, [keyImages, currentSelectedId, imageIds.length, userExplicitlyDismissedKeyImage]);

  const activeKeyImageIndex = useMemo(() => {
    if (!activeKeyImage) return -1;
    return keyImages.findIndex((img) => img.id === activeKeyImage.id);
  }, [keyImages, activeKeyImage]);

  const handleSelectKeyImage = (image: KeyReportImage) => {
    setUserExplicitlyDismissedKeyImage(false);
    if (onSelectKeyImage) {
      onSelectKeyImage(image.id);
    }
    setInternalSelectedKeyImageId(image.id);
    setImageZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleDeselectKeyImage = () => {
    setUserExplicitlyDismissedKeyImage(true);
    if (onSelectKeyImage) {
      onSelectKeyImage(null);
    }
    setInternalSelectedKeyImageId(null);
    setImageZoom(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (!activeKeyImage) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setImageZoom((prev) => Math.max(0.5, Math.min(5, Number((prev + delta).toFixed(2)))));
  };

  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (!activeKeyImage || imageZoom <= 1) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panPosition.x,
      startPanY: panPosition.y,
    };
  };

  const handlePanMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanPosition({
      x: panStartRef.current.startPanX + dx,
      y: panStartRef.current.startPanY + dy,
    });
  };

  const handlePanMouseUp = () => {
    setIsPanning(false);
  };

  const hasImages = imageIds.length > 0;
  const currentFrame = useMemo(() => (hasImages ? currentIndex + 1 : 0), [hasImages, currentIndex]);

  const ensureCornerstone = async () => {
    if (csRef.current && csLoaderRef.current && csInitialized) {
      return { cs: csRef.current, loader: csLoaderRef.current, tools: csToolsRef.current };
    }
    const cornerstone = (await import("cornerstone-core")).default;
    const cornerstoneMath = (await import("cornerstone-math")).default;
    const cornerstoneTools = (await import("cornerstone-tools")).default;
    const cornerstoneWADOImageLoader = (await import("cornerstone-wado-image-loader")).default;
    const Hammer = (await import("hammerjs")).default;
    const dicomParser = (await import("dicom-parser")).default;

    if (!csInitialized) {
      cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
      cornerstoneTools.external.cornerstone = cornerstone;
      cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
      cornerstoneTools.external.Hammer = Hammer;
      cornerstoneTools.init({ showSVGCursors: true });
      cornerstoneWADOImageLoader.configure({
        beforeSend: function (_xhr: XMLHttpRequest) {}
      });
      csInitialized = true;
    }
    csRef.current = cornerstone;
    csToolsRef.current = cornerstoneTools;
    csLoaderRef.current = cornerstoneWADOImageLoader;
    return { cs: cornerstone, loader: cornerstoneWADOImageLoader, tools: cornerstoneTools };
  };

  useEffect(() => {
    let mounted = true;
    const element = viewportRef.current;
    (async () => {
      const { cs, tools } = await ensureCornerstone();
      if (!mounted || !element) return;
      cs.enable(element);
      tools.addTool(tools.WwwcTool);
      tools.addTool(tools.PanTool);
      tools.addTool(tools.ZoomTool, { configuration: { invert: false } });
      tools.setToolActive("Wwwc", { mouseButtonMask: 1 });
      tools.setToolActive("Pan", { mouseButtonMask: 4 });
      tools.setToolActive("Zoom", { mouseButtonMask: 2 });
      setStatus("Viewer ready");
    })().catch(() => { if (mounted) setStatus("Viewer initialization failed. Reload to try again."); });

    return () => {
      mounted = false;
      if (element && csRef.current) {
        csRef.current.disable(element);
      }
    };
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    const cornerstone = csRef.current;
    if (!el || !hasImages || !cornerstone) return;
    let active = true;
    cornerstone
      .loadAndCacheImage(imageIds[currentIndex])
      .then((image: any) => {
        if (!active) return;
        cornerstone.displayImage(el, image);
        setStatus("DICOM rendered");
      })
      .catch(() => {
        if (active) setStatus("Failed to render image");
      });
    return () => { active = false; };
  }, [imageIds, currentIndex, hasImages]);

  const renderDicomFileToDataUrl = async (file: File): Promise<string | null> => {
    try {
      const { cs, loader } = await ensureCornerstone();
      const imageId = loader.wadouri.fileManager.add(file);
      const image = await cs.loadAndCacheImage(imageId);
      const canvas = document.createElement("canvas");
      canvas.width = image.width || image.columns || 800;
      canvas.height = image.height || image.rows || 600;
      cs.renderToCanvas(canvas, image);
      return canvas.toDataURL("image/jpeg", 0.88);
    } catch (e) {
      console.warn("renderDicomFileToDataUrl error:", e);
      return null;
    }
  };

  const handleImageFiles = async (files: FileList | File[] | null) => {
    if (!files || (files as any).length === 0) return;
    if (keyImages.length >= 6) {
      toast.info("Key image limit reached", { description: "Remove an image before adding another (maximum 6)." });
      return;
    }
    const fileList = Array.from(files);
    if (fileList.length === 1 && canSelectKeyImages) {
      const file = fileList[0];
      let dataUrl: string | null = null;
      if (isDicomFile(file)) {
        dataUrl = await renderDicomFileToDataUrl(file);
      }

      if (!dataUrl) {
        dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const rawUrl = (e.target?.result as string) || "";
            if (rawUrl && rawUrl.startsWith("data:image/")) {
              const compressed = await compressImageToJpeg(rawUrl);
              resolve(compressed);
            } else {
              resolve("");
            }
          };
          reader.onerror = () => resolve("");
          reader.readAsDataURL(file);
        });
      }

      if (dataUrl && dataUrl.startsWith("data:image/")) {
        setSnapshot({ dataUrl, frameNumber: currentFrame || 1 });
        setCaption(file.name.replace(/\.[^/.]+$/, ""));
        setAnnotationOpen(true);
      } else {
        toast.error("Could not load image", { description: "Unable to parse or preview the selected DICOM or image file." });
      }
    } else {
      const remaining = 6 - keyImages.length;
      const toAdd = fileList.slice(0, remaining);
      const newItems: KeyReportImage[] = [];
      for (let i = 0; i < toAdd.length; i++) {
        const file = toAdd[i];
        let dataUrl: string | null = null;
        if (isDicomFile(file)) {
          dataUrl = await renderDicomFileToDataUrl(file);
        }

        if (!dataUrl) {
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string) || "");
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          });
          if (dataUrl && dataUrl.startsWith("data:image/")) {
            dataUrl = await compressImageToJpeg(dataUrl);
          } else {
            dataUrl = null;
          }
        }

        if (dataUrl && dataUrl.startsWith("data:image/")) {
          newItems.push({
            id: crypto.randomUUID(),
            dataUrl,
            caption: file.name.replace(/\.[^/.]+$/, ""),
            frameNumber: (currentFrame || 1) + i,
            createdAt: new Date().toISOString(),
            createdBy: currentUserId,
          });
        }
      }
      if (newItems.length > 0) {
        onKeyImagesChange?.([...keyImages, ...newItems]);
        toast.success(`${newItems.length} key image(s) attached`, {
          description: "Images will be sent with the report to the doctor.",
        });
      }
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    const dicomFiles = fileList.filter(isDicomFile);
    const standardImages = fileList.filter((f) => !isDicomFile(f));

    if (dicomFiles.length > 0) {
      const { loader } = await ensureCornerstone();
      const ids = dicomFiles.map((file) => loader.wadouri.fileManager.add(file));
      setImageIds(ids);
      setCurrentIndex(0);
      setStatus(`${ids.length} DICOM image(s) loaded`);
    }

    if (standardImages.length > 0) {
      void handleImageFiles(standardImages);
    }
  };

  const fetchFromDicomWeb = async () => {
    setLoading(true);
    setLastFetchFailed(false);
    setStatus("Fetching from DICOMweb...");
    try {
      const baseUrl =
        process.env.VITE_DICOMWEB_API_URL ||
        process.env.NEXT_PUBLIC_DICOMWEB_API_URL;
      if (!baseUrl) {
        setStatus("DICOMweb endpoint not configured");
        toast.error("PACS Endpoint Not Configured", {
          description: "No DICOMweb server URL configured in settings. You can upload local scan files directly.",
        });
        return;
      }
      if (!accession) {
        setStatus("Accession number missing for DICOMweb lookup");
        toast.error("Missing Accession Number", {
          description: "An accession number is required to query PACS for this patient.",
        });
        return;
      }

      const studyQuery = accession
        ? `${baseUrl}/studies?AccessionNumber=${encodeURIComponent(accession)}&limit=1`
        : `${baseUrl}/studies?limit=1`;
      const studyRes = await fetchWithTimeout(studyQuery, { timeoutMs: 6000, retries: 0 });
      if (!studyRes.ok) {
        throw new Error(`Study query failed (${studyRes.status})`);
      }
      const studies = await studyRes.json();
      const studyUid = studies?.[0]?.["0020000D"]?.Value?.[0];
      if (!studyUid) {
        setStatus(accession ? `No study found for accession ${accession}` : "No studies found");
        toast.info("No Study Found", {
          description: `No matching DICOM study found on PACS for accession ${accession}.`,
        });
        setImageIds([]);
        return;
      }

      const seriesRes = await fetchWithTimeout(`${baseUrl}/studies/${encodeURIComponent(studyUid)}/series`, {
        timeoutMs: 6000,
        retries: 0,
      });
      if (!seriesRes.ok) {
        throw new Error(`Series query failed (${seriesRes.status})`);
      }
      const series = await seriesRes.json();

      const ids: string[] = [];
      for (const seriesItem of series ?? []) {
        const seriesUid = seriesItem?.["0020000E"]?.Value?.[0];
        if (!seriesUid) continue;

        const instRes = await fetchWithTimeout(
          `${baseUrl}/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}/instances`,
          { timeoutMs: 6000, retries: 0 },
        );
        if (!instRes.ok) continue;
        const instances = await instRes.json();

        for (const inst of instances ?? []) {
          const sopUid = inst?.["00080018"]?.Value?.[0];
          if (!sopUid) continue;
          const frameCount = Number(inst?.["00280008"]?.Value?.[0] ?? 1);
          const frames = Number.isFinite(frameCount) && frameCount > 0 ? frameCount : 1;
          for (let frame = 1; frame <= frames; frame++) {
            ids.push(
              `wadors:${baseUrl}/studies/${encodeURIComponent(studyUid)}/series/${encodeURIComponent(seriesUid)}/instances/${encodeURIComponent(sopUid)}/frames/${frame}`,
            );
          }
        }
      }

      if (ids.length === 0) {
        setStatus("No renderable instances found on PACS");
        toast.info("No Image Instances", {
          description: "Study was located on PACS but contains no renderable image frames.",
        });
        setImageIds([]);
        return;
      }

      setImageIds(ids);
      setCurrentIndex(0);
      setStatus(`${ids.length} frame(s) loaded from DICOMweb`);
      toast.success("Scans Loaded", {
        description: `Loaded ${ids.length} frame(s) from PACS.`,
      });
    } catch (err) {
      setLastFetchFailed(true);
      const baseUrl =
        process.env.VITE_DICOMWEB_API_URL ||
        process.env.NEXT_PUBLIC_DICOMWEB_API_URL ||
        "PACS server";

      const isNetworkError =
        err instanceof TypeError ||
        (err instanceof Error &&
          (err.message.includes("fetch") || err.name === "TypeError" || err.message.includes("Failed to fetch")));

      const friendlyMessage = isNetworkError
        ? "PACS server unreachable (offline or invalid endpoint)"
        : err instanceof Error
        ? err.message
        : "DICOMweb connection failed";

      setStatus(friendlyMessage);
      console.warn("DICOMweb PACS query notice:", err);

      toast.error("PACS Server Unreachable", {
        description: `Could not connect to ${baseUrl}. Verify PACS server connection or upload local scan images.`,
      });
    } finally {
      setLoading(false);
    }
  };


  const canPrev = activeKeyImage ? activeKeyImageIndex > 0 : (hasImages && currentIndex > 0);
  const canNext = activeKeyImage
    ? activeKeyImageIndex >= 0 && activeKeyImageIndex < keyImages.length - 1
    : (hasImages && currentIndex < imageIds.length - 1);

  const nextFrame = () => {
    if (activeKeyImage) {
      const idx = keyImages.findIndex((img) => img.id === activeKeyImage.id);
      if (idx >= 0 && idx < keyImages.length - 1) {
        handleSelectKeyImage(keyImages[idx + 1]);
      }
      return;
    }
    setCurrentIndex((prev) => Math.min(prev + 1, imageIds.length - 1));
  };

  const prevFrame = () => {
    if (activeKeyImage) {
      const idx = keyImages.findIndex((img) => img.id === activeKeyImage.id);
      if (idx > 0) {
        handleSelectKeyImage(keyImages[idx - 1]);
      }
      return;
    }
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const adjustZoom = (delta: number) => {
    if (activeKeyImage) {
      setImageZoom((prev) => Math.max(0.5, Math.min(5, Number((prev + delta * 2).toFixed(2)))));
      return;
    }
    const el = viewportRef.current;
    const cornerstone = csRef.current;
    if (!el || !cornerstone) return;
    const viewport = cornerstone.getViewport(el);
    if (!viewport) return;
    viewport.scale = Math.max(0.1, Math.min(20, viewport.scale + delta));
    cornerstone.setViewport(el, viewport);
  };

  const resetView = () => {
    if (activeKeyImage) {
      setImageZoom(1);
      setPanPosition({ x: 0, y: 0 });
      return;
    }
    const el = viewportRef.current;
    const cornerstone = csRef.current;
    if (!el || !cornerstone) return;
    cornerstone.reset(el);
  };

  const beginDrawOnScan = (targetImage?: KeyReportImage) => {
    const target = targetImage || activeKeyImage;
    if (target) {
      setSnapshot({
        dataUrl: target.dataUrl,
        frameNumber: target.frameNumber,
        existingImageId: target.id,
      });
      setCaption(target.caption || `Frame ${target.frameNumber} Finding`);
      undoStackRef.current = [];
      setCanUndo(false);
      setAnnotationOpen(true);
      return;
    }
    beginKeyImage();
  };

  const beginKeyImage = () => {
    const el = viewportRef.current;
    if (!el) {
      toast.error("Viewer unavailable");
      return;
    }
    if (keyImages.length >= 6) {
      toast.info("Key image limit reached", { description: "Remove an image before adding another (maximum 6)." });
      return;
    }

    let dataUrl = "";
    if (csRef.current) {
      try {
        const enabledElement = csRef.current.getEnabledElement(el);
        if (enabledElement?.image) {
          const offscreenCanvas = document.createElement("canvas");
          offscreenCanvas.width = enabledElement.image.width || enabledElement.image.columns || 800;
          offscreenCanvas.height = enabledElement.image.height || enabledElement.image.rows || 600;
          csRef.current.renderToCanvas(offscreenCanvas, enabledElement.image, enabledElement.viewport);
          dataUrl = offscreenCanvas.toDataURL("image/jpeg", 0.9);
        }
      } catch (err) {
        console.warn("Cornerstone offscreen canvas export fallback:", err);
      }
    }

    if (!dataUrl) {
      const sourceCanvas = (el.querySelector("canvas.cornerstone-canvas") as HTMLCanvasElement) || el.querySelector("canvas");
      if (sourceCanvas && sourceCanvas.width > 0 && sourceCanvas.height > 0) {
        dataUrl = sourceCanvas.toDataURL("image/jpeg", 0.88);
      }
    }

    if (!dataUrl) {
      toast.error("Key image unavailable", { description: "Render a DICOM frame before selecting it." });
      return;
    }

    undoStackRef.current = [];
    setCanUndo(false);
    setSnapshot({ dataUrl, frameNumber: currentFrame || 1 });
    setCaption(`Frame ${currentFrame || 1} Finding`);
    setAnnotationOpen(true);
  };

  const prepareAnnotationCanvas = (image: HTMLImageElement) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    undoStackRef.current = [];
    setCanUndo(false);
  };

  const saveCanvasState = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    try {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStackRef.current.push(data);
      if (undoStackRef.current.length > 30) {
        undoStackRef.current.shift();
      }
      setCanUndo(true);
    } catch (e) {
      console.warn("saveCanvasState failed:", e);
    }
  };

  const handleUndo = () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const previous = undoStackRef.current.pop();
    if (previous) {
      ctx.putImageData(previous, 0, 0);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCanUndo(undoStackRef.current.length > 0);
  };

  const clearAnnotation = () => {
    const canvas = annotationCanvasRef.current;
    if (canvas) {
      saveCanvasState();
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    const context = canvas.getContext("2d");
    if (!context) return;

    saveCanvasState();

    const scaleFactor = Math.max(1, canvas.width / 400);
    const computedWidth = Math.max(strokeWidth, scaleFactor * (strokeWidth / 1.5));

    if (activeTool === "pen" || activeTool === "highlighter") {
      context.beginPath();
      context.moveTo(point.x, point.y);
      if (activeTool === "highlighter") {
        context.strokeStyle = "rgba(239, 68, 68, 0.42)";
        context.lineWidth = Math.max(16, scaleFactor * 12);
      } else {
        context.strokeStyle = highlightColor;
        context.lineWidth = computedWidth;
      }
      context.lineCap = "round";
      context.lineJoin = "round";
      drawingRef.current = true;
    } else {
      dragStartRef.current = point;
      preDragCanvasDataRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
      drawingRef.current = true;
    }
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = pointerPosition(event);

    if (activeTool === "pen" || activeTool === "highlighter") {
      context.lineTo(point.x, point.y);
      context.stroke();
    } else if (dragStartRef.current && preDragCanvasDataRef.current) {
      context.putImageData(preDragCanvasDataRef.current, 0, 0);
      const start = dragStartRef.current;
      const scaleFactor = Math.max(1, canvas.width / 400);
      const computedWidth = Math.max(strokeWidth, scaleFactor * (strokeWidth / 1.5));

      if (activeTool === "arrow") {
        drawArrow(context, start.x, start.y, point.x, point.y, highlightColor, computedWidth);
      } else if (activeTool === "circle") {
        drawEllipse(context, start.x, start.y, point.x, point.y, highlightColor, computedWidth);
      }
    }
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    dragStartRef.current = null;
    preDragCanvasDataRef.current = null;
  };

  const saveKeyImage = async (asNew: boolean = false) => {
    if (!snapshot) return;
    const annotation = annotationCanvasRef.current;
    const image = new Image();
    image.onload = () => {
      const maxWidth = 1400;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return;

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      if (annotation) {
        context.drawImage(annotation, 0, 0, canvas.width, canvas.height);
      }

      const trimmedCaption = caption.trim();
      if (stampNoteOnImage && trimmedCaption) {
        context.save();
        const maxBadgeW = canvas.width - 32;
        let fontSize = Math.max(13, Math.round(canvas.width / 45));
        context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
        let metrics = context.measureText(trimmedCaption);

        // Auto-scale font down if caption is long so it never cuts off or overflows the canvas
        while (metrics.width + Math.round(fontSize * 1.6) + Math.max(3, Math.round(fontSize * 0.22)) * 2 + 12 > maxBadgeW && fontSize > 10) {
          fontSize -= 1;
          context.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
          metrics = context.measureText(trimmedCaption);
        }

        const padX = Math.round(fontSize * 0.8);
        const padY = Math.round(fontSize * 0.45);
        const dotRadius = Math.max(3, Math.round(fontSize * 0.22));
        const badgeH = fontSize + padY * 2;
        const badgeW = Math.min(maxBadgeW, metrics.width + padX * 2 + dotRadius * 2 + 8);
        
        // Center the badge horizontally so it is always prominently visible and never stuck in cut-off corners
        const posX = Math.max(16, Math.round((canvas.width - badgeW) / 2));
        const posY = Math.max(16, canvas.height - badgeH - Math.max(20, Math.round(canvas.height * 0.04)));

        context.fillStyle = "rgba(2, 6, 23, 0.90)";
        context.strokeStyle = "rgba(239, 68, 68, 0.85)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(posX, posY, badgeW, badgeH, Math.round(badgeH / 2));
        context.fill();
        context.stroke();

        context.fillStyle = "#ef4444";
        context.beginPath();
        context.arc(posX + padX, posY + badgeH / 2, dotRadius, 0, 2 * Math.PI);
        context.fill();

        context.fillStyle = "#ffffff";
        context.textBaseline = "middle";
        context.fillText(trimmedCaption, posX + padX + dotRadius * 2 + 8, posY + badgeH / 2);
        context.restore();
      }

      const isUpdate = Boolean(snapshot.existingImageId && !asNew);
      const nextId = isUpdate ? snapshot.existingImageId! : crypto.randomUUID();

      const nextItem: KeyReportImage = {
        id: nextId,
        dataUrl: canvas.toDataURL("image/jpeg", 0.86),
        caption: trimmedCaption || `Finding · Frame ${snapshot.frameNumber}`,
        frameNumber: snapshot.frameNumber,
        createdAt: new Date().toISOString(),
        createdBy: currentUserId,
      };

      if (isUpdate) {
        const updated = keyImages.map((img) => (img.id === snapshot.existingImageId ? nextItem : img));
        onKeyImagesChange?.(updated);
        toast.success("Picture updated in report", {
          description: "Your red highlights and note have been saved.",
        });
      } else {
        if (keyImages.length >= 6) {
          toast.info("Key image limit reached", {
            description: "Maximum 6 key images allowed in report.",
          });
          return;
        }
        onKeyImagesChange?.([...keyImages, nextItem]);
        toast.success("Picture attached to report", {
          description: "Your red highlights and note are attached to the report.",
        });
      }

      setAnnotationOpen(false);
      setSnapshot(null);
    };
    image.src = snapshot.dataUrl;
  };

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-200 lg:border-l">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-100">DICOM Viewer</h2>
        </div>
        <Badge variant="outline" className={cn("text-[10px]", (activeKeyImage || hasImages) ? "border-blue-500/40 bg-blue-950/30 text-blue-300" : "border-slate-700 text-slate-400")}>
          <Wifi className="mr-1 h-2.5 w-2.5" /> {activeKeyImage ? `ATTACHED IMAGE (${activeKeyImageIndex + 1}/${keyImages.length})` : (hasImages ? "DICOM LOADED" : "NO IMAGES")}
        </Badge>
      </header>

      <div className="border-b border-slate-800 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,application/dicom,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept=".dcm,application/dicom,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
            title="Upload DICOM (.dcm) or ultrasound images (.png, .jpg)"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload
          </Button>

          {canSelectKeyImages && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/80"
              onClick={() => beginDrawOnScan()}
              disabled={!hasImages && !activeKeyImage}
              title="Draw highlights directly on this scan frame and attach to report"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5 text-rose-400" />
              Draw on Scan
            </Button>
          )}

          {canSelectKeyImages && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700/80"
              onClick={() => imageInputRef.current?.click()}
              title="Upload ultrasound photo from computer"
            >
              <ImagePlus className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
              Attach Image
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
            onClick={fetchFromDicomWeb}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1.5 h-3.5 w-3.5" />}
            Fetch Server
          </Button>

          <div className="mx-1 h-4 w-px bg-slate-800" />

          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={() => adjustZoom(0.1)}
            disabled={!hasImages && !activeKeyImage}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={() => adjustZoom(-0.1)}
            disabled={!hasImages && !activeKeyImage}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={resetView}
            disabled={!hasImages && !activeKeyImage}
            title="Reset View"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={prevFrame}
            disabled={!canPrev}
            aria-label="Previous image or frame"
            title="Previous image or frame"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={nextFrame}
            disabled={!canNext}
            aria-label="Next image or frame"
            title="Next image or frame"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

        </div>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden select-none">
        <div ref={viewportRef} className={cn("h-full w-full bg-black", activeKeyImage && "hidden")} />
        
        {activeKeyImage ? (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden p-4 pt-14 pb-4"
            onWheel={handleWheelZoom}
            onMouseDown={handlePanMouseDown}
            onMouseMove={handlePanMouseMove}
            onMouseUp={handlePanMouseUp}
            onMouseLeave={handlePanMouseUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeKeyImage.dataUrl}
              alt={activeKeyImage.caption}
              draggable={false}
              className="max-h-full max-w-full object-contain select-none pointer-events-auto"
              style={{
                transform: `scale(${imageZoom}) translate(${panPosition.x / imageZoom}px, ${panPosition.y / imageZoom}px)`,
                transition: isPanning ? "none" : "transform 0.15s ease-out",
                cursor: imageZoom > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in",
              }}
              onClick={() => {
                if (imageZoom === 1) {
                  setImageZoom(1.8);
                } else if (!isPanning) {
                  setImageZoom(1);
                  setPanPosition({ x: 0, y: 0 });
                }
              }}
            />

            {/* Floating top bar with caption and controls */}
            <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 rounded-md bg-black/85 px-2.5 py-1 text-xs text-white backdrop-blur-md border border-slate-700 shadow-md max-w-[calc(100%-180px)]">
                <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                <span className="font-medium text-slate-100 truncate" title={activeKeyImage.caption}>{activeKeyImage.caption}</span>
                <span className="text-slate-400 text-[11px] shrink-0">
                  · Image {activeKeyImageIndex + 1} of {keyImages.length}
                </span>
                {imageZoom !== 1 && (
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300 font-mono">
                    {Math.round(imageZoom * 100)}%
                  </span>
                )}
              </div>

              <div className="pointer-events-auto flex items-center gap-1.5">
                {canSelectKeyImages && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2.5 text-xs bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded shadow-xs font-medium"
                    onClick={() => beginDrawOnScan()}
                    title="Draw highlights on this scan"
                  >
                    <Pencil className="h-3 w-3 mr-1 text-rose-400" /> Draw Highlights
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  className={cn(
                    "h-7 w-7 border transition-colors",
                    eyeFadeEnabled
                      ? "bg-blue-600/30 text-blue-300 border-blue-500/50 hover:bg-blue-600/40"
                      : "bg-slate-900/90 text-slate-400 border-slate-700 hover:bg-slate-800"
                  )}
                  onClick={() => setEyeFadeEnabled(!eyeFadeEnabled)}
                  title={eyeFadeEnabled ? "Soft eye vignette active (click for full rectangle)" : "Soft eye vignette disabled (click to enable)"}
                  aria-label="Toggle eye vignette fade"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {hasImages && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-slate-800"
                    onClick={handleDeselectKeyImage}
                  >
                    View DICOM
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-7 w-7 bg-slate-900/90 text-slate-200 border border-slate-700 hover:bg-slate-800"
                  onClick={() => setFullscreenModalOpen(true)}
                  title="Expand to full screen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          !hasImages && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-slate-700/60">
                <div className="absolute inset-0 animate-ping rounded-full border border-blue-500/20" />
                <Crosshair className="h-12 w-12 text-slate-500" strokeWidth={1.2} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-100">Upload DICOM files or attach images</p>
                <p className="text-xs text-slate-400">{status}</p>
                {lastFetchFailed && <p className="text-xs text-amber-400/90">PACS server is currently offline or unreachable. Upload DICOM files or attach images directly.</p>}
              </div>
            </div>
          )
        )}
      </div>

      {(keyImages.length > 0 || hasImages) && (
        <footer className="shrink-0 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400">
          {keyImages.length > 0 && (
            <div>
              <div className="flex items-center justify-between font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <span>Attached to report ({keyImages.length}/6)</span>
                </span>
                <span className="text-[10px] text-slate-500">Click thumbnail to view</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto p-1.5 pb-2 -mx-1.5" aria-label="Selected key images">
              {keyImages.map((image) => {
                const isActive = activeKeyImage?.id === image.id;
                return (
                  <div
                    key={image.id}
                    className="group relative flex w-20 shrink-0 flex-col items-center cursor-pointer select-none"
                    onClick={() => handleSelectKeyImage(image)}
                    title={`Click to view "${image.caption}" in full size`}
                  >
                    <div
                      className={cn(
                        "relative h-12 w-20 rounded-md overflow-hidden bg-black transition-all",
                        isActive
                          ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 border border-blue-400 shadow-md shadow-blue-500/25"
                          : "border border-slate-800 opacity-75 hover:opacity-100 hover:border-slate-700"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.dataUrl}
                        alt={image.caption}
                        className="h-full w-full object-contain pointer-events-none"
                        style={{
                          WebkitMaskImage: EYE_FADE_MASK,
                          maskImage: EYE_FADE_MASK,
                        }}
                      />
                      {canSelectKeyImages && (
                        <div className="absolute right-0.5 top-0.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            className="rounded bg-black/85 p-1 text-white hover:bg-red-600 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              beginDrawOnScan(image);
                            }}
                            title="Draw red highlights on this picture"
                            aria-label={`Draw on ${image.caption}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded bg-black/85 p-1 text-white hover:bg-red-600 transition-colors shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onKeyImagesChange?.(keyImages.filter((item) => item.id !== image.id));
                              if (activeKeyImage?.id === image.id) {
                                const remaining = keyImages.filter((item) => item.id !== image.id);
                                if (remaining.length > 0) {
                                  handleSelectKeyImage(remaining[0]);
                                } else {
                                  handleDeselectKeyImage();
                                }
                              }
                            }}
                            aria-label={`Remove ${image.caption}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p
                      className={cn(
                        "mt-1.5 w-full truncate text-center text-[10px] transition-colors",
                        isActive ? "font-semibold text-blue-400" : "text-slate-400 group-hover:text-slate-300"
                      )}
                      title={image.caption}
                    >
                      {image.caption}
                    </p>
                  </div>
                );
              })}
              </div>
            </div>
          )}
          {hasImages && !activeKeyImage && (
            <div className="flex items-center justify-between py-1 text-[11px] text-slate-400">
              <span>Frame {currentFrame} of {imageIds.length}</span>
              <span className="text-[10px] text-slate-500">Drag: Pan / WW / WL · Scroll: Zoom</span>
            </div>
          )}
        </footer>
      )}

      <Dialog open={annotationOpen} onOpenChange={setAnnotationOpen}>
        <DialogContent className="max-w-5xl border-slate-800 bg-slate-950 text-slate-100 p-5 flex flex-col max-h-[92vh]">
          <DialogHeader className="pb-2 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <DialogTitle className="text-slate-100 flex items-center gap-2 text-base font-bold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600/20 text-red-400 border border-red-500/30">
                    <Pencil className="h-3.5 w-3.5" />
                  </span>
                  Draw on Scan & Attach to Report
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Draw red highlights directly on the scan frame to point out findings, add a quick note, and attach straight into the report.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[11px] border-red-500/30 bg-red-950/20 text-red-400">
                  Frame {snapshot?.frameNumber || 1}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Annotation Studio Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-800/80 bg-slate-900/50 px-2.5 rounded-md text-xs">
            {/* Tool Selection */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Tool:</span>
              <Button
                type="button"
                size="sm"
                variant={activeTool === "pen" ? "default" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5 transition-colors",
                  activeTool === "pen" ? "bg-red-600 text-white hover:bg-red-500 font-semibold" : "text-slate-300 hover:bg-slate-800"
                )}
                onClick={() => setActiveTool("pen")}
                title="Freehand Red Pen"
              >
                <Pencil className="h-3 w-3" /> Pen
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTool === "highlighter" ? "default" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5 transition-colors",
                  activeTool === "highlighter" ? "bg-red-600 text-white hover:bg-red-500 font-semibold" : "text-slate-300 hover:bg-slate-800"
                )}
                onClick={() => setActiveTool("highlighter")}
                title="Red Highlighter (Semi-transparent)"
              >
                <Highlighter className="h-3 w-3" /> Highlighter
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTool === "arrow" ? "default" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5 transition-colors",
                  activeTool === "arrow" ? "bg-red-600 text-white hover:bg-red-500 font-semibold" : "text-slate-300 hover:bg-slate-800"
                )}
                onClick={() => setActiveTool("arrow")}
                title="Arrow Pointer"
              >
                <MoveRight className="h-3 w-3" /> Arrow
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTool === "circle" ? "default" : "ghost"}
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5 transition-colors",
                  activeTool === "circle" ? "bg-red-600 text-white hover:bg-red-500 font-semibold" : "text-slate-300 hover:bg-slate-800"
                )}
                onClick={() => setActiveTool("circle")}
                title="Circle / Callout"
              >
                <Circle className="h-3 w-3" /> Circle
              </Button>
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Width:</span>
              {[
                { label: "Fine", width: 2 },
                { label: "Med", width: 4 },
                { label: "Bold", width: 8 },
              ].map((sw) => (
                <button
                  key={sw.width}
                  type="button"
                  className={cn(
                    "h-6 px-2 text-[11px] rounded border transition-all",
                    strokeWidth === sw.width
                      ? "bg-slate-800 border-red-500 text-red-400 font-bold"
                      : "border-slate-800 text-slate-400 hover:bg-slate-800/60"
                  )}
                  onClick={() => setStrokeWidth(sw.width)}
                >
                  {sw.label}
                </button>
              ))}
            </div>

            {/* Color Accent */}
            <div className="flex items-center gap-1.5">
              {[
                { color: "#ef4444", title: "Clinical Red" },
                { color: "#fbbf24", title: "Warning Amber" },
                { color: "#38bdf8", title: "Sky Cyan" },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-transform",
                    highlightColor === c.color ? "scale-110 border-white shadow-xs shadow-white/30" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c.color }}
                  onClick={() => setHighlightColor(c.color)}
                  title={c.title}
                />
              ))}
            </div>

            {/* History Controls */}
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canUndo}
                onClick={handleUndo}
                className="h-7 px-2 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
                title="Undo last stroke"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Undo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearAnnotation}
                className="h-7 px-2 text-xs border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-red-400"
                title="Clear all ink"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
              </Button>
            </div>
          </div>

          {/* Canvas Workspace */}
          {snapshot && (
            <div className="relative my-2 flex-1 min-h-[42vh] max-h-[52vh] flex items-center justify-center overflow-auto rounded-lg border border-slate-800 bg-black/90 p-2">
              <div className="relative inline-block touch-none select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={snapshot.dataUrl}
                  alt="Scan frame"
                  className="block max-h-[48vh] max-w-full rounded object-contain pointer-events-none"
                  onLoad={(event) => prepareAnnotationCanvas(event.currentTarget)}
                  onError={() => {
                    toast.error("Failed to render preview", { description: "The image data could not be displayed." });
                  }}
                />
                <canvas
                  ref={annotationCanvasRef}
                  className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                />
                {stampNoteOnImage && caption.trim() && (
                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[90%] flex items-center gap-1.5 rounded-full border border-red-500/80 bg-slate-950/90 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-xs truncate">
                    <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                    <span className="truncate">{caption.trim()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Finding Presets & Clinical Note */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Tag className="h-3 w-3 text-red-400" /> Finding:
              </span>
              {FINDING_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-slate-300 hover:border-red-500/50 hover:bg-red-950/20 hover:text-red-200 transition-colors"
                  onClick={() => setCaption((prev) => (prev ? `${prev} · ${preset}` : preset))}
                >
                  + {preset}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Input
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Quick note / Finding, e.g. Positive Murphy's sign · GB wall thickening 4.5 mm"
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus-visible:ring-red-500 pr-3 h-9 text-xs"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none shrink-0 bg-slate-900/70 border border-slate-800 px-2.5 py-1.5 rounded-md">
                <input
                  type="checkbox"
                  checked={stampNoteOnImage}
                  onChange={(e) => setStampNoteOnImage(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-red-600 focus:ring-red-500 h-3.5 w-3.5"
                />
                <span>Stamp note on picture</span>
              </label>
            </div>
          </div>

          <DialogFooter className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnnotationOpen(false)}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-2">
              {snapshot?.existingImageId && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => saveKeyImage(true)}
                  className="border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  Attach as New Picture
                </Button>
              )}
              <Button
                type="button"
                onClick={() => saveKeyImage(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs"
              >
                <Check className="mr-1.5 h-4 w-4" />
                {snapshot?.existingImageId ? "Update Picture in Report" : "Attach Picture to Report"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={fullscreenModalOpen} onOpenChange={setFullscreenModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[92vh] border-slate-800 bg-slate-950 p-4 text-slate-100 flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-800 space-y-0">
            <div>
              <DialogTitle className="text-slate-100 flex items-center gap-2 text-base">
                <span className="text-white font-semibold">{activeKeyImage?.caption || "Attached Image"}</span>
                {activeKeyImage && (
                  <span className="text-xs font-normal text-slate-400">
                    · Image {activeKeyImageIndex + 1} of {keyImages.length}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                High-resolution ultrasound key image view
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className={cn(
                  "h-8 border text-xs transition-colors",
                  eyeFadeEnabled
                    ? "bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                )}
                onClick={() => setEyeFadeEnabled(!eyeFadeEnabled)}
                title="Toggle soft eye aperture fade"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                {eyeFadeEnabled ? "Eye Fade On" : "Eye Fade Off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={prevFrame}
                disabled={!canPrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                onClick={nextFrame}
                disabled={!canNext}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center p-2 bg-black rounded-lg overflow-hidden relative">
            {activeKeyImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeKeyImage.dataUrl}
                alt={activeKeyImage.caption}
                className="max-h-full max-w-full object-contain rounded select-none"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
