/**
 * Compresses an image file in the browser using the Canvas API.
 * @param file The original image file.
 * @param maxWidth The maximum width of the compressed image.
 * @param maxHeight The maximum height of the compressed image.
 * @param quality The JPEG compression quality (0.0 to 1.0).
 * @returns A promise that resolves to a base64 string of the compressed image.
 */
export async function compressImage(
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.7
): Promise<string> {
  const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || 
                 /\.(heic|heif)$/i.test(file.name);

  let fileToProcess = file;

  if (isHEIC) {
    try {
      const heic2anyModule: any = await import('heic2any');
      const heic2any = heic2anyModule.default || heic2anyModule;
      
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: quality
      });
      
      const singleBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      fileToProcess = new File([singleBlob], newName, {
        type: 'image/jpeg'
      });
    } catch (error) {
      console.error('HEIC conversion failed:', error);
      throw new Error('Failed to process HEIC photo. Please convert it to JPEG/PNG or try again.');
    }
  }

  return new Promise((resolve, reject) => {
    // Safety check: ensure file is an image
    if (!isHEIC && fileToProcess.type && !fileToProcess.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    // Create a memory-efficient object URL instead of loading the entire raw file into a huge Base64 string
    const objectUrl = URL.createObjectURL(fileToProcess);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions preserving aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to highly optimized base64 JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        
        // Always revoke the object URL immediately to release browser memory
        URL.revokeObjectURL(objectUrl);
        resolve(compressedBase64);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };

    img.src = objectUrl;
  });
}
