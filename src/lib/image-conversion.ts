/**
 * Utility to convert unsupported image formats to JPEG before upload.
 * Telegram only supports JPEG, PNG, GIF, and WebP for photos.
 * AVIF, HEIC, HEIF, BMP, and TIFF need to be converted.
 */

// Formats that Telegram does NOT support for photo uploads
const UNSUPPORTED_IMAGE_FORMATS = [
  'image/avif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'image/x-ms-bmp',
];

/**
 * Check if the file is an image in an unsupported format
 */
export const isUnsupportedImageFormat = (file: File): boolean => {
  return UNSUPPORTED_IMAGE_FORMATS.includes(file.type.toLowerCase());
};

/**
 * Convert an unsupported image format to JPEG using Canvas API.
 * Returns the original file if it's already a supported format.
 */
export const convertToJpegIfNeeded = async (file: File): Promise<File> => {
  // Only convert images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Already a supported format
  if (!isUnsupportedImageFormat(file)) {
    return file;
  }

  console.log(`Converting ${file.name} from ${file.type} to JPEG`);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          console.warn('Canvas context not available, using original file');
          resolve(file);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            
            if (blob) {
              // Replace extension with .jpg
              const newFileName = file.name.replace(/\.[^.]+$/, '.jpg');
              const convertedFile = new File([blob], newFileName, { type: 'image/jpeg' });
              console.log(`Converted ${file.name} (${file.size} bytes) to ${newFileName} (${convertedFile.size} bytes)`);
              resolve(convertedFile);
            } else {
              console.warn('Canvas toBlob failed, using original file');
              resolve(file);
            }
          },
          'image/jpeg',
          0.92 // High quality JPEG
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        console.warn('Image conversion error, using original file:', error);
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      console.warn(`Failed to load image for conversion: ${file.name}, using original file`);
      // Don't reject - just use the original file and let Telegram handle the error
      resolve(file);
    };

    img.src = objectUrl;
  });
};

/**
 * Process a file for upload - converts unsupported images to JPEG
 */
export const processFileForUpload = async (file: File): Promise<File> => {
  if (file.type.startsWith('image/')) {
    return convertToJpegIfNeeded(file);
  }
  return file;
};
