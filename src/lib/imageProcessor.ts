/**
 * Image Processor for CAST Inspect
 * Enforces vertical 3:4 orientation for all inspection photos,
 * handles automatic EXIF orientation, cropping/framing to vertical format,
 * and compression for crisp PDF rendering without memory bloat.
 */

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  isVertical: boolean;
}

export async function processInspectionPhoto(
  fileOrUrl: File | Blob | string,
  targetWidth = 750,
  targetHeight = 1000 // 3:4 aspect ratio
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Não foi possível obter o contexto 2D do Canvas.');
        }

        // Fill clean white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        const imgWidth = img.naturalWidth || img.width;
        const imgHeight = img.naturalHeight || img.height;

        // Calculate aspect ratios
        const targetRatio = targetWidth / targetHeight; // 0.75
        const imgRatio = imgWidth / imgHeight;

        let renderWidth: number;
        let renderHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (imgRatio > targetRatio) {
          // Source is wider than 3:4 (e.g., landscape or square)
          // Crop sides to maintain vertical 3:4 framing without black bars
          renderHeight = targetHeight;
          renderWidth = imgWidth * (targetHeight / imgHeight);
          offsetX = (targetWidth - renderWidth) / 2;
          offsetY = 0;
        } else {
          // Source is taller than 3:4 or already vertical
          renderWidth = targetWidth;
          renderHeight = imgHeight * (targetWidth / imgWidth);
          offsetX = 0;
          offsetY = (targetHeight - renderHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);

        // Export as optimized JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        resolve({
          dataUrl,
          width: targetWidth,
          height: targetHeight,
          isVertical: true,
        });
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(new Error('Erro ao carregar a imagem para processamento.'));

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (e) => reject(new Error('Erro ao ler o arquivo de foto.'));
      reader.readAsDataURL(fileOrUrl);
    }
  });
}
