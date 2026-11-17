import { useState, type FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Search,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  addSavingsGoal,
  addTransaction,
  contributeToGoal,
  deleteSavingsGoal,
  deleteTransaction,
} from '../lib/familyService';
import {
  EXPENSE_CATEGORIES,
  formatDateRu,
  formatMoney,
  INCOME_CATEGORIES,
  LIMITS,
  todayIsoDate,
  type FamilyWorkspace,
  type MoneyTransaction,
  type SavingsGoal,
  type TransactionCategory,
} from '../types/family';

interface MoneySectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  transactions: MoneyTransaction[];
  goals: SavingsGoal[];
}

export function MoneySection({
  uid,
  userName,
  family,
  transactions,
  goals,
}: MoneySectionProps) {
  const isOwner = family.ownerId === uid;

  // Transaction form state
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState<TransactionCategory>('Продукты');
  const [txDate, setTxDate] = useState(todayIsoDate());
  const [savingTx, setSavingTx] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  // Goal form state
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [contribValues, setContribValues] = useState<Record<string, string>>({});

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalBalance = totalIncome - totalExpense;
  const totalGoalsSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  // Category breakdown for expenses
  const expenseMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === 'expense') {
      expenseMap.set(t.category, (expenseMap.get(t.category) ?? 0) + t.amount);
    }
  }
  const expenseBreakdown = [...expenseMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      pct: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const filteredTransactions = [...transactions]
    .filter((t) => (filterType === 'all' ? true : t.type === filterType))
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleTypeSwitch = (nextType: 'expense' | 'income') => {
    setTxType(nextType);
    setTxCategory(nextType === 'expense' ? 'Продукты' : 'Зарплата');
  };

  const handleAddTx = async (e: FormEvent) => {
    e.preventDefault();
    const numeric = Number(txAmount);
    if (!txTitle.trim() || Number.isNaN(numeric) || numeric <= 0) return;
    setSavingTx(true);
    try {
      await addTransaction({
        familyId: family.id,
        authorUid: uid,
        authorName: userName,
        type: txType,
        amount: numeric,
        category: txCategory,
        title: txTitle,
        date: txDate,
      });
      setTxTitle('');
      setTxAmount('');
    } finally {
      setSavingTx(false);
    }
  };

  const handleAddGoal = async (e: FormEvent) => {
    e.preventDefault();
    const target = Number(goalTarget);
    const current = Number(goalCurrent) || 0;
    if (!goalTitle.trim() || Number.isNaN(target) || target <= 0) return;
    setSavingGoal(true);
    try {
      await addSavingsGoal({
        familyId: family.id,
        uid,
        title: goalTitle,
        targetAmount: target,
        currentAmount: current,
        deadline: goalDeadline,
      });
      setGoalTitle('');
      setGoalTarget('');
      setGoalCurrent('0');
      setGoalDeadline('');
      setShowGoalForm(false);
    } finally {
      setSavingGoal(false);
    }
  };

  const handleContribute = async (goal: SavingsGoal) => {
    const raw = contribValues[goal.id] ?? '';
    const amount = Number(raw);
    if (Number.isNaN(amount) || amount <= 0) return;
    await contributeToGoal(family.id, goal, amount);
    setContribValues((prev) => ({ ...prev, [goal.id]: '' }));
  };

  const availableCategories = txType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="space-y-8">
      {/* Financial Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 mb-2">Общий баланс</div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums ${
              totalBalance >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {formatMoney(totalBalance, family.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Доходы минус расходы</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Доходы</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatMoney(totalIncome, family.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {transactions.filter((t) => t.type === 'income').length} поступлений
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Расходы</span>
            <ArrowDownRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(totalExpense, family.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {transactions.filter((t) => t.type === 'expense').length} трат
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>В целях накоплений</span>
            <Target className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-800">
            {formatMoney(totalGoalsSaved, family.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {goals.length} семейных целей
          </div>
        </div>
      </section>

      {/* Add Transaction + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">Новая операция</h2>
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeSwitch('expense')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  txType === 'expense'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Расход
              </button>
              <button
                type="button"
                onClick={() => handleTypeSwitch('income')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  txType === 'income'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Доход
              </button>
            </div>
          </div>

          <form onSubmit={handleAddTx} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Описание
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.TITLE_MAX}
                value={txTitle}
                onChange={(e) => setTxTitle(e.target.value)}
                placeholder={
                  txType === 'expense'
                    ? 'Например: Продукты в супермаркете'
                    : 'Например: Зарплата за ноябрь'
                }
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Сумма
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={LIMITS.AMOUNT_MAX}
                  step="any"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="2500"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Дата
                </label>
                <input
                  type="date"
                  required
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Категория
              </label>
              <select
                value={txCategory}
                onChange={(e) => setTxCategory(e.target.value as TransactionCategory)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={savingTx}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>
                {savingTx
                  ? 'Сохраняем...'
                  : txType === 'expense'
                    ? 'Записать расход'
                    : 'Записать доход'}
              </span>
            </button>
          </form>
        </section>

        {/* Expense Breakdown + Goals */}
        <section className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Структура расходов
            </h2>
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                Добавьте первый расход, чтобы увидеть распределение по категориям.
              </p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map((row) => (
                  <div key={row.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{row.category}</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {formatMoney(row.amount, family.currency)} · {row.pct}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-700 rounded-full"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-slate-900">
                Семейные цели накоплений
              </h2>
              <button
                type="button"
                onClick={() => setShowGoalForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Новая цель</span>
              </button>
            </div>

            {showGoalForm && (
              <form
                onSubmit={handleAddGoal}
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3"
              >
                <input
                  type="text"
                  required
                  maxLength={LIMITS.SHORT_TITLE_MAX}
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder="Название цели (например: Подушка безопасности)"
                  className="sm:col-span-6 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
                <input
                  type="number"
                  required
                  min="1"
                  max={LIMITS.AMOUNT_MAX}
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  placeholder="Нужно"
                  className="sm:col-span-3 px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
                <input
                  type="number"
                  min="0"
                  max={LIMITS.AMOUNT_MAX}
                  value={goalCurrent}
                  onChange={(e) => setGoalCurrent(e.target.value)}
                  placeholder="Уже есть"
                  className="sm:col-span-3 px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="sm:col-span-5 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
                <div className="sm:col-span-7 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowGoalForm(false)}
                    className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={savingGoal}
                    className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                  >
                    {savingGoal ? 'Создание...' : 'Создать цель'}
                  </button>
                </div>
              </form>
            )}

            {goals.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                Целей пока нет — создайте общую цель (отпуск, ремонт, крупная покупка).
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {goals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round((goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100)
                  );
                  const isCompleted = goal.status === 'completed';
                  return (
                    <div key={goal.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {goal.title}
                          </div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums">
                            {formatMoney(goal.currentAmount, family.currency)} из{' '}
                            {formatMoney(goal.targetAmount, family.currency)} · {pct}%
                            {goal.deadline ? ` · до ${formatDateRu(goal.deadline)}` : ''}
                            {isCompleted ? ' · Цель достигнута' : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteSavingsGoal(family.id, goal.id)}
                          aria-label="Удалить цель"
                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isCompleted ? 'bg-emerald-600' : 'bg-teal-700'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {!isCompleted && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="number"
                            min="1"
                            max={LIMITS.AMOUNT_MAX}
                            value={contribValues[goal.id] ?? ''}
                            onChange={(e) =>
                              setContribValues((prev) => ({
                                ...prev,
                                [goal.id]: e.target.value,
                              }))
                            }
                            placeholder="Сумма пополнения"
                            className="w-44 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                          />
                          <button
                            type="button"
                            onClick={() => void handleContribute(goal)}
                            className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            + Пополнить
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">Журнал операций</h2>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по операциям..."
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 w-56"
              />
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Все' },
                  { id: 'expense', label: 'Расходы' },
                  { id: 'income', label: 'Доходы' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    filterType === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Операций по выбранным условиям пока нет.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Дата</th>
                  <th className="py-2.5 pr-4 font-medium">Описание</th>
                  <th className="py-2.5 pr-4 font-medium">Категория</th>
                  <th className="py-2.5 pr-4 font-medium">Кто добавил</th>
                  <th className="py-2.5 pl-4 font-medium text-right">Сумма</th>
                  <th className="py-2.5 pl-3 text-right font-medium w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTransactions.map((tx) => {
                  const canDelete = tx.authorUid === uid || isOwner;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                        {formatDateRu(tx.date)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{tx.title}</td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">
                        {tx.authorName}
                      </td>
                      <td
                        className={`py-2.5 pl-4 font-mono tabular-nums font-semibold text-right whitespace-nowrap ${
                          tx.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '−'}
                        {formatMoney(tx.amount, family.currency)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void deleteTransaction(family.id, tx.id)}
                            aria-label="Удалить операцию"
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
