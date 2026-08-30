import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

/**
 * Cloudinary upload for scanned leaf photos.
 *
 * Credentials live in `.env.local`. When they are missing the helper reports
 * that instead of throwing, so a scan still returns its prediction on a
 * machine that has not been given Cloudinary keys.
 */

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

/** Everything the scan document needs to render and later delete the image. */
export type UploadedImage = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && API_KEY && API_SECRET);
}

let configured = false;

function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: CLOUD_NAME,
      api_key: API_KEY,
      api_secret: API_SECRET,
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
}

/**
 * Uploads a leaf photo under `ceylonguard/scans/<clerkId>`.
 *
 * The eager transform keeps the stored original but hands the UI a capped,
 * auto-format copy so scan history does not pull down 10 MB phone photos.
 */
export async function uploadScanImage(
  buffer: Buffer,
  clerkId: string,
): Promise<UploadedImage> {
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = client().uploader.upload_stream(
      {
        folder: `ceylonguard/scans/${clerkId}`,
        resource_type: "image",
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          reject(error ?? new Error("Cloudinary returned an empty response."));
          return;
        }

        resolve(uploaded);
      },
    );

    stream.end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

/** Used to clean up an upload whose scan row failed to save. */
export async function deleteScanImage(publicId: string): Promise<void> {
  await client().uploader.destroy(publicId);
}
