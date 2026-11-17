import { useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { compressTaskPhoto } from '../lib/imageCompression';

interface ImageAttachmentFieldProps {
  value: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  onPreview?: (dataUrl: string) => void;
}

export function ImageAttachmentField({
  value,
  onChange,
  disabled = false,
  compact = false,
  label = 'Прикрепить изображение',
  onPreview,
}: ImageAttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressTaskPhoto(file);
      onChange(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать изображение.');
    } finally {
      setCompressing(false);
    }
  };

  return (
    <div className={compact ? 'inline-flex flex-col gap-1.5' : 'space-y-2'}>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex items-center gap-1.5 font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'
          } ${disabled || compressing ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {compressing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 shrink-0" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          )}
          <span>
            {compressing
              ? 'Сжатие...'
              : value
                ? 'Заменить фото'
                : label}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || compressing}
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
          />
        </label>

        {value && !compact && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>Убрать</span>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      {value && (
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => onPreview?.(value)}
            className={`block rounded-lg overflow-hidden border border-slate-200 bg-slate-50 ${
              onPreview ? 'cursor-zoom-in hover:opacity-90 transition-opacity' : 'cursor-default'
            }`}
            title={onPreview ? 'Увеличить изображение' : undefined}
          >
            <img
              src={value}
              alt="Предпросмотр прикреплённого изображения"
              className={compact ? 'w-20 h-16 object-cover' : 'w-40 h-28 object-cover'}
            />
          </button>
          {compact && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              aria-label="Удалить прикреплённое изображение"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow hover:bg-red-700 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
