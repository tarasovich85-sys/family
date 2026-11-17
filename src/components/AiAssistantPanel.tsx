import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { runAiCommand, type AiCommandContext } from '../lib/aiExecutor';
import { ACCENT_THEME_MAP, type AccentTheme } from '../types/family';
import { ImageAttachmentField } from './ImageAttachmentField';
import { ImageLightbox } from './ImageLightbox';

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageDataUrl?: string;
  applied?: string[];
  error?: boolean;
}

interface AiAssistantPanelProps {
  open: boolean;
  onClose: () => void;
  ctx: AiCommandContext;
  accentTheme: AccentTheme;
}

const QUICK_PROMPTS = [
  'Включи новогоднюю тему с гирляндой и снегом',
  'Включи обычную бирюзовую тему',
  'Поставь объявление сверху: С наступающим Новым годом! Готовимся к празднику',
  'Добавь правило семьи: Украшаем ёлку и убираем игрушки перед сном',
  'Добавь в покупки мандарины 2 кг, сыр и яблоки',
  'Переименуй раздел «Деньги» в «Бюджет»',
];

export function AiAssistantPanel({
  open,
  onClose,
  ctx,
  accentTheme,
}: AiAssistantPanelProps) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const theme = ACCENT_THEME_MAP[accentTheme] ?? ACCENT_THEME_MAP.teal;

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, loading]);

  if (!open) return null;

  const submitPrompt = async (rawPrompt: string, explicitImage?: string) => {
    const prompt = rawPrompt.trim();
    const imageToSend = explicitImage !== undefined ? explicitImage : attachedImage;
    if ((!prompt && !imageToSend) || loading) return;

    const userEntry: ChatEntry = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: prompt || 'Прикреплённое изображение',
      imageDataUrl: imageToSend || undefined,
    };

    const history = entries
      .filter((e) => !e.error)
      .slice(-6)
      .map((e) => ({ role: e.role, text: e.text }));

    setEntries((prev) => [...prev, userEntry]);
    setInput('');
    if (explicitImage === undefined) {
      setAttachedImage('');
    }
    setLoading(true);

    try {
      const result = await runAiCommand({
        prompt,
        imageDataUrl: imageToSend || undefined,
        history,
        ctx,
      });
      setEntries((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: result.reply,
          applied: result.applied,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось выполнить запрос к нейросети.';
      setEntries((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          text: message,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitPrompt(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-900/35"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="Нейросеть управления приложением"
        className="relative w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col z-10"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${theme.softBg} ${theme.softBorder} ${theme.iconAccent}`}>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900">Нейросеть «Семья»</h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                Изменяет оформление, разделы и данные по запросу — сразу у всех участников.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => setEntries([])}
                title="Очистить историю диалога"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть нейросеть"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feed */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {entries.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-1.5">
                <div className="font-semibold text-slate-900">
                  Напишите, что изменить в приложении:
                </div>
                <p>
                  • цвета и фон, название в шапке, объявление сверху, правила семьи на главном экране;
                </p>
                <p>
                  • названия или видимость разделов меню;
                </p>
                <p>
                  • покупки, события календаря, сообщения в чат, доходы/траты, цели и задания в гривнах.
                </p>
              </div>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-2">
                  Примеры команд
                </div>
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={loading}
                      onClick={() => void submitPrompt(q, '')}
                      className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className={`flex flex-col ${
                  entry.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    entry.role === 'user'
                      ? `${theme.primaryBtn}`
                      : entry.error
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  {entry.imageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(entry.imageDataUrl || null)}
                      className="mb-2 block rounded-lg overflow-hidden border border-white/25 hover:opacity-90 transition-opacity cursor-zoom-in"
                      title="Увеличить изображение"
                    >
                      <img
                        src={entry.imageDataUrl}
                        alt="Прикреплённое изображение"
                        className="max-w-full max-h-40 object-cover"
                      />
                    </button>
                  )}
                  <p className="whitespace-pre-wrap">{entry.text}</p>

                  {entry.applied && entry.applied.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Обновлено для всей семьи
                      </div>
                      {entry.applied.map((item, idx) => (
                        <div
                          key={`${entry.id}_${idx}`}
                          className="flex items-start gap-1.5 text-xs text-slate-700"
                        >
                          <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${theme.iconAccent}`} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 w-fit">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Нейросеть применяет изменения для всех...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white space-y-2.5">
          <ImageAttachmentField
            compact
            label="Прикрепить изображение"
            value={attachedImage}
            onChange={setAttachedImage}
            onPreview={setLightboxUrl}
            disabled={loading}
          />
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submitPrompt(input);
              }
            }}
            placeholder="Например: Включи новогоднюю тему, переименуй Дом в Быт или добавь купить мандарины..."
            disabled={loading}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400 resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              Enter — отправить · Shift+Enter — новая строка
            </span>
            <button
              type="submit"
              disabled={loading || (!input.trim() && !attachedImage)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${theme.primaryBtn}`}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Применить</span>
            </button>
          </div>
        </form>
      </aside>

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
