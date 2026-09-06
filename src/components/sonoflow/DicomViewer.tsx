"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Wifi, Maximize2, Layers, Upload, ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout } from "@/lib/api-client";

let csInitialized = false;

interface DicomViewerProps {
  accession?: string;
}

export function DicomViewer({ accession }: DicomViewerProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const csRef = useRef<any>(null);
  const csToolsRef = useRef<any>(null);
  const csLoaderRef = useRef<any>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState("Waiting for images...");
  const [loading, setLoading] = useState(false);
  const [lastFetchFailed, setLastFetchFailed] = useState(false);


  const hasImages = imageIds.length > 0;
  const currentFrame = useMemo(() => (hasImages ? currentIndex + 1 : 0), [hasImages, currentIndex]);

  useEffect(() => {
    let mounted = true;
    const element = viewportRef.current;
    (async () => {
      const cornerstone = (await import("cornerstone-core")).default;
      const cornerstoneMath = (await import("cornerstone-math")).default;
      const cornerstoneTools = (await import("cornerstone-tools")).default;
      const cornerstoneWADOImageLoader = (await import("cornerstone-wado-image-loader")).default;
      const Hammer = (await import("hammerjs")).default;
      const dicomParser = (await import("dicom-parser")).default;

      if (!mounted) return;
      csRef.current = cornerstone;
      csToolsRef.current = cornerstoneTools;
      csLoaderRef.current = cornerstoneWADOImageLoader;

      if (!csInitialized) {
        cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
        cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
        cornerstoneTools.external.cornerstone = cornerstone;
        cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
        cornerstoneTools.external.Hammer = Hammer;
        cornerstoneTools.init({ showSVGCursors: true });
        
        // Configure WADO Image Loader for DICOMweb
        cornerstoneWADOImageLoader.configure({
          beforeSend: function(xhr: XMLHttpRequest) {
            // Add custom headers if needed (e.g. Auth)
          }
        });

        csInitialized = true;
      }


      if (!element) return;
      cornerstone.enable(element);
      cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
      cornerstoneTools.addTool(cornerstoneTools.PanTool);
      cornerstoneTools.addTool(cornerstoneTools.ZoomTool, { configuration: { invert: false } });
      cornerstoneTools.setToolActive("Wwwc", { mouseButtonMask: 1 });
      cornerstoneTools.setToolActive("Pan", { mouseButtonMask: 4 });
      cornerstoneTools.setToolActive("Zoom", { mouseButtonMask: 2 });
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

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !csLoaderRef.current) return;
    const ids = Array.from(files).map((file) => csLoaderRef.current.wadouri.fileManager.add(file));
    setImageIds(ids);
    setCurrentIndex(0);
    setStatus(`${ids.length} image(s) loaded`);
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
        return;
      }
      if (!accession) {
        setStatus("Accession number missing for DICOMweb lookup");
        return;
      }

      const studyQuery = accession
        ? `${baseUrl}/studies?AccessionNumber=${encodeURIComponent(accession)}&limit=1`
        : `${baseUrl}/studies?limit=1`;
      const studyRes = await fetchWithTimeout(studyQuery, { timeoutMs: 10000, retries: 1 });
      if (!studyRes.ok) {
        throw new Error(`Study query failed (${studyRes.status})`);
      }
      const studies = await studyRes.json();
      const studyUid = studies?.[0]?.["0020000D"]?.Value?.[0];
      if (!studyUid) {
        setStatus(accession ? `No study found for accession ${accession}` : "No studies found");
        setImageIds([]);
        return;
      }

      const seriesRes = await fetchWithTimeout(`${baseUrl}/studies/${encodeURIComponent(studyUid)}/series`, {
        timeoutMs: 10000,
        retries: 1,
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
          { timeoutMs: 10000, retries: 1 },
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
        setStatus("No renderable instances found");
        setImageIds([]);
        return;
      }

      setImageIds(ids);
      setCurrentIndex(0);
      setStatus(`${ids.length} frame(s) loaded from DICOMweb`);
    } catch (err) {
      setStatus("DICOMweb connection failed");
      setLastFetchFailed(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const nextFrame = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, imageIds.length - 1));
  };

  const prevFrame = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const adjustZoom = (delta: number) => {
    const el = viewportRef.current;
    const cornerstone = csRef.current;
    if (!el || !cornerstone) return;
    const viewport = cornerstone.getViewport(el);
    if (!viewport) return;
    viewport.scale = Math.max(0.1, Math.min(20, viewport.scale + delta));
    cornerstone.setViewport(el, viewport);
  };

  const resetView = () => {
    const el = viewportRef.current;
    const cornerstone = csRef.current;
    if (!el || !cornerstone) return;
    cornerstone.reset(el);
  };

  return (
    <aside className="flex h-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-200 lg:border-l">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-100">DICOM Viewer</h2>
        </div>
        <Badge variant="outline" className="border-emerald-500/40 text-[10px] text-emerald-300">
          <Wifi className="mr-1 h-2.5 w-2.5" /> {hasImages ? "IMAGES LOADED" : "NO IMAGES"}
        </Badge>
      </header>

      <div className="border-b border-slate-800 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,application/dicom"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Upload
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-500/30"
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
            disabled={!hasImages}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={() => adjustZoom(-0.1)}
            disabled={!hasImages}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={resetView}
            disabled={!hasImages}
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
            disabled={!hasImages || currentIndex === 0}
            aria-label="Previous frame"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8 bg-slate-800 text-slate-100 hover:bg-slate-700"
            onClick={nextFrame}
            disabled={!hasImages || currentIndex >= imageIds.length - 1}
            aria-label="Next frame"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

        </div>
      </div>

      <div className="relative flex-1">
        <div ref={viewportRef} className="h-full w-full bg-black" />
        {!hasImages && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-slate-700/60">
              <div className="absolute inset-0 animate-ping rounded-full border border-emerald-500/20" />
              <Crosshair className="h-12 w-12 text-emerald-400/80" strokeWidth={1.2} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-100">Upload DICOM files to begin</p>
              <p className="text-xs text-slate-400">{status}</p>
              {lastFetchFailed && <p className="text-xs text-amber-400">Use Fetch Server again to retry.</p>}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-slate-800 px-4 py-2 text-[10px] text-slate-400">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
            <Layers className="mb-1 h-3 w-3 text-slate-500" />
            Series: {hasImages ? 1 : 0}
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
            <Maximize2 className="mb-1 h-3 w-3 text-slate-500" />
            Frames: {imageIds.length}
          </div>
          <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
            <Crosshair className="mb-1 h-3 w-3 text-slate-500" />
            Frame: {currentFrame}
          </div>
        </div>
        <div className="mt-2 text-center text-[10px] text-slate-500">Left drag: WW/WL · Middle drag: Pan · Right drag: Zoom</div>
      </footer>
    </aside>
  );
}
