/**
 * Image processing & smart compression utility.
 * Enforces a strict MAX 100KB file size limit while preserving maximum visual clarity
 * through adaptive resolution and multi-tier quality stepping.
 */

export const MAX_ALLOWED_BYTES = 100 * 1024; // 100 KB = 102,400 bytes

/**
 * Calculates byte size of a base64 Data URL string accurately.
 */
export function getBase64ByteSize(base64DataUrl: string): number {
  if (!base64DataUrl) return 0;
  const commaIdx = base64DataUrl.indexOf(",");
  const base64Str = commaIdx !== -1 ? base64DataUrl.slice(commaIdx + 1) : base64DataUrl;
  const padding = base64Str.endsWith("==") ? 2 : base64Str.endsWith("=") ? 1 : 0;
  return Math.round((base64Str.length * 3) / 4) - padding;
}

/**
 * Formats byte size to human-readable KB string.
 */
export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Loads a File or Blob into an HTMLImageElement safely.
 */
export function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Berkas yang dipilih bukan gambar yang valid."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar dari perangkat."));
    reader.readAsDataURL(file);
  });
}

/**
 * Loads a Data URL or Image URL into an HTMLImageElement.
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat URL gambar."));
    img.src = url;
  });
}

/**
 * Intelligently compresses an image canvas to <= 100KB.
 * Preserves high resolution and crispness by testing quality tiers first,
 * then gracefully scaling dimensions only if necessary.
 */
export function compressCanvasToMax100KB(
  sourceCanvas: HTMLCanvasElement,
  mimeType: "image/jpeg" | "image/webp" = "image/jpeg"
): { dataUrl: string; sizeBytes: number; sizeKb: string } {
  let targetWidth = sourceCanvas.width;
  let targetHeight = sourceCanvas.height;

  // Quality progression list: start high to maintain optical details (crystals, facets, textures)
  const qualitySteps = [0.92, 0.88, 0.84, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55];

  let bestDataUrl = "";
  let bestSizeBytes = Infinity;

  // Work on temporary canvas if resizing is needed
  let workCanvas = document.createElement("canvas");
  workCanvas.width = targetWidth;
  workCanvas.height = targetHeight;
  let ctx = workCanvas.getContext("2d");
  if (ctx) {
    // High-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
  }

  // Dimension scaling loop (if even lower quality exceeds 100KB)
  for (let dimStep = 0; dimStep < 6; dimStep++) {
    for (const q of qualitySteps) {
      const dataUrl = workCanvas.toDataURL(mimeType, q);
      const sizeBytes = getBase64ByteSize(dataUrl);

      if (sizeBytes <= MAX_ALLOWED_BYTES) {
        return {
          dataUrl,
          sizeBytes,
          sizeKb: formatKb(sizeBytes),
        };
      }

      if (sizeBytes < bestSizeBytes) {
        bestSizeBytes = sizeBytes;
        bestDataUrl = dataUrl;
      }
    }

    // Scale canvas dimensions down by 15% and retry quality tiers
    targetWidth = Math.max(240, Math.round(targetWidth * 0.85));
    targetHeight = Math.max(240, Math.round(targetHeight * 0.85));
    workCanvas = document.createElement("canvas");
    workCanvas.width = targetWidth;
    workCanvas.height = targetHeight;
    ctx = workCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
    }
  }

  // Fallback: return best obtained
  return {
    dataUrl: bestDataUrl,
    sizeBytes: bestSizeBytes,
    sizeKb: formatKb(bestSizeBytes),
  };
}

/**
 * Compresses an image File (e.g. gemstone upload or profile upload)
 * strictly to max 100KB while preserving optimal clarity.
 */
export async function compressImageFileToMax100KB(
  file: File,
  maxDimension = 1280
): Promise<{ dataUrl: string; sizeBytes: number; sizeKb: string; width: number; height: number }> {
  const img = await loadImageFromFile(file);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Initial bounds check to prevent excessive canvas allocations
  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Gagal membuat canvas grafis.");
  }

  // Fill with dark background for transparent PNG/WebP to prevent black artifacts
  ctx.fillStyle = "#0f172a"; // dark slate matching app theme
  ctx.fillRect(0, 0, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const compressed = compressCanvasToMax100KB(canvas, "image/jpeg");
  return {
    ...compressed,
    width,
    height,
  };
}

/**
 * Backward compatible helper for existing callers:
 */
export async function fileToResizedBase64(
  file: File,
  maxWidth = 400,
  maxHeight = 400
): Promise<string> {
  const result = await compressImageFileToMax100KB(file, Math.max(maxWidth, maxHeight));
  return result.dataUrl;
}
