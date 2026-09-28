/**
 * Server Face ID Matching Engine
 * 
 * Verifikasi & Perhitungan Kesamaan Biometrik Wajah di Server
 * Presisi Tinggi & Super Akurat
 */

export interface FaceBiometricDescriptor {
  version: number;
  v: number[]; // 256 normalized luminance values
  edges: number[]; // Directional gradient features
  hash: string; // 64-character binary perceptual hash
  lbp?: number[]; // Local Binary Pattern histogram (32 features)
  proportions?: number[]; // Facial structural ratios
  aspectRatio?: number;
  brightness?: number;
}

/**
 * Menghitung tingkat kecocokan (Similarity Score 0.0 - 1.0) antara dua Face ID
 * Menggunakan kurva diskriminatif tinggi agar orang yang berbeda terpisah jelas
 * dan pemilik asli mendapatkan skor tinggi yang akurat.
 */
export function calculateFaceMatchScore(
  a: FaceBiometricDescriptor | string,
  b: FaceBiometricDescriptor | string
): number {
  try {
    const descA: FaceBiometricDescriptor = typeof a === "string" ? JSON.parse(a) : a;
    const descB: FaceBiometricDescriptor = typeof b === "string" ? JSON.parse(b) : b;

    if (!descA || !descB || !descA.v || !descB.v) return 0;

    // 1. Cosine Similarity pada Normalized Luminance Grid (256 dimensi)
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

    const cosSimV = (normA > 0 && normB > 0)
      ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
      : 0;

    // Skala diskriminatif non-linear
    const vecScore = Math.max(0, Math.min(1, Math.pow(Math.max(0, (cosSimV - 0.25) / 0.75), 1.15)));

    // 2. Local Binary Patterns (LBP) Histogram Similarity
    let lbpScore = 0;
    let hasLbp = false;
    if (descA.lbp && descB.lbp && descA.lbp.length > 0 && descB.lbp.length > 0) {
      hasLbp = true;
      let lDot = 0, lNormA = 0, lNormB = 0;
      const lLen = Math.min(descA.lbp.length, descB.lbp.length);
      for (let i = 0; i < lLen; i++) {
        lDot += descA.lbp[i] * descB.lbp[i];
        lNormA += descA.lbp[i] * descA.lbp[i];
        lNormB += descB.lbp[i] * descB.lbp[i];
      }
      const cosLbp = (lNormA > 0 && lNormB > 0) ? lDot / (Math.sqrt(lNormA) * Math.sqrt(lNormB)) : 0;
      lbpScore = Math.max(0, Math.min(1, Math.pow(Math.max(0, (cosLbp - 0.30) / 0.70), 1.1)));
    }

    // 3. Cosine Similarity pada Edge Features
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
        const cosEdge = eDot / (Math.sqrt(eNormA) * Math.sqrt(eNormB));
        edgeScore = Math.max(0, Math.min(1, Math.pow(Math.max(0, (cosEdge - 0.20) / 0.80), 1.1)));
      }
    }

    // 4. Perceptual Hash Similarity (Hamming Distance)
    let hashScore = 0.5;
    if (descA.hash && descB.hash && descA.hash.length === descB.hash.length) {
      let matches = 0;
      const hlen = descA.hash.length;
      for (let i = 0; i < hlen; i++) {
        if (descA.hash[i] === descB.hash[i]) matches++;
      }
      const rawRatio = matches / hlen;
      hashScore = Math.max(0, Math.min(1, (rawRatio - 0.45) / 0.55));
    }

    // 5. Facial Proportions Similarity
    let propScore = 1.0;
    if (descA.proportions && descB.proportions && descA.proportions.length === 3 && descB.proportions.length === 3) {
      let diff = 0;
      for (let i = 0; i < 3; i++) {
        diff += Math.abs(descA.proportions[i] - descB.proportions[i]);
      }
      propScore = Math.max(0, 1 - diff * 2);
    }

    // Bobot gabungan presisi tinggi
    let finalScore: number;
    if (hasLbp) {
      finalScore = 0.45 * vecScore + 0.25 * lbpScore + 0.15 * edgeScore + 0.10 * hashScore + 0.05 * propScore;
    } else {
      finalScore = 0.55 * vecScore + 0.25 * edgeScore + 0.20 * hashScore;
    }

    return Number(finalScore.toFixed(4));
  } catch (err) {
    console.error("[Server Face ID] Match calculation error:", err);
    return 0;
  }
}

export const FACE_ID_MATCH_THRESHOLD = 0.52;
export const FACE_ID_HIGH_CONFIDENCE_THRESHOLD = 0.60;
