# Интеграция трассировки Langfuse

Современное решение трассировки на основе Effect, оптимизированное для Vercel/серверных сред с поддержкой FSD архитектуры.

## Обзор

Этот функционал обеспечивает чистую, типобезопасную интеграцию между платформой наблюдаемости [Langfuse](https://langfuse.com/) и Effect-TS, с особыми оптимизациями для серверных развертываний.

## Архитектура (FSD)

```
src/features/langfuse-tracing/
├── index.ts                    # Экспорт публичного API
├── README.md                   # Эта документация
├── lib/
│   ├── langfuse-effect.ts     # Основной обертка Effect для сервиса
│   ├── langfuse-helpers.ts    # Утилиты высокого уровня
│   ├── usage-mappers.ts       # Маппинг типов usage (NEW!)
│   └── vercel-helpers.ts      # Оптимизации для серверных сред
└── model/
    └── types.ts               # Определения типов
```

## Быстрый старт

### 1. Основная настройка

```typescript
import { 
  LangfuseLayer, 
  withLangfuseVercelFlush,
  mapVercelUsageToLangfuse 
} from "@/features/langfuse-tracing";

// В вашем API маршруте
export async function POST(req: Request) {
  const result = await Effect.runPromise(
    withLangfuseVercelFlush(
      myBusinessLogic()
    ).pipe(Effect.provide(LangfuseLayer))
  );
  return result;
}
```

### 2. Переменные окружения

```bash
# Обязательные
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...

# Необязательные
LANGFUSE_HOST=https://cloud.langfuse.com  # По умолчанию
LANGFUSE_DEBUG=true                       # Включить подробное логирование
LANGFUSE_SAMPLE_RATE=0.1                 # Выборка 10% трасс
```

## Основные концепции

### 1. Слой сервиса Effect

Интеграция оборачивает SDK Langfuse в сервис Effect, предоставляя:

- **Типобезопасность**: полная поддержка TypeScript
- **Композиция**: легко комбинируется с другими Effect-сервисами  
- **Обработка ошибок**: встроенная обработка через Effect
- **Тестирование**: простое моккинг через Effect.provide()

### 2. Серверная оптимизация

- **Vercel Functions**: неблокирующий flush через `waitUntil`
- **Serverless**: адаптировано для коротких выполнений
- **Batching**: автоматическая группировка событий

### 3. Usage маппинг (NEW!)

Автоматическое преобразование между форматами:
- **Vercel AI SDK**: `{ inputTokens, outputTokens, totalTokens }`
- **Langfuse API**: `{ promptTokens, completionTokens, totalTokens }`

## Создание трасс

```typescript
import { createVercelChatTrace } from "@/features/langfuse-tracing";

const trace = yield* createVercelChatTrace(
  "chat-request",
  { messages: [...] },
  {
    model: "gpt-4",
    environment: "development",
    userId: "user-123",
  }
);
```

## Отслеживание генераций AI с маппингом usage

```typescript
import { mapVercelUsageToLangfuse } from "@/features/langfuse-tracing";

const generation = yield* trace.generation({
  name: "chat-completion",
  model: "gpt-4",
  input: messages,
});

// В onFinish callback
onFinish: (event) => {
  Effect.runSync(
    generation.update({
      output: event.text,
      usage: mapVercelUsageToLangfuse(event.usage), // Автоматический маппинг!
    })
  );
}
```

## Утилиты для работы с Usage

### mapVercelUsageToLangfuse

Автоматически преобразует формат usage из Vercel AI SDK в формат Langfuse:

```typescript
import { mapVercelUsageToLangfuse, type VercelUsage } from "@/features/langfuse-tracing";

// Vercel AI SDK usage
const vercelUsage: VercelUsage = {
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150
};

// Автоматическое преобразование
const langfuseUsage = mapVercelUsageToLangfuse(vercelUsage);
// Результат: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
```

### isValidUsage

Проверяет валидность данных usage:

```typescript
import { isValidUsage } from "@/features/langfuse-tracing";

if (isValidUsage(event.usage)) {
  const usage = mapVercelUsageToLangfuse(event.usage);
  // Безопасное использование
}
```

## Примеры использования

### 1. Простой API route

```typescript
import { 
  LangfuseLayer, 
  withLangfuseVercelFlush,
  createVercelChatTrace,
  mapVercelUsageToLangfuse 
} from "@/features/langfuse-tracing";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    const result = await Effect.runPromise(
      withLangfuseVercelFlush(
        Effect.gen(function* () {
          // Создаем трейс
          const trace = yield* createVercelChatTrace(
            "chat-request",
            { messages },
            { model: "gpt-4", userId: "user-123" }
          );

          // Создаем генерацию
          const generation = yield* trace.generation({
            name: "chat-completion",
            model: "gpt-4",
            input: messages,
          });

          // Вызываем LLM
          const response = streamText({
            model: openai("gpt-4"),
            messages,
            onFinish: (event) => {
              Effect.runSync(
                generation.update({
                  output: event.text,
                  usage: mapVercelUsageToLangfuse(event.usage), // ✨ Простой маппинг
                })
              );
            },
          });

          return response;
        })
      ).pipe(Effect.provide(LangfuseLayer))
    );

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}
```

### 2. Использование в бизнес-логике

```typescript
import { LangfuseService, mapVercelUsageToLangfuse } from "@/features/langfuse-tracing";

export const processUserQuery = (query: string) =>
  Effect.gen(function* () {
    const langfuse = yield* LangfuseService;
    
    const trace = yield* langfuse.createTrace("user-query-processing");
    
    // Ваша бизнес-логика
    const result = yield* someBusinessLogic(query);
    
    yield* trace.update({ 
      output: result,
      metadata: { queryLength: query.length }
    });
    
    return result;
  });
```

### 3. Переиспользование в разных частях приложения

```typescript
// В любом месте приложения
import { withLangfuseTrace } from "@/features/langfuse-tracing";

export const analyzeDocument = (document: string) =>
  withLangfuseTrace(
    "document-analysis",
    Effect.gen(function* () {
      // Логика анализа документа
      return yield* performAnalysis(document);
    })
  );

// Использование
const result = await Effect.runPromise(
  analyzeDocument("some document").pipe(Effect.provide(LangfuseLayer))
);
```

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
