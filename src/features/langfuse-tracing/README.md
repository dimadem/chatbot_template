# Интеграция трассировки Langfuse

Современное решение трассировки на основе Effect, оптимизированное для Vercel/серверных сред.

## Обзор

Этот функционал обеспечивает чистую, типобезопасную интеграцию между платформой наблюдаемости [Langfuse](https://langfuse.com/) и Effect-TS, с особыми оптимизациями для серверных развертываний.

## Архитектура

```
src/features/langfuse-tracing/
├── index.ts                    # Экспорт публичного API
├── README.md                   # Эта документация
├── lib/
│   ├── langfuse-effect.ts     # Основной обертка Effect для сервиса
│   ├── langfuse-helpers.ts    # Утилиты высокого уровня
│   └── vercel-helpers.ts      # Оптимизации для серверных сред
└── model/
    └── types.ts               # Определения типов
```

## Основные концепции

### 1. Слой сервиса Effect
Интеграция оборачивает SDK Langfuse в сервис Effect, предоставляя:
- **Типобезопасность**: Все операции основаны на Effect с правильной обработкой ошибок
- **Внедрение зависимостей**: Сервис предоставляется через паттерн слоя Effect
- **Управление ресурсами**: Автоматическая очистка и сброс данных

### 2. Оптимизация для серверных сред
Особая обработка для сред с коротким временем выполнения:
- **waitUntil**: Использует `waitUntil` от Vercel для сброса данных без блокировки ответа
- **Фоновая обработка**: События ставятся в очередь и отправляются асинхронно
- **Плавное завершение**: Альтернативный блокирующий сброс для критических сценариев

### 3. Функции наблюдаемости
- **Трассы**: Контексты выполнения верхнего уровня (например, запросы чата)
- **Спаны**: Подоперации внутри трасс
- **Генерации**: Взаимодействия с AI-моделями с автоматическим отслеживанием токенов
- **Обработка ошибок**: Встроенная отчетность об ошибках SDK

## Использование

### Базовая настройка

```typescript
import { LangfuseLayer, withLangfuseVercelFlush } from "@/features/langfuse-tracing";

// В вашем API маршруте
export async function POST(req: Request) {
  const result = await Effect.runPromise(
    withLangfuseVercelFlush(
      // Ваш бизнес-логика здесь
      myBusinessLogic()
    ).pipe(Effect.provide(LangfuseLayer))
  );
  
  return result;
}
```

### Переменные окружения

```bash
# Обязательные
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Необязательные
LANGFUSE_HOST=https://cloud.langfuse.com  # По умолчанию
LANGFUSE_DEBUG=true                       # Включить подробное логирование
LANGFUSE_SAMPLE_RATE=0.1                 # Выборка 10% трасс
```

### Создание трасс

```typescript
import { createVercelChatTrace } from "@/features/langfuse-tracing";

const trace = yield* createVercelChatTrace(
  "chat-request",
  { messages: [...] },
  { 
    model: "gpt-4",
    userId: "user-123",
    environment: "production"
  }
);
```

### Отслеживание генераций AI

```typescript
const generation = yield* trace.generation({
  name: "chat-completion",
  model: "gpt-4",
  input: messages,
});

// После вызова LLM
yield* generation.update({
  output: response.text,
  usage: {
    inputTokens: response.usage.inputTokens,
    outputTokens: response.usage.outputTokens,
    totalTokens: response.usage.totalTokens,
  },
});
```

## Справочник API

### Основной сервис (`LangfuseService`)

```typescript
interface LangfuseService {
  createTrace(name: string, input?: any): Effect.Effect<LangfuseTrace>
  flush(): Effect.Effect<void>
  getFlushPromise(): Effect.Effect<Promise<void>>  // Для waitUntil
  shutdown(): Effect.Effect<void>                  // Блокирующий сброс
  debug(): Effect.Effect<void>                     // Включить режим отладки
}
```

### Утилиты для Vercel

```typescript
// Неблокирующий сброс для серверных сред
withLangfuseVercelFlush<A, E>(effect: Effect.Effect<A, E, LangfuseService>)

// Блокирующий сброс, если время ответа не важно
withLangfuseServerlessShutdown<A, E>(effect: Effect.Effect<A, E, LangfuseService>)

// Оптимизированное создание трасс
createVercelChatTrace(name: string, input: any, metadata?: Record<string, any>)
```

## Особенности развертывания

### Функции Vercel
- Использует `@vercel/functions` `waitUntil` для фонового сброса
- Без блокировки ответа, оптимальный пользовательский опыт
- Обрабатывает тайм-ауты выполнения Vercel

### Другие серверные среды
- Используйте `withLangfuseServerlessShutdown` для блокирующего сброса
- Убедитесь, что тайм-аут достаточен для передачи данных
- Следите за потерянными событиями в логах платформы

### Обработка ошибок
```typescript
// Ошибки SDK автоматически логируются
langfuse.on("error", (err) => {
  console.error("[Langfuse SDK error]", err);
});

// Включите режим отладки для устранения неполадок
LANGFUSE_DEBUG=true npm run dev
```

## Рекомендации

1. **Выборка**: Используйте `LANGFUSE_SAMPLE_RATE` в продакшене для контроля затрат
2. **Метаданные**: Включайте контекст пользователя, окружение и информацию о версии
3. **Входные данные**: Ограничьте размер входных данных для трасс (последние N сообщений, а не всю историю)
4. **Границы ошибок**: Оборачивайте трассировку в try-catch, чтобы предотвратить сбои приложения
5. **Тестирование**: Используйте режим отладки во время разработки

## Производительность

- **Асинхронность по умолчанию**: Все операции неблокирующие
- **Пакетирование**: SDK автоматически объединяет запросы в пакеты
- **Эффективность памяти**: События ставятся в очередь и периодически сбрасываются
- **Обработка тайм-аутов**: Настраиваемые тайм-ауты для сетевых вызовов

## Устранение неполадок

### Нет данных в Langfuse
1. Проверьте, что переменные окружения настроены правильно
2. Включите `LANGFUSE_DEBUG=true` для подробного логирования
3. Убедитесь в наличии сетевого подключения к конечной точке Langfuse
4. Проверьте, что выборка не слишком ограничена

### Высокая задержка
1. Убедитесь, что используется `withLangfuseVercelFlush` (неблокирующий)
2. Проверьте, включен ли режим отладки в продакшене
3. Следите за размерами пакетов и частотой сброса

### Утечки памяти
1. Убедитесь, что слои Effect предоставлены правильно
2. Проверьте наличие необработанных отклонений обещаний
3. Следите за использованием памяти серверных функций

## Заметки по миграции

Эта реализация заменяет предыдущий подход на основе OTLP из-за:
- Проблем с надежностью конечной точки OTLP в облаке Langfuse
- Улучшенной обработки ошибок и отладки в прямом SDK
- Более простой настройки и обслуживания
- Родных функций Langfuse (подсказки, оценки и т.д.)

## Связанная документация

- [Langfuse JS/TS SDK](https://langfuse.com/docs/sdk/typescript)
- [Документация Effect-TS](https://effect.website/)
- [API функций Vercel](https://vercel.com/docs/functions)
