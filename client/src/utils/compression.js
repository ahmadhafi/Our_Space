import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file before upload.
 * If the file is not an image, it is returned unchanged.
 */
export async function compressImage(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };
  
  try {
    const compressedBlob = await imageCompression(file, options);
    // browser-image-compression returns a Blob, we convert it back to a File object
    return new File([compressedBlob], file.name, { type: file.type });
  } catch (error) {
    console.error('Image compression failed:', error);
    return file; // Fallback to original
  }
}
