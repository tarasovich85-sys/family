import { LIMITS } from '../types/family';

const MAX_OUTPUT_CHARS = 240_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Не удалось прочитать изображение.'));
      }
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла изображения.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение.'));
    img.src = src;
  });
}

/**
 * Compresses an uploaded photo into a compact base64 JPEG data URL
 * guaranteed to fit inside Firestore document & rule limits.
 */
export async function compressTaskPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Пожалуйста, выберите файл изображения (фото).');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const attempts: { maxDim: number; quality: number }[] = [
    { maxDim: 960, quality: 0.78 },
    { maxDim: 760, quality: 0.66 },
    { maxDim: 600, quality: 0.55 },
    { maxDim: 480, quality: 0.45 },
  ];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Браузер не поддерживает обработку изображений.');
  }

  for (const { maxDim, quality } of attempts) {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL('image/jpeg', quality);
    if (compressed.length <= MAX_OUTPUT_CHARS && compressed.length <= LIMITS.PHOTO_DATA_MAX) {
      return compressed;
    }
  }

  throw new Error('Фото слишком большое даже после сжатия. Попробуйте другое фото.');
}
