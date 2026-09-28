/**
 * Server Face ID Matching Engine
 * 
 * Verifikasi & Perhitungan Kesamaan Biometrik Wajah di Server
 */

export interface FaceBiometricDescriptor {
  version: number;
  v: number[]; // 256 normalized luminance values
  edges: number[]; // 128 directional gradient features
  hash: string; // 64-character binary perceptual hash
  aspectRatio?: number;
  brightness?: number;
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

    const cosSim =
      normA > 0 && normB > 0
        ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
        : 0;

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
    console.error("[Server Face ID] Match calculation error:", err);
    return 0;
  }
}

export const FACE_ID_MATCH_THRESHOLD = 0.65;
export const FACE_ID_HIGH_CONFIDENCE_THRESHOLD = 0.72;
