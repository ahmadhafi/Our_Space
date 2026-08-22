/**
 * Client-side image compression via Canvas API
 * Max 1280px longest side, JPEG quality 0.75
 */

export function compressImage(file, maxSize = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    // Only compress images
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          // Create a new File from the blob with original name but .jpg extension
          const name = file.name.replace(/\.[^.]+$/, '.jpg');
          const compressed = new File([blob], name, { type: 'image/jpeg' });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      // If image can't be loaded, return original
      resolve(file);
    };

    img.src = URL.createObjectURL(file);
  });
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
