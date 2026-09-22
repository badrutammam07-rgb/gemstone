/**
 * Utility untuk parsing dan memvalidasi URL video dari YouTube, TikTok, dan Instagram
 * Mendukung pemutaran langsung di dalam aplikasi (embedded player)
 */

export type VideoPlatform = "youtube" | "tiktok" | "instagram" | "direct" | "unknown";

export interface ParsedVideo {
  platform: VideoPlatform;
  platformName: string;
  originalUrl: string;
  embedUrl: string | null;
  videoId: string | null;
  isDirectVideo: boolean;
  isValid: boolean;
  aspectRatio: "16/9" | "9/16" | "4/5" | "1/1";
  error?: string;
}

export function parseVideoUrl(rawUrl: string): ParsedVideo {
  const url = (rawUrl || "").trim();

  if (!url) {
    return {
      platform: "unknown",
      platformName: "Belum Diisi",
      originalUrl: "",
      embedUrl: null,
      videoId: null,
      isDirectVideo: false,
      isValid: false,
      aspectRatio: "16/9",
      error: "URL video wajib diisi (YouTube, TikTok, atau Instagram).",
    };
  }

  // 1. YouTube (youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/..., youtube.com/embed/...)
  const ytShortsMatch = url.match(/(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (ytShortsMatch && ytShortsMatch[1]) {
    const videoId = ytShortsMatch[1];
    return {
      platform: "youtube",
      platformName: "Video Shorts",
      originalUrl: url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&playsinline=1&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3`,
      videoId,
      isDirectVideo: false,
      isValid: true,
      aspectRatio: "9/16",
    };
  }

  const ytStandardMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (ytStandardMatch && ytStandardMatch[1]) {
    const videoId = ytStandardMatch[1];
    return {
      platform: "youtube",
      platformName: "Video",
      originalUrl: url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&playsinline=1&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3`,
      videoId,
      isDirectVideo: false,
      isValid: true,
      aspectRatio: "16/9",
    };
  }

  // 2. TikTok (tiktok.com/@username/video/1234567890..., tiktok.com/embed/v2/1234567890..., vt.tiktok.com/...)
  const tiktokStandardMatch = url.match(
    /tiktok\.com\/(?:@[\w.-]+\/video\/|embed\/v2\/|v\/)(\d+)/i
  );
  if (tiktokStandardMatch && tiktokStandardMatch[1]) {
    const videoId = tiktokStandardMatch[1];
    return {
      platform: "tiktok",
      platformName: "Video",
      originalUrl: url,
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      videoId,
      isDirectVideo: false,
      isValid: true,
      aspectRatio: "9/16",
    };
  }

  const tiktokShortMatch = url.match(/(?:vt|vm)\.tiktok\.com\/([a-zA-Z0-9_-]+)/i);
  if (tiktokShortMatch && tiktokShortMatch[1]) {
    return {
      platform: "tiktok",
      platformName: "Video",
      originalUrl: url,
      // Untuk shortlink, embed web player tiktok dapat langsung diakses
      embedUrl: `https://www.tiktok.com/embed/v2/${tiktokShortMatch[1]}`,
      videoId: tiktokShortMatch[1],
      isDirectVideo: false,
      isValid: true,
      aspectRatio: "9/16",
    };
  }

  // 3. Instagram (instagram.com/reel/ID..., instagram.com/p/ID..., instagram.com/tv/ID...)
  // Gunakan /embed/ tanpa /captioned/ agar username pembuat akun dan deskripsi teks tidak ditampilkan
  const igMatch = url.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch && igMatch[1]) {
    const postId = igMatch[1];
    const isReel = url.toLowerCase().includes("/reel/");
    return {
      platform: "instagram",
      platformName: "Video",
      originalUrl: url,
      embedUrl: `https://www.instagram.com/p/${postId}/embed/`,
      videoId: postId,
      isDirectVideo: false,
      isValid: true,
      aspectRatio: isReel ? "9/16" : "4/5",
    };
  }

  // 4. Direct Video Stream (.mp4, .webm, Cloudinary Video)
  const isDirect =
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) ||
    (url.includes("cloudinary.com") && url.includes("/video/upload/"));
  if (isDirect) {
    return {
      platform: "direct",
      platformName: "Video Langsung (MP4)",
      originalUrl: url,
      embedUrl: url,
      videoId: null,
      isDirectVideo: true,
      isValid: true,
      aspectRatio: "16/9",
    };
  }

  // Tidak cocok dengan platform manapun
  return {
    platform: "unknown",
    platformName: "Tidak Dikenal",
    originalUrl: url,
    embedUrl: null,
    videoId: null,
    isDirectVideo: false,
    isValid: false,
    aspectRatio: "16/9",
    error: "URL tidak valid. Masukkan URL video dari YouTube, TikTok, atau Instagram.",
  };
}
