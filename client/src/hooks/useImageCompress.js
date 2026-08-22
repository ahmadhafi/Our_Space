import imageCompression from 'browser-image-compression';

export async function compressImage(file, maxSizeMB = 1, maxWidthOrHeight = 1920) {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    // Convert Blob to File object to maintain original file name
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
    return new File([compressedBlob], name, { type: file.type });
  } catch (error) {
    console.error('Compression failed:', error);
    return file;
  }
}

export async function compressFiles(files) {
  const compressed = [];
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      const result = await compressImage(file);
      compressed.push(result);
    } else {
      compressed.push(file);
    }
  }
  return compressed;
}
