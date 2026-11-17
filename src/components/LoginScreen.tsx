import { useState } from 'react';
import { ArrowRight, Home, MessageSquare, Snowflake, TreePine, Users, Wallet } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { NewYearGarland, NewYearSnowOverlay } from './NewYearDecorations';
import { ResilientImage } from './ResilientImage';

export function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось выполнить вход';
      if (!msg.includes('popup-closed-by-user')) {
        setError('Ошибка входа через Google. Попробуйте ещё раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-[#FEF7EC] text-slate-900 flex flex-col relative">
      <NewYearSnowOverlay />

      {/* Top Bar Contract: Garland + 3 zones */}
      <header className="sticky top-0 z-20 w-full border-b border-amber-200/80 bg-white/95 backdrop-blur-sm">
        <NewYearGarland />
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0"
          >
            <TreePine className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>Семья</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#pillar-family" className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0">
              Семья
            </a>
            <a href="#pillar-chat" className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0">
              Общение
            </a>
            <a href="#pillar-money" className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0">
              Деньги
            </a>
            <a href="#pillar-home" className="hover:text-red-700 transition-colors whitespace-nowrap shrink-0">
              Дом
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {loading ? 'Вход...' : 'Войти через Google'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="relative z-10 flex-1 max-w-[1280px] w-full mx-auto px-6 py-12 lg:py-16">
        {/* 2-Column Balanced Split Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-12">
          <div className="lg:col-span-6 bg-white/95 border border-amber-200/80 rounded-2xl p-8 lg:p-10 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <ResilientImage
                  src="/src/assets/images/family_hearth_emblem_1794860481061.jpg"
                  alt="Эмблема семейного пространства Семья"
                  className="w-11 h-11 rounded-lg object-cover border border-amber-200"
                  fallbackLabel="Семья"
                />
                <div className="text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                    <Snowflake className="w-3.5 h-3.5 text-sky-600" />
                    <span>С наступающим Новым годом!</span>
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>Синхронизация в реальном времени</span>
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15] mb-5">
                Семья, общение, деньги и дом в одном праздничном месте
              </h1>

              <p className="text-base text-slate-600 leading-relaxed mb-8 max-w-xl">
                Единый порядок для всей семьи к праздникам и на весь год: кто за что отвечает,
                какие подарки и дела запланированы, какой бюджет и что нужно купить к столу.
              </p>
            </div>

            <div>
              {error && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleLogin}
                  disabled={loading}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <span>{loading ? 'Подключаем аккаунт...' : 'Начать работу'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500">
                  Вход по Google-аккаунту · Приглашение близких по коду
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-amber-200/80 bg-slate-100 min-h-[300px] shadow-sm">
            <ResilientImage
              src="/src/assets/images/family_home_hero_1794860480576.jpg"
              alt="Светлая семейная гостиная с деревянным столом"
              className="w-full h-full object-cover lg:h-full"
              fallbackLabel="Семейный дом"
            />
          </div>
        </section>

        {/* 4 Pillars Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div id="pillar-family" className="bg-white/95 border border-slate-200 rounded-xl p-6">
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center mb-4">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">Семья</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Профили всех близких, праздничные даты, дни рождения и общий семейный календарь событий.
            </p>
          </div>

          <div id="pillar-chat" className="bg-white/95 border border-slate-200 rounded-xl p-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">Общение</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Семейная переписка по темам, закреплённые объявления и важные договорённости под рукой.
            </p>
          </div>

          <div id="pillar-money" className="bg-white/95 border border-slate-200 rounded-xl p-6">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
              <Wallet className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">Деньги</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Учёт общих доходов и расходов, праздничный бюджет, баланс и совместные цели накоплений.
            </p>
          </div>

          <div id="pillar-home" className="bg-white/95 border border-slate-200 rounded-xl p-6">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
              <Home className="w-4 h-4" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 mb-1.5">Дом</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Общий список покупок к праздникам, распределение бытовых дел, уборка и контроль ЖКУ.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
