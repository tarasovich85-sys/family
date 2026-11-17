import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import {
  addHomeTask,
  addShoppingItem,
  addTransaction,
  clearCheckedShoppingItems,
  deleteHomeTask,
  deleteShoppingItem,
  toggleHomeTask,
  toggleShoppingItem,
} from '../lib/familyService';
import {
  formatDateRu,
  formatMoney,
  HOME_TASK_AREAS,
  LIMITS,
  RECURRENCE_OPTIONS,
  SHOPPING_CATEGORIES,
  todayIsoDate,
  type FamilyPersonProfile,
  type FamilyWorkspace,
  type HomeTask,
  type HomeTaskArea,
  type ShoppingCategory,
  type ShoppingItem,
  type TaskRecurrence,
} from '../types/family';

interface HomeSectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  profiles: FamilyPersonProfile[];
  shopping: ShoppingItem[];
  tasks: HomeTask[];
}

export function HomeSection({
  uid,
  userName,
  family,
  profiles,
  shopping,
  tasks,
}: HomeSectionProps) {
  const [activeTab, setActiveTab] = useState<'shopping' | 'chores' | 'utilities'>('shopping');

  // Shopping state
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemCat, setItemCat] = useState<ShoppingCategory>('Продукты');
  const [shopFilter, setShopFilter] = useState<'Все' | ShoppingCategory>('Все');
  const [savingItem, setSavingItem] = useState(false);

  // Task / Utility state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskArea, setTaskArea] = useState<HomeTaskArea>('Уборка');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState(todayIsoDate());
  const [taskRecurrence, setTaskRecurrence] = useState<TaskRecurrence>('Разовое');
  const [taskAmount, setTaskAmount] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [paidFeedbackId, setPaidFeedbackId] = useState<string | null>(null);

  const handleAddShopping = async (e: FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    setSavingItem(true);
    try {
      await addShoppingItem({
        familyId: family.id,
        uid,
        userName,
        name: itemName,
        quantity: itemQty,
        category: itemCat,
      });
      setItemName('');
      setItemQty('');
    } finally {
      setSavingItem(false);
    }
  };

  const handleAddTask = async (e: FormEvent, forcedArea?: HomeTaskArea) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    setSavingTask(true);
    try {
      await addHomeTask({
        familyId: family.id,
        uid,
        title: taskTitle,
        area: forcedArea ?? taskArea,
        assigneeName: taskAssignee,
        dueDate: taskDue,
        recurrence: taskRecurrence,
        amount: Number(taskAmount) || 0,
      });
      setTaskTitle('');
      setTaskAmount('');
      setTaskAssignee('');
    } finally {
      setSavingTask(false);
    }
  };

  const handlePayUtilityAndRecordExpense = async (task: HomeTask) => {
    if (task.status !== 'done') {
      await toggleHomeTask(family.id, task.id, 'done');
    }
    if (task.amount > 0) {
      await addTransaction({
        familyId: family.id,
        authorUid: uid,
        authorName: userName,
        type: 'expense',
        amount: task.amount,
        category: 'Дом и ЖКУ',
        title: task.title,
        date: todayIsoDate(),
      });
      setPaidFeedbackId(task.id);
      setTimeout(() => setPaidFeedbackId(null), 3000);
    }
  };

  const checkedShoppingIds = shopping.filter((i) => i.checked).map((i) => i.id);
  const filteredShopping = [...shopping]
    .filter((i) => (shopFilter === 'Все' ? true : i.category === shopFilter))
    .sort((a, b) => Number(a.checked) - Number(b.checked));

  const choreTasks = tasks
    .filter((t) => t.area !== 'ЖКУ и счета')
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));

  const utilityTasks = tasks
    .filter((t) => t.area === 'ЖКУ и счета')
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done'));

  const totalPendingUtilities = utilityTasks
    .filter((t) => t.status === 'todo')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('shopping')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'shopping'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Список покупок</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              ({shopping.filter((i) => !i.checked).length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('chores');
              setTaskArea('Уборка');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'chores'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Дела и уборка</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              ({choreTasks.filter((t) => t.status === 'todo').length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('utilities');
              setTaskArea('ЖКУ и счета');
              setTaskRecurrence('Ежемесячно');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'utilities'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>ЖКУ и счета</span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              ({utilityTasks.filter((t) => t.status === 'todo').length})
            </span>
          </button>
        </div>

        {activeTab === 'shopping' && checkedShoppingIds.length > 0 && (
          <button
            type="button"
            onClick={() => void clearCheckedShoppingItems(family.id, checkedShoppingIds)}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Очистить купленные ({checkedShoppingIds.length})
          </button>
        )}
      </div>

      {/* Tab 1: Shopping List */}
      {activeTab === 'shopping' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <form
            onSubmit={handleAddShopping}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
          >
            <input
              type="text"
              required
              maxLength={LIMITS.SHORT_TITLE_MAX}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Что купить? (например: Молоко, лампочка E27)"
              className="sm:col-span-5 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <input
              type="text"
              maxLength={LIMITS.QUANTITY_MAX}
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
              placeholder="Кол-во (2 л)"
              className="sm:col-span-2 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <select
              value={itemCat}
              onChange={(e) => setItemCat(e.target.value as ShoppingCategory)}
              className="sm:col-span-3 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            >
              {SHOPPING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingItem}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить</span>
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Общий список</h2>
            <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg">
              {(['Все', ...SHOPPING_CATEGORIES] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setShopFilter(cat)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    shopFilter === cat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredShopping.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              В этой категории пока нет покупок.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredShopping.map((item) => (
                <div
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => void toggleShoppingItem(family.id, item.id, !item.checked)}
                      aria-label={item.checked ? 'Вернуть в список' : 'Отметить купленным'}
                      className="text-slate-400 hover:text-teal-700 transition-colors shrink-0"
                    >
                      {item.checked ? (
                        <CheckCircle2 className="w-5 h-5 text-teal-700" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          item.checked ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {item.name}
                        {item.quantity ? ` — ${item.quantity}` : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span>{item.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Добавил: {item.addedByName}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteShoppingItem(family.id, item.id)}
                    aria-label="Удалить позицию"
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Household Chores & Maintenance */}
      {activeTab === 'chores' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <form
            onSubmit={(e) => void handleAddTask(e)}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
          >
            <input
              type="text"
              required
              maxLength={LIMITS.TITLE_MAX}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Домашнее дело (например: Заменить фильтр для воды)"
              className="sm:col-span-5 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <select
              value={taskArea}
              onChange={(e) => setTaskArea(e.target.value as HomeTaskArea)}
              className="sm:col-span-3 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            >
              {HOME_TASK_AREAS.filter((a) => a !== 'ЖКУ и счета').map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={LIMITS.DISPLAY_NAME_MAX}
              value={taskAssignee}
              onChange={(e) => setTaskAssignee(e.target.value)}
              placeholder="Ответственный"
              list="home-assignees"
              className="sm:col-span-4 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <datalist id="home-assignees">
              {profiles.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="sm:col-span-4 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <select
              value={taskRecurrence}
              onChange={(e) => setTaskRecurrence(e.target.value as TaskRecurrence)}
              className="sm:col-span-5 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingTask}
              className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить дело</span>
            </button>
          </form>

          {choreTasks.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Пока нет домашних задач. Добавьте первую задачу выше.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {choreTasks.map((task) => {
                const isDone = task.status === 'done';
                return (
                  <div
                    key={task.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          void toggleHomeTask(family.id, task.id, isDone ? 'todo' : 'done')
                        }
                        aria-label={isDone ? 'Вернуть в работу' : 'Отметить выполненным'}
                        className="mt-0.5 text-slate-400 hover:text-teal-700 transition-colors shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-700" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>{task.area}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{task.recurrence}</span>
                          {task.dueDate && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">
                                до {formatDateRu(task.dueDate)}
                              </span>
                            </>
                          )}
                          {task.assigneeName && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{task.assigneeName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void deleteHomeTask(family.id, task.id)}
                      aria-label="Удалить задачу"
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Utilities & Home Bills */}
      {activeTab === 'utilities' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Коммунальные платежи и регулярные счета
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Можно сразу отметить платёж как оплаченный и перенести сумму в раздел «Деньги».
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">К оплате сейчас</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900">
                {formatMoney(totalPendingUtilities, family.currency)}
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => void handleAddTask(e, 'ЖКУ и счета')}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg"
          >
            <input
              type="text"
              required
              maxLength={LIMITS.TITLE_MAX}
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Счёт или услуга (например: Интернет, Электричество)"
              className="sm:col-span-5 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <input
              type="number"
              min="0"
              max={LIMITS.AMOUNT_MAX}
              step="any"
              value={taskAmount}
              onChange={(e) => setTaskAmount(e.target.value)}
              placeholder="Сумма"
              className="sm:col-span-2 px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              className="sm:col-span-3 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <button
              type="submit"
              disabled={savingTask}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить</span>
            </button>
          </form>

          {utilityTasks.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Счетов и напоминаний по ЖКУ пока нет.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {utilityTasks.map((bill) => {
                const isDone = bill.status === 'done';
                return (
                  <div
                    key={bill.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          void toggleHomeTask(family.id, bill.id, isDone ? 'todo' : 'done')
                        }
                        aria-label={isDone ? 'Отметить неоплаченным' : 'Отметить оплаченным'}
                        className="mt-0.5 text-slate-400 hover:text-teal-700 transition-colors shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-teal-700" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>
                      <div>
                        <div
                          className={`text-sm font-medium ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {bill.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span>{bill.recurrence}</span>
                          {bill.dueDate && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums">
                                до {formatDateRu(bill.dueDate)}
                              </span>
                            </>
                          )}
                          {bill.amount > 0 && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono tabular-nums font-semibold text-slate-800">
                                {formatMoney(bill.amount, family.currency)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isDone && bill.amount > 0 && (
                        <button
                          type="button"
                          onClick={() => void handlePayUtilityAndRecordExpense(bill)}
                          className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Оплатить и в «Деньги»
                        </button>
                      )}
                      {paidFeedbackId === bill.id && (
                        <span className="text-xs text-emerald-700 font-medium">
                          Записано в расходы
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void deleteHomeTask(family.id, bill.id)}
                        aria-label="Удалить счёт"
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
