import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Check,
  ShieldCheck,
  Sparkles,
  Camera,
} from "lucide-react";
import { compressCanvasToMax100KB } from "../utils/imageUtils";

interface Props {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onConfirm: (compressedDataUrl: string, sizeKb: string) => void;
}

export const ProfileCropModal: React.FC<Props> = ({
  isOpen,
  imageSrc,
  onClose,
  onConfirm,
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [minScale, setMinScale] = useState<number>(0.5);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport dimensions
  const VIEWPORT_SIZE = 300; // Displayed size of the crop stage
  const CIRCLE_RADIUS = 120; // Radius of the circular avatar mask (240px diameter)

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc || !isOpen) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);

      // Calculate initial fit: ensure shortest dimension covers the circle
      const circleDiameter = CIRCLE_RADIUS * 2;
      const fitScale = Math.max(circleDiameter / img.width, circleDiameter / img.height);
      const calculatedMinScale = Math.max(0.3, fitScale * 0.6);
      setMinScale(calculatedMinScale);
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // Draw the interactive canvas with the circular mask
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = VIEWPORT_SIZE;
    const height = VIEWPORT_SIZE;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Image with pan and zoom scale
    ctx.save();
    ctx.translate(centerX + position.x, centerY + position.y);
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, -image.width / 2, -image.height / 2);
    ctx.restore();

    // 2. Draw darkened overlay outside the circle
    ctx.save();
    ctx.fillStyle = "rgba(2, 6, 23, 0.75)"; // slate-950 dark overlay
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();

    // 3. Draw luminous guide ring around the circle
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#10b981"; // emerald-500
    ctx.shadowColor = "rgba(16, 185, 129, 0.5)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle inner dashed ring for precision centering
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, CIRCLE_RADIUS - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Also update miniature live preview
    generateLivePreview();
  }, [image, scale, position]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Generate real-time live preview of circular result
  const generateLivePreview = () => {
    if (!image) return;
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 96;
    previewCanvas.height = 96;
    const pCtx = previewCanvas.getContext("2d");
    if (!pCtx) return;

    // Draw circular clip
    pCtx.beginPath();
    pCtx.arc(48, 48, 48, 0, Math.PI * 2);
    pCtx.clip();

    // Draw image matching exact crop view
    const pScale = (96 / (CIRCLE_RADIUS * 2)) * scale;
    const pX = 48 + position.x * (96 / (CIRCLE_RADIUS * 2));
    const pY = 48 + position.y * (96 / (CIRCLE_RADIUS * 2));

    pCtx.translate(pX, pY);
    pCtx.scale(pScale / scale, pScale / scale);
    pCtx.translate(-pX, -pY);

    pCtx.translate(pX, pY);
    pCtx.scale(scale * (96 / (CIRCLE_RADIUS * 2)), scale * (96 / (CIRCLE_RADIUS * 2)));
    pCtx.drawImage(image, -image.width / 2, -image.height / 2);

    setPreviewDataUrl(previewCanvas.toDataURL("image/jpeg", 0.7));
  };

  // Mouse / Touch Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom over the canvas
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(3.5, Math.max(minScale, scale * zoomFactor));
    setScale(newScale);
  };

  // Zoom controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(3.5, prev + 0.15));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(minScale, prev - 0.15));
  };

  const handleResetFit = () => {
    if (!image) return;
    const circleDiameter = CIRCLE_RADIUS * 2;
    const fitScale = Math.max(circleDiameter / image.width, circleDiameter / image.height);
    setScale(fitScale);
    setPosition({ x: 0, y: 0 });
  };

  // Apply Crop & Smart Compression to Max 100KB
  const handleConfirmCrop = async () => {
    if (!image) return;

    setIsProcessing(true);
    try {
      // Create high-res crop canvas for output (e.g. 480x480 for crisp retina display)
      const outputDim = 480;
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = outputDim;
      cropCanvas.height = outputDim;
      const cCtx = cropCanvas.getContext("2d");
      if (!cCtx) throw new Error("Gagal menginisialisasi canvas.");

      // Calculate mapping from the 240px circle to the 480px output
      const ratio = outputDim / (CIRCLE_RADIUS * 2);

      cCtx.fillStyle = "#0f172a";
      cCtx.fillRect(0, 0, outputDim, outputDim);

      cCtx.imageSmoothingEnabled = true;
      cCtx.imageSmoothingQuality = "high";

      cCtx.translate(outputDim / 2 + position.x * ratio, outputDim / 2 + position.y * ratio);
      cCtx.scale(scale * ratio, scale * ratio);
      cCtx.drawImage(image, -image.width / 2, -image.height / 2);

      // Automatically compress canvas to MAX 100KB
      const result = compressCanvasToMax100KB(cropCanvas, "image/jpeg");

      onConfirm(result.dataUrl, result.sizeKb);
      onClose();
    } catch (err) {
      console.error("Gagal memproses pemotongan foto:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-profile-crop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in my-4">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Sesuaikan Foto Profil</h3>
              <p className="text-xs text-slate-400">
                Perbesar, perkecil & geser agar pas di dalam lingkaran
              </p>
            </div>
          </div>
          <button
            id="btn-close-crop-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Crop Body */}
        <div className="p-4 sm:p-5 flex flex-col items-center space-y-4">
          {/* Canvas Viewport */}
          <div
            ref={containerRef}
            className="relative rounded-2xl overflow-hidden shadow-inner border border-slate-700 bg-slate-950 flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onWheel={handleWheel}
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          >
            <canvas
              ref={canvasRef}
              width={VIEWPORT_SIZE}
              height={VIEWPORT_SIZE}
              className="w-full h-full block"
            />

            {/* Instruction tooltip */}
            <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
              <span className="bg-slate-900/90 text-slate-300 text-[10px] font-medium px-2.5 py-1 rounded-full border border-slate-700 backdrop-blur-sm shadow-sm inline-flex items-center gap-1">
                <Move className="w-3 h-3 text-emerald-400" />
                Geser untuk mengarahkan posisi
              </span>
            </div>
          </div>

          {/* Zoom Slider & Quick Controls */}
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
              <span className="flex items-center gap-1 text-slate-300">
                <ZoomIn className="w-3.5 h-3.5 text-emerald-400" />
                Zoom / Skala Foto
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round(scale * 100)}%
              </span>
            </div>

            {/* Slider with +/- buttons */}
            <div className="flex items-center gap-3">
              <button
                id="btn-crop-zoom-out"
                type="button"
                onClick={handleZoomOut}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                title="Perkecil"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                id="slider-crop-zoom"
                type="range"
                min={minScale}
                max={3.5}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />

              <button
                id="btn-crop-zoom-in"
                type="button"
                onClick={handleZoomIn}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2 rounded-xl border border-slate-700 transition-colors cursor-pointer"
                title="Perbesar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                id="btn-crop-reset"
                type="button"
                onClick={handleResetFit}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-2 rounded-xl border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                title="Paskan ke ukuran lingkaran"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Paskan</span>
              </button>
            </div>

            {/* Live miniature preview & compression badge */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400 shrink-0 bg-black shadow-md">
                  {previewDataUrl && (
                    <img
                      src={previewDataUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-white block">Pratinjau Avatar</span>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Siap diterapkan
                  </span>
                </div>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl px-2.5 py-1.5 text-right">
                <span className="text-[10px] text-emerald-300 font-bold block flex items-center gap-1 justify-end">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Auto Kompres
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Maks. 100 KB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            id="btn-apply-cropped-photo"
            type="button"
            onClick={handleConfirmCrop}
            disabled={isProcessing || !image}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-lg shadow-emerald-950/50"
          >
            <Check className="w-4 h-4" />
            <span>{isProcessing ? "Mengompres & Menyimpan..." : "Terapkan Foto (Max 100KB)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
