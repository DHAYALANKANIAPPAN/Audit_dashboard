/**
 * Shop-Floor Photo Evidence Utility
 * Compresses camera captures client-side before upload to optimize for weak networks.
 * Separates "prepare photo" from "upload photo" to support offline local caching.
 */

/**
 * Compresses an image file using an HTML5 Canvas.
 * Caps the maximum edge at 1600px and encodes to JPEG at ~0.8 quality.
 *
 * @param {File} file - The raw photo file from camera or file picker
 * @param {number} maxDimension - Max length of the longest edge (default 1600px)
 * @param {number} quality - JPEG compression quality (default 0.8)
 * @returns {Promise<{ blob: Blob, previewUrl: string, fileName: string, originalSize: number, compressedSize: number }>}
 */
export async function compressImage(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image in canvas'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale if dimensions exceed maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas 2d context'));
        }

        // Draw and compress to JPEG
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Image compression failed'));
            }

            const previewUrl = URL.createObjectURL(blob);
            resolve({
              blob,
              previewUrl,
              fileName: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
              originalSize: file.size,
              compressedSize: blob.size
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Step 1: Prepare photo (Compress and create local object preview)
 * Ready to be stored in IndexedDB for offline mode or uploaded immediately.
 */
export async function preparePhoto(file) {
  const compressed = await compressImage(file, 1600, 0.8);
  const tempPhotoId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return {
    tempId: tempPhotoId,
    blob: compressed.blob,
    previewUrl: compressed.previewUrl,
    fileName: compressed.fileName,
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
    status: 'READY', // 'READY' | 'UPLOADING' | 'UPLOADED' | 'ERROR'
    evidenceId: null,
    remoteUrl: null,
    error: null
  };
}
