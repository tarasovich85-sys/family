import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IS_PROD = process.env.NODE_ENV === 'production';

function resolvePort(): number {
  const portFlagIdx = process.argv.indexOf('--port');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const cliPort = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(cliPort) && cliPort > 0) return cliPort;
  }
  if (IS_PROD && process.env.PORT) {
    const envPort = Number(process.env.PORT);
    if (Number.isFinite(envPort) && envPort > 0) return envPort;
  }
  return 3000;
}

const PORT = resolvePort();

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const ACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Дружелюбный и точный ответ пользователю на русском языке о внесённых изменениях.',
    },
    actions: {
      type: Type.ARRAY,
      description: 'Список действий для немедленного обновления приложения и данных семьи в реальном времени.',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            enum: [
              'update_appearance',
              'reset_appearance',
              'update_family',
              'create_child_task',
              'add_event',
              'toggle_event',
              'add_message',
              'add_announcement',
              'add_transaction',
              'add_goal',
              'contribute_goal',
              'add_shopping',
              'toggle_shopping',
              'delete_shopping',
              'add_home_task',
              'toggle_home_task',
            ],
          },
          brandName: { type: Type.STRING, description: 'Новое название приложения в шапке (до 60 символов).' },
          accentTheme: {
            type: Type.STRING,
            enum: ['teal', 'indigo', 'emerald', 'amber', 'rose', 'slate', 'newyear'],
            description: 'Основная цветовая схема кнопок и акцентов интерфейса (newyear включает новогодние гирлянды и снег).',
          },
          surfaceMode: {
            type: Type.STRING,
            enum: ['light', 'warm', 'slate', 'snow'],
            description: 'Оттенок фона приложения: light (светлый), warm (тёплый бежевый), slate (серый), snow (зимний снежный).',
          },
          bannerTitle: { type: Type.STRING, description: 'Заголовок приветственного баннера на главном экране.' },
          bannerSubtitle: { type: Type.STRING, description: 'Текст приветственного баннера на главном экране.' },
          liveAnnouncement: {
            type: Type.STRING,
            description: 'Текст верхнего объявления для всех пользователей. Передайте пустую строку "", чтобы убрать объявление.',
          },
          addCustomNote: { type: Type.STRING, description: 'Добавить правило семьи или заметку на главный экран.' },
          removeCustomNote: { type: Type.STRING, description: 'Удалить заметку/правило по совпадению текста.' },
          clearCustomNotes: { type: Type.BOOLEAN, description: 'Очистить все пользовательские правила/заметки.' },
          hideSection: {
            type: Type.STRING,
            enum: ['board', 'family', 'tasks', 'communication', 'money', 'home'],
            description: 'Скрыть раздел из меню для всех участников.',
          },
          showSection: {
            type: Type.STRING,
            enum: ['board', 'family', 'tasks', 'communication', 'money', 'home'],
            description: 'Показать ранее скрытый раздел в меню.',
          },
          renameSectionId: {
            type: Type.STRING,
            enum: ['overview', 'board', 'family', 'tasks', 'communication', 'money', 'home'],
            description: 'Идентификатор раздела для переименования.',
          },
          renameSectionLabel: {
            type: Type.STRING,
            description: 'Новое название раздела (до 40 символов).',
          },
          familyName: { type: Type.STRING, description: 'Новое название семьи.' },
          currency: {
            type: Type.STRING,
            enum: ['RUB', 'USD', 'EUR', 'UAH'],
            description: 'Новая валюта семейного бюджета.',
          },
          title: { type: Type.STRING, description: 'Название задания, события, операции, цели или дела.' },
          description: { type: Type.STRING, description: 'Описание или комментарий к заданию.' },
          rewardUah: { type: Type.NUMBER, description: 'Награда за задание в гривнах (число > 0).' },
          assigneeName: { type: Type.STRING, description: 'Имя участника/ребёнка.' },
          date: { type: Type.STRING, description: 'Дата в формате YYYY-MM-DD.' },
          time: { type: Type.STRING, description: 'Время в формате HH:MM.' },
          category: { type: Type.STRING, description: 'Категория события, покупки или финансовой операции.' },
          text: { type: Type.STRING, description: 'Текст сообщения в семейный чат.' },
          topic: {
            type: Type.STRING,
            enum: ['Общее', 'Покупки', 'Планы', 'Важное'],
          },
          pinned: { type: Type.BOOLEAN },
          txType: { type: Type.STRING, enum: ['income', 'expense'] },
          amount: { type: Type.NUMBER },
          targetAmount: { type: Type.NUMBER },
          currentAmount: { type: Type.NUMBER },
          deadline: { type: Type.STRING },
          name: { type: Type.STRING, description: 'Название товара в список покупок.' },
          quantity: { type: Type.STRING, description: 'Количество товара (например: 2 л, 1 кг).' },
          area: {
            type: Type.STRING,
            enum: ['Уборка', 'Ремонт и быт', 'ЖКУ и счета', 'Питомцы', 'Другое'],
          },
          recurrence: {
            type: Type.STRING,
            enum: ['Разовое', 'Еженедельно', 'Ежемесячно'],
          },
          targetId: { type: Type.STRING, description: 'ID существующего элемента из контекста для обновления или удаления.' },
          completed: { type: Type.BOOLEAN },
          checked: { type: Type.BOOLEAN },
          status: { type: Type.STRING, enum: ['todo', 'done'] },
          deltaAmount: { type: Type.NUMBER },
          expiresAt: { type: Type.STRING, description: 'Дата актуальности объявления в формате YYYY-MM-DD.' },
          attachUserImage: {
            type: Type.BOOLEAN,
            description: 'Если true, прикрепить изображение из сообщения пользователя к объявлению, сообщению в чат или заданию.',
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'actions'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/ai/command', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(500).json({
        error: 'Серверу не передан GEMINI_API_KEY. Настройте ключ в Settings > Secrets.',
      });
      return;
    }

    const { prompt, imageDataUrl, history, context } = req.body as {
      prompt?: string;
      imageDataUrl?: string;
      history?: { role: 'user' | 'assistant'; text: string }[];
      context?: Record<string, unknown>;
    };

    const imgMatch =
      typeof imageDataUrl === 'string' && imageDataUrl.length <= 350_000
        ? imageDataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
        : null;

    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!cleanPrompt && !imgMatch) {
      res.status(400).json({ error: 'Введите запрос или прикрепите изображение для нейросети.' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const systemInstruction = `Ты — встроенная нейросеть-управляющий семейного веб-приложения «Семья».
Сегодняшняя дата: ${today}.
Твоя задача: выполнять любые запросы пользователя, изменяя оформление, структуру и данные приложения так, чтобы изменения сразу сохранились в базе данных и мгновенно обновились у ВСЕХ пользователей семьи в реальном времени.

ЧТО ТЫ УМЕЕШЬ МЕНЯТЬ ПО ЗАПРОСУ:
1. Оформление и структуру приложения для всех пользователей (action "update_appearance" или "reset_appearance"):
   - менять название бренда в шапке (brandName), заголовок и текст главного баннера (bannerTitle, bannerSubtitle);
   - менять цветовую тему (accentTheme: teal = бирюзовый, indigo = синий, emerald = изумрудный, amber = янтарный, rose = розовый, slate = графитовый, newyear = Новогодняя тема с гирляндами сверху и снегопадом) и фон (surfaceMode: light = светлый, warm = тёплый кремовый, slate = серый, snow = зимний снежный);
   - ставить или убирать общее объявление сверху для всей семьи (liveAnnouncement);
   - переименовывать разделы (renameSectionId + renameSectionLabel) или скрывать/возвращать разделы (hideSection / showSection);
   - добавлять, удалять или очищать общие правила семьи / карточки на главном экране (addCustomNote, removeCustomNote, clearCustomNotes).
2. Данные всех разделов для всей семьи:
   - переименовать семью и сменить валюту (update_family, только если userIsOwner = true);
   - создавать платные задания в гривнах для ребёнка (create_child_task, только если canManageTasks = true);
   - добавлять или отмечать события календаря (add_event, toggle_event);
   - писать или закреплять сообщения в семейном чате (add_message);
   - публиковать объявления на семейную доску объявлений (add_announcement: title, description/text, category из ['Важное', 'Напоминание', 'Покупки и быт', 'Праздник', 'Отдам / Найду', 'Другое'], pinned, expiresAt);
   - записывать доходы/траты, создавать цели накоплений и пополнять их (add_transaction, add_goal, contribute_goal);
   - добавлять, отмечать и удалять товары в списке покупок (add_shopping, toggle_shopping, delete_shopping);
   - добавлять и отмечать домашние дела/счета ЖКУ (add_home_task, toggle_home_task).
3. Если пользователь прикрепил изображение: внимательно изучи его содержимое (список продуктов, чек, фото комнаты, объявление и т.д.) и помоги по запросу. Если пользователь просит сохранить/опубликовать сообщение, объявление или задание вместе с этим фото — установи attachUserImage: true.

ПРАВИЛА:
- Всегда отвечай по-русски, кратко и понятно.
- Если пользователь просит что-то изменить, обязательно сформируй соответствующие действия в массиве actions.
- Если для действия нужны права (например, создание платных заданий доступно только Маме, Папе или Создателю, а переименование семьи — Создателю) и у текущего пользователя этих прав нет — честно объясни это в reply и не добавляй запрещённое действие.
- Если пользователь просит отметить или удалить существующий элемент (событие, покупку, цель, домашнее дело), бери точный id из переданного контекста в поле targetId.
- Для дат используй формат YYYY-MM-DD (по умолчанию ${today}).`;

    const conversationText = Array.isArray(history)
      ? history
          .slice(-6)
          .map((h) => `${h.role === 'user' ? 'Пользователь' : 'Нейросеть'}: ${h.text}`)
          .join('\n')
      : '';

    const fullPrompt = [
      `ТЕКУЩЕЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ И СЕМЬИ:\n${JSON.stringify(context ?? {}, null, 2)}`,
      conversationText ? `НЕДАВНИЙ ДИАЛОГ:\n${conversationText}` : '',
      `НОВЫЙ ЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n${cleanPrompt || 'Изучи прикреплённое изображение и помоги по нему.'}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const contents = imgMatch
      ? {
          parts: [
            {
              inlineData: {
                mimeType: imgMatch[1] === 'image/jpg' ? 'image/jpeg' : imgMatch[1],
                data: imgMatch[2],
              },
            },
            { text: fullPrompt },
          ],
        }
      : fullPrompt;

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: ACTION_SCHEMA,
          },
        });

        const rawText = response.text?.trim();
        if (!rawText) {
          throw new Error('Пустой ответ от модели Gemini.');
        }

        const parsed = JSON.parse(rawText) as {
          reply?: string;
          actions?: Record<string, unknown>[];
        };

        res.json({
          reply: parsed.reply || 'Готово, изменения применены для всех участников.',
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        });
        return;
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number })?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          break;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Ошибка обращения к нейросети Gemini.';
    res.status(502).json({ error: message });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
