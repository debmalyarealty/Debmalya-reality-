export interface ResponsiveImageSources {
  webpSrcSet: string;
  jpegSrcSet: string;
  webpSrc: string;
  jpegSrc: string;
}

export const MAX_INPUT_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_UPLOADED_IMAGE_BYTES = 500 * 1024; // 500 KB
export const MAX_PROPERTY_PHOTOS = 20;

export interface CompressedImageResult {
  file: File;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  format: 'webp';
}

const LOCAL_IMAGE_PATTERN = /^(\/src\/assets\/images\/[^?#]+)\.(jpe?g|webp)$/i;

export function resolveLocalResponsiveSources(
  src?: string
): ResponsiveImageSources | null {
  if (!src) return null;
  const match = src.trim().match(LOCAL_IMAGE_PATTERN);
  if (!match) return null;

  const rawBase = match[1].replace(/-(480w|900w)$/i, '');
  const isHero = rawBase.includes('/hero_siliguri_villa_');

  if (isHero) {
    return {
      webpSrcSet: `${rawBase}-900w.webp 900w, ${rawBase}.webp 1376w`,
      jpegSrcSet: `${rawBase}-900w.jpg 900w, ${rawBase}.jpg 1376w`,
      webpSrc: `${rawBase}.webp`,
      jpegSrc: `${rawBase}.jpg`,
    };
  }

  return {
    webpSrcSet: `${rawBase}-480w.webp 480w, ${rawBase}.webp 900w`,
    jpegSrcSet: `${rawBase}-480w.jpg 480w, ${rawBase}.jpg 900w`,
    webpSrc: `${rawBase}.webp`,
    jpegSrc: `${rawBase}.jpg`,
  };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2).replace(/\.?0+$/, '')} MB`;
}

export function computeTargetDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxLongestSide: number
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(naturalWidth));
  const safeH = Math.max(1, Math.round(naturalHeight));
  const longest = Math.max(safeW, safeH);
  if (longest <= maxLongestSide) {
    return { width: safeW, height: safeH };
  }
  const scale = maxLongestSide / longest;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export function buildPropertyImageAlt(
  title: string,
  location?: string,
  index?: number
): string {
  const cleanTitle = title.trim() || 'Siliguri property';
  const cleanLoc = location?.trim();
  const base =
    cleanLoc && !cleanTitle.toLowerCase().includes(cleanLoc.toLowerCase())
      ? `${cleanTitle}, ${cleanLoc}`
      : cleanTitle;
  if (typeof index === 'number' && index >= 0) {
    return `${base} — photo ${index + 1}`;
  }
  return base;
}

export function reorderItems<T>(
  list: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function makeItemFirst<T>(list: T[], index: number): T[] {
  return reorderItems(list, index, 0);
}

interface DecodedBitmap {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  cleanup: () => void;
}

async function decodeImageFile(file: File): Promise<DecodedBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fall back to HTMLImageElement decoding below
    }
  }

  return await new Promise<DecodedBitmap>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not read "${file.name}". Please try another photo.`));
    };
    img.src = objectUrl;
  });
}

function encodeCanvasToWebp(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Your browser could not compress this photo.'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

export async function compressImageForUpload(
  file: File,
  options: {
    maxLongestSide: number;
    quality?: number;
    maxBytes?: number;
  }
): Promise<CompressedImageResult> {
  const mime = (file.type || '').toLowerCase();
  const isImageByExt = /\.(jpe?g|png|webp|avif|gif|bmp|heic|heif)$/i.test(
    file.name
  );
  if (!mime.startsWith('image/') && !isImageByExt) {
    throw new Error(
      `"${file.name}" is not a supported image file. Please choose a JPEG, PNG, or WebP photo.`
    );
  }
  if (file.size <= 0) {
    throw new Error(`"${file.name}" appears to be empty.`);
  }
  if (file.size > MAX_INPUT_IMAGE_BYTES) {
    throw new Error(
      `"${file.name}" is ${formatFileSize(file.size)}. Please choose a photo under 15 MB.`
    );
  }

  const maxBytes = options.maxBytes ?? MAX_UPLOADED_IMAGE_BYTES;
  const startQuality = options.quality ?? 0.8;
  const decoded = await decodeImageFile(file);

  try {
    let { width, height } = computeTargetDimensions(
      decoded.width,
      decoded.height,
      options.maxLongestSide
    );

    const canvas = document.createElement('canvas');
    const qualitySteps = Array.from(
      new Set([startQuality, 0.72, 0.64, 0.56, 0.48, 0.4])
    ).filter((q) => q > 0 && q <= startQuality);

    let bestBlob: Blob | null = null;
    let finalW = width;
    let finalH = height;

    for (let scalePass = 0; scalePass < 4; scalePass++) {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not initialize image compressor in this browser.');
      }
      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      decoded.draw(ctx, width, height);

      for (const q of qualitySteps) {
        const blob = await encodeCanvasToWebp(canvas, q);
        bestBlob = blob;
        finalW = width;
        finalH = height;
        if (blob.size <= maxBytes) {
          break;
        }
      }

      if (bestBlob && bestBlob.size <= maxBytes) {
        break;
      }

      width = Math.max(320, Math.round(width * 0.8));
      height = Math.max(320, Math.round(height * 0.8));
    }

    if (!bestBlob) {
      throw new Error(`Could not compress "${file.name}".`);
    }
    if (bestBlob.size > maxBytes) {
      throw new Error(
        `"${file.name}" remained larger than ${formatFileSize(maxBytes)} after compression.`
      );
    }

    const baseName =
      file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-') ||
      'photo';
    const compressedFile = new File([bestBlob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      originalBytes: file.size,
      compressedBytes: compressedFile.size,
      width: finalW,
      height: finalH,
      format: 'webp',
    };
  } finally {
    decoded.cleanup();
  }
}
