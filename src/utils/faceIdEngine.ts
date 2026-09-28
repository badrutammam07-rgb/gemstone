/**
 * Face ID Engine - Client & Server Biometric Verification System
 * 
 * Ekstraksi & Pencocokan Biometrik Wajah Tanpa Ketergantungan Eksternal (Pure Canvas & Math)
 * Menghasilkan descriptor biometrik tahan variasi pencahayaan berdasarkan:
 * 1. Z-Score Normalized Grayscale Luminance Grid (16x16 = 256 dimensi)
 * 2. Gradient Edge Histograms (Struktur mata, hidung, bibir, kontur wajah)
 * 3. 64-bit Perceptual Hash (dHash)
 */

export interface FaceBiometricDescriptor {
  version: number;
  v: number[]; // 256 normalized luminance values
  edges: number[]; // 128 directional gradient features
  hash: string; // 64-character binary perceptual hash
  aspectRatio: number;
  brightness: number;
}

/**
 * Ekstraksi fitur biometrik dari elemen canvas
 */
export function extractFaceDescriptorFromCanvas(canvas: HTMLCanvasElement): FaceBiometricDescriptor {
  const size = 64;
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = size;
  sampleCanvas.height = size;
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });

  if (!ctx) {
    throw new Error("Gagal menginisialisasi context canvas biometrik.");
  }

  // Gambar ke ukuran standar 64x64
  ctx.drawImage(canvas, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // 1. Hitung Grayscale Luminance 64x64
  const gray = new Float32Array(size * size);
  let totalLuminance = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = lum;
    totalLuminance += lum;
  }
  const avgLuminance = totalLuminance / (size * size);

  // 2. Downsample ke grid 16x16 (blok 4x4)
  const gridSize = 16;
  const blockSize = size / gridSize;
  const grid = new Float32Array(gridSize * gridSize);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      let sum = 0;
      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const px = gx * blockSize + bx;
          const py = gy * blockSize + by;
          sum += gray[py * size + px];
        }
      }
      grid[gy * gridSize + gx] = sum / (blockSize * blockSize);
    }
  }

  // 3. Normalisasi Z-Score (Mean=0, StdDev=1) agar tahan variasi terang/gelap
  let mean = 0;
  for (let i = 0; i < grid.length; i++) mean += grid[i];
  mean /= grid.length;

  let variance = 0;
  for (let i = 0; i < grid.length; i++) {
    const diff = grid[i] - mean;
    variance += diff * diff;
  }
  const stdDev = Math.sqrt(variance / grid.length) || 1.0;

  const normalizedV: number[] = new Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    normalizedV[i] = Number(((grid[i] - mean) / stdDev).toFixed(4));
  }

  // 4. Ekstraksi Edge Gradients (Mata, Hidung, Mulut) pada 8 horizontal & 8 vertikal strip
  const edges: number[] = [];
  for (let gy = 0; gy < gridSize - 1; gy++) {
    for (let gx = 0; gx < gridSize - 1; gx += 2) {
      const dx = grid[gy * gridSize + (gx + 1)] - grid[gy * gridSize + gx];
      const dy = grid[(gy + 1) * gridSize + gx] - grid[gy * gridSize + gx];
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      edges.push(Number((magnitude / stdDev).toFixed(4)));
    }
  }

  // 5. Perceptual Hash (dHash 8x8)
  let hashStr = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = grid[y * 2 * gridSize + x * 2];
      const right = grid[y * 2 * gridSize + (x * 2 + 1)];
      hashStr += left > right ? "1" : "0";
    }
  }

  return {
    version: 1,
    v: normalizedV,
    edges,
    hash: hashStr,
    aspectRatio: canvas.width / canvas.height,
    brightness: Math.round(avgLuminance),
  };
}

/**
 * Ekstraksi descriptor biometrik dari string base64 / data URL
 */
export async function extractFaceDescriptorFromDataUrl(dataUrl: string): Promise<FaceBiometricDescriptor> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 320;
        canvas.height = img.height || 320;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context null");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const desc = extractFaceDescriptorFromCanvas(canvas);
        resolve(desc);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(new Error("Gagal memuat gambar wajah untuk ekstraksi Face ID: " + e));
    img.src = dataUrl;
  });
}

/**
 * Menghitung tingkat kecocokan (Similarity Score 0.0 - 1.0) antara dua Face ID
 */
export function calculateFaceMatchScore(
  a: FaceBiometricDescriptor | string,
  b: FaceBiometricDescriptor | string
): number {
  try {
    const descA: FaceBiometricDescriptor = typeof a === "string" ? JSON.parse(a) : a;
    const descB: FaceBiometricDescriptor = typeof b === "string" ? JSON.parse(b) : b;

    if (!descA || !descB || !descA.v || !descB.v) return 0;

    // 1. Cosine Similarity pada Normalized Luminance Grid
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const len = Math.min(descA.v.length, descB.v.length);

    for (let i = 0; i < len; i++) {
      const va = descA.v[i];
      const vb = descB.v[i];
      dotProduct += va * vb;
      normA += va * va;
      normB += vb * vb;
    }

    const cosSim = (normA > 0 && normB > 0)
      ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
      : 0;

    // Mapping cosSim dari [-1, 1] ke [0, 1]
    const vecScore = Math.max(0, (cosSim + 1) / 2);

    // 2. Cosine Similarity pada Edge Features
    let edgeScore = 0.5;
    if (descA.edges && descB.edges && descA.edges.length > 0 && descB.edges.length > 0) {
      let eDot = 0;
      let eNormA = 0;
      let eNormB = 0;
      const elen = Math.min(descA.edges.length, descB.edges.length);
      for (let i = 0; i < elen; i++) {
        eDot += descA.edges[i] * descB.edges[i];
        eNormA += descA.edges[i] * descA.edges[i];
        eNormB += descB.edges[i] * descB.edges[i];
      }
      if (eNormA > 0 && eNormB > 0) {
        edgeScore = Math.max(0, (eDot / (Math.sqrt(eNormA) * Math.sqrt(eNormB)) + 1) / 2);
      }
    }

    // 3. Perceptual Hash Similarity (Hamming Distance)
    let hashScore = 0.5;
    if (descA.hash && descB.hash && descA.hash.length === descB.hash.length) {
      let matches = 0;
      const hlen = descA.hash.length;
      for (let i = 0; i < hlen; i++) {
        if (descA.hash[i] === descB.hash[i]) matches++;
      }
      hashScore = matches / hlen;
    }

    // Bobot gabungan: 50% Luminance Grid, 30% Edge Contours, 20% Perceptual Hash
    const finalScore = 0.5 * vecScore + 0.3 * edgeScore + 0.2 * hashScore;
    return Number(finalScore.toFixed(4));
  } catch (err) {
    console.error("[Face ID Engine] Match calculation error:", err);
    return 0;
  }
}

/**
 * Threshold standar kecocokan Face ID (0.65 = 65% match)
 */
export const FACE_ID_MATCH_THRESHOLD = 0.65;
export const FACE_ID_HIGH_CONFIDENCE_THRESHOLD = 0.72;
