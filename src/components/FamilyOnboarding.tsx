import { useState, type FormEvent } from 'react';
import { ArrowRight, KeyRound, LogOut, Snowflake, TreePine, Users } from 'lucide-react';
import {
  createFamilyWorkspace,
  joinFamilyByInviteCode,
  seedStarterFamilyData,
} from '../lib/familyService';
import { logoutUser } from '../lib/firebase';
import { CURRENCY_META, LIMITS, type CurrencyCode } from '../types/family';
import { NewYearGarland, NewYearSnowOverlay } from './NewYearDecorations';
import { ResilientImage } from './ResilientImage';

interface FamilyOnboardingProps {
  uid: string;
  defaultDisplayName: string;
}

export function FamilyOnboarding({ uid, defaultDisplayName }: FamilyOnboardingProps) {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [userName, setUserName] = useState(defaultDisplayName || 'Алексей');
  const [familyName, setFamilyName] = useState('Наша семья');
  const [currency, setCurrency] = useState<CurrencyCode>('RUB');
  const [addStarterData, setAddStarterData] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!familyName.trim() || !userName.trim()) {
      setError('Укажите ваше имя и название семьи.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const familyId = await createFamilyWorkspace({
        uid,
        userName,
        familyName,
        currency,
      });
      if (addStarterData) {
        await seedStarterFamilyData({ familyId, uid, userName });
      }
    } catch {
      setError('Не удалось создать семейное пространство. Проверьте подключение и повторите.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !userName.trim()) {
      setError('Введите ваше имя и код приглашения.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await joinFamilyByInviteCode({
        uid,
        userName,
        rawCode: inviteCode,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVITE_NOT_FOUND' || msg === 'INVALID_CODE') {
        setError('Код приглашения не найден. Проверьте правильность кода у создателя семьи.');
      } else {
        setError('Не удалось присоединиться по коду. Попробуйте ещё раз.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-[#FEF7EC] flex flex-col relative">
      <NewYearSnowOverlay />

      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-amber-200/80">
        <NewYearGarland />
        <div className="px-6 py-4">
          <div className="max-w-[960px] mx-auto flex items-center justify-between gap-8">
            <span className="inline-flex items-center gap-2 text-xl font-bold text-slate-900 font-display whitespace-nowrap shrink-0">
              <TreePine className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Семья</span>
            </span>
            <button
              type="button"
              onClick={() => void logoutUser()}
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="max-w-[960px] w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 bg-white/95 border border-amber-200/80 rounded-2xl p-8 shadow-sm">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2">
              <Snowflake className="w-3.5 h-3.5 text-sky-600" />
              <span>С наступающим Новым годом!</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              Настройка семейного пространства
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              Создайте новый дом для вашей семьи или подключитесь к уже существующему по коду приглашения.
            </p>

            {/* Segmented Mode Switch */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('create');
                  setError(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'create'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Создать семью
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('join');
                  setError(null);
                }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'join'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Войти по коду
              </button>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            {mode === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Ваше имя в семье
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.DISPLAY_NAME_MAX}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Например: Анна"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Название семьи или дома
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.FAMILY_NAME_MAX}
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="Например: Семья Соколовых"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Основная валюта бюджета
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  >
                    {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                      <option key={code} value={code}>
                        {CURRENCY_META[code].label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-start gap-3 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addStarterData}
                    onChange={(e) => setAddStarterData(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-red-700 border-slate-300 rounded focus:ring-red-700"
                  />
                  <span className="text-sm text-slate-600">
                    Добавить стартовые примеры (покупки, цель накопления, напоминание о счётчиках)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-xl transition-colors"
                >
                  <span>{submitting ? 'Создаём пространство...' : 'Создать семейное пространство'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Ваше имя в семье
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={LIMITS.DISPLAY_NAME_MAX}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Например: Дмитрий"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Код приглашения
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Например: K9M2-P4X7"
                    className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Попросите код приглашения в разделе «Семья» у того, кто уже создал пространство.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-xl transition-colors"
                >
                  <span>{submitting ? 'Подключаем...' : 'Присоединиться к семье'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-5 bg-white/95 border border-amber-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm">
            <div className="h-56 lg:h-64 bg-slate-100">
              <ResilientImage
                src="/src/assets/images/home_interior_card_1794860480767.jpg"
                alt="Уютная семейная кухня"
                className="w-full h-full object-cover"
                fallbackLabel="Наш дом"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium mb-2">
                  <TreePine className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Новогоднее семейное пространство</span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">
                  Общий доступ для всех близких
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  После создания вы получите короткий код приглашения. Отправьте его супругу, родителям или старшим детям — все списки, бюджет и календарь сразу станут общими.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
