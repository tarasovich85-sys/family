import { AlertTriangle, DoorOpen, Loader2, Trash2, X } from 'lucide-react';

interface LeaveFamilyModalProps {
  open: boolean;
  isOwner: boolean;
  familyName: string;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function LeaveFamilyModal({
  open,
  isOwner,
  familyName,
  loading,
  error,
  onCancel,
  onConfirm,
}: LeaveFamilyModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-900/45"
        onClick={() => {
          if (!loading) onCancel();
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-family-title"
        className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 z-10 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isOwner
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isOwner ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <DoorOpen className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 id="leave-family-title" className="text-base font-bold text-slate-900">
                {isOwner
                  ? `Выйти и удалить семью «${familyName}»?`
                  : `Выйти из семьи «${familyName}»?`}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isOwner ? 'Действие необратимо' : 'Возврат на экран выбора семьи'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            aria-label="Закрыть окно"
            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isOwner ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900 leading-relaxed">
            Вы являетесь <strong>владельцем группы</strong>. Когда вы выйдете,{' '}
            <strong>все данные семьи сотрутся навсегда</strong>: участники, переписка, календарь,
            задания, бюджет, покупки и настройки. После этого вы вернётесь к стартовому экрану и
            начнёте с чистого листа.
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
            Вы выйдете из текущей семьи и вернётесь на экран создания или входа в семью. Данные
            семьи у остальных участников останутся на месте.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm()}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 ${
              isOwner
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isOwner ? (
              <Trash2 className="w-4 h-4" />
            ) : (
              <DoorOpen className="w-4 h-4" />
            )}
            <span>
              {loading
                ? isOwner
                  ? 'Стираем данные...'
                  : 'Выходим...'
                : isOwner
                  ? 'Стереть всё и выйти'
                  : 'Выйти из семьи'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
