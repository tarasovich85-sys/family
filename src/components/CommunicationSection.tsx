import { useState, type FormEvent } from 'react';
import { MessageSquare, Pin, PinOff, Send, Trash2 } from 'lucide-react';
import {
  deleteFamilyMessage,
  sendFamilyMessage,
  toggleMessagePin,
} from '../lib/familyService';
import {
  formatTimestampTime,
  LIMITS,
  MESSAGE_TOPICS,
  timestampToMillis,
  type FamilyMessage,
  type FamilyWorkspace,
  type MessageTopic,
} from '../types/family';
import { ImageAttachmentField } from './ImageAttachmentField';
import { ImageLightbox } from './ImageLightbox';

interface CommunicationSectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  messages: FamilyMessage[];
  lastReadMessagesMs?: number;
}

export function CommunicationSection({
  uid,
  userName,
  family,
  messages,
  lastReadMessagesMs = 0,
}: CommunicationSectionProps) {
  const [topicFilter, setTopicFilter] = useState<'Все' | MessageTopic>('Все');
  const [text, setText] = useState('');
  const [topic, setTopic] = useState<MessageTopic>('Общее');
  const [pinOnSend, setPinOnSend] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isOwner = family.ownerId === uid;

  const pinnedMessages = [...messages]
    .filter((m) => m.pinned)
    .sort((a, b) => {
      const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
      const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
      return tb - ta;
    });

  const filteredMessages = [...messages]
    .filter((m) => (topicFilter === 'Все' ? true : m.topic === topicFilter))
    .sort((a, b) => {
      const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
      const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
      return tb - ta;
    });

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageDataUrl) return;
    setSending(true);
    try {
      await sendFamilyMessage({
        familyId: family.id,
        authorUid: uid,
        authorName: userName,
        text,
        topic,
        pinned: pinOnSend,
        imageDataUrl,
      });
      setText('');
      setPinOnSend(false);
      setImageDataUrl('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pinned Noticeboard */}
      {pinnedMessages.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Pin className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Закреплённые объявления
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 mb-1">
                    <span className="font-medium text-slate-800">{msg.authorName}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{msg.topic}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="tabular-nums">{formatTimestampTime(msg.createdAt)}</span>
                  </div>
                  {!(msg.text === 'Изображение' && msg.imageDataUrl) && (
                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  )}
                  {msg.imageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(msg.imageDataUrl || null)}
                      className="mt-2 block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                      title="Увеличить изображение"
                    >
                      <img
                        src={msg.imageDataUrl}
                        alt="Изображение к объявлению"
                        className="max-w-full max-h-40 object-cover"
                      />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleMessagePin(family.id, msg.id, false)}
                  title="Открепить объявление"
                  aria-label="Открепить объявление"
                  className="p-1.5 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <PinOff className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Composer + Channel Filter + Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-teal-700" />
            <h2 className="text-base font-semibold text-slate-900">Новое сообщение</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Тема разговора
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as MessageTopic)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {MESSAGE_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Текст сообщения или заметки
              </label>
              <textarea
                required={!imageDataUrl}
                rows={4}
                maxLength={LIMITS.MESSAGE_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Напишите семье: во сколько ужин, что забрать по дороге, о чём договорились..."
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 resize-y"
              />
            </div>

            <ImageAttachmentField
              value={imageDataUrl}
              onChange={setImageDataUrl}
              onPreview={setLightboxUrl}
              disabled={sending}
            />

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={pinOnSend}
                onChange={(e) => setPinOnSend(e.target.checked)}
                className="w-4 h-4 text-teal-700 border-slate-300 rounded focus:ring-teal-700"
              />
              <span className="text-xs text-slate-700">Закрепить наверху как важное</span>
            </label>

            <button
              type="submit"
              disabled={sending || (!text.trim() && !imageDataUrl)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Отправка...' : 'Отправить семье'}</span>
            </button>
          </form>
        </section>

        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900">Семейная лента</h2>
            <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg">
              {(['Все', ...MESSAGE_TOPICS] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicFilter(t)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    topicFilter === t
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500">
                В этой теме пока нет сообщений. Напишите первое сообщение слева.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredMessages.map((msg) => {
                const canDelete = msg.authorUid === uid || isOwner;
                const isUnread =
                  lastReadMessagesMs > 0 &&
                  msg.authorUid !== uid &&
                  timestampToMillis(msg.createdAt) > lastReadMessagesMs;
                return (
                  <article key={msg.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                          <span className="font-semibold text-slate-900">{msg.authorName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{msg.topic}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatTimestampTime(msg.createdAt) || 'Только что'}
                          </span>
                          {msg.pinned && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-teal-700 font-medium">Закреплено</span>
                            </>
                          )}
                          {isUnread && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-teal-700 font-semibold">Новое</span>
                            </>
                          )}
                        </div>
                        {!(msg.text === 'Изображение' && msg.imageDataUrl) && (
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        )}
                        {msg.imageDataUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxUrl(msg.imageDataUrl || null)}
                            className="mt-2.5 block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                            title="Увеличить изображение"
                          >
                            <img
                              src={msg.imageDataUrl}
                              alt="Прикреплённое изображение"
                              className="max-w-xs max-h-56 object-cover"
                            />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleMessagePin(family.id, msg.id, !msg.pinned)}
                          title={msg.pinned ? 'Открепить' : 'Закрепить'}
                          aria-label={msg.pinned ? 'Открепить' : 'Закрепить'}
                          className={`p-1.5 rounded transition-colors ${
                            msg.pinned
                              ? 'text-teal-700 hover:text-teal-800'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteFamilyMessage(family.id, msg.id)}
                            aria-label="Удалить сообщение"
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
