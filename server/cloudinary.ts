import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

let isCloudinaryConfigured = false;

export function configureCloudinary(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      secure: true,
    });
    isCloudinaryConfigured = true;
    return true;
  }

  return false;
}

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  publicId?: string;
  source: "cloudinary" | "local_fallback";
  message?: string;
}

export async function uploadMediaPhoto(
  imageSource: string,
  folder: string = "batu_mulia"
): Promise<CloudinaryUploadResult> {
  const configured = configureCloudinary();

  if (configured) {
    try {
      console.log(`[Cloudinary] Uploading photo to folder ${folder}...`);
      const res: UploadApiResponse = await cloudinary.uploader.upload(imageSource, {
        folder: `komunitas_batu_mulia/${folder}`,
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" },
          { width: 1200, crop: "limit" },
        ],
      });

      console.log(`[Cloudinary] Photo uploaded successfully: ${res.secure_url}`);
      return {
        success: true,
        url: res.secure_url,
        publicId: res.public_id,
        source: "cloudinary",
      };
    } catch (err: any) {
      console.error("[Cloudinary] Upload error:", err?.message || err);
      // If upload fails, fallback to passing imageSource so user flow isn't blocked
      return {
        success: true,
        url: imageSource,
        source: "local_fallback",
        message: `Cloudinary upload warning: ${err?.message || "Gagal upload, menggunakan media lokal"}.`,
      };
    }
  } else {
    console.log(
      "[Cloudinary] Credentials not configured in environment. Using fallback data URL."
    );
    return {
      success: true,
      url: imageSource,
      source: "local_fallback",
      message:
        "Foto disimpan. Untuk hosting permanen Cloudinary, masukkan CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, dan CLOUDINARY_API_SECRET (Akun: ibnu.92sholihin@gmail.com).",
    };
  }
}
