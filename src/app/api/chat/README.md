# Chat API Route Documentation

## Обзор

Этот API endpoint обрабатывает chat запросы с использованием AI агента и OpenAI GPT-4.1. Реализован с интеграцией Sentry для трейсинга и мониторинга производительности.

## Архитектура

```
HTTP Request → Sentry Span "chat-request" 
    ├── Sentry Span "chat-agent-processing" → Effect-based Agent
    └── Sentry Span "openai-stream-call" → OpenAI API
        └── StreamTextResult → UI
```

## Основные компоненты

### 1. **HTTP Handler** (`POST /api/chat`)
- Принимает массив сообщений в формате `UIMessage[]`
- Конвертирует в `ModelMessage[]` для обработки
- Возвращает streaming response для UI

### 2. **Effect-based Agent** (`chatAgentEffect`)
- Анализирует намерения пользователя (помощь, заказы, общий чат)
- Выбирает подходящую стратегию ответа
- Настраивает параметры модели (температура, системный промпт)
- Добавляет контекст к сообщениям

### 3. **OpenAI Integration**
- Использует GPT-4.1 с конфигурацией от агента
- Streaming response для реального времени
- Передает все параметры агента (температура, промпты)

## Sentry Tracing Implementation

### Spans Hierarchy

1. **`chat-request`** (Root Span)
   - **Operation**: `http.server`
   - **Attributes**:
     - `http.method: "POST"`
     - `http.route: "/api/chat"`
   - **Duration**: Полное время обработки запроса

2. **`chat-agent-processing`** (Child Span)
   - **Operation**: `ai.agent`
   - **Attributes**:
     - `agent.messages.count: number` - количество входящих сообщений
     - `agent.last_message_role: string` - роль последнего сообщения
   - **Duration**: Время работы агента (анализ + конфигурация)

3. **`openai-stream-call`** (Child Span)
   - **Operation**: `ai.chat_completions.create`
   - **Attributes**:
     - `ai.model.name: "gpt-4.1"`
     - `ai.model.provider: "openai"`
     - `ai.system_prompt_length: number`
     - `ai.messages_count: number`
     - `ai.temperature: number`
   - **Duration**: Время создания stream (не полного ответа)

### Error Handling

- **Agent Errors**: Автоматически отправляются в Sentry через `Sentry.captureException()`
- **HTTP Errors**: Обрабатываются на уровне root span
- **OpenAI Errors**: Отслеживаются в соответствующем span

## Agent Logic Overview

### Intent Analysis
Агент определяет намерение на основе ключевых слов:
- `"help"` или `"помощь"` → `help_request`
- `"order"` или `"заказ"` → `order_inquiry`  
- По умолчанию → `general_chat`

### Response Strategies
Каждое намерение имеет свою стратегию:

```typescript
{
  help_request: {
    systemPrompt: "You are a technical support assistant...",
    parameters: { temperature: 0.3 } // Более точные ответы
  },
  order_inquiry: {
    systemPrompt: "You are an order assistant...",
    parameters: { temperature: 0.5 } // Сбалансированно
  },
  general_chat: {
    systemPrompt: "You are a friendly assistant...",
    parameters: { temperature: 0.8 } // Более креативно
  }
}
```

### Context Enhancement
Агент может добавлять дополнительный контекст:
- Для заказов: информация о активных заказах
- Для помощи: релевантная документация
- Для общего чата: персонализация

## Effect.js Integration

### Why Effect.js?
- **Композиция**: Легко комбинировать операции
- **Error Handling**: Строгая типизация ошибок
- **Трейсинг**: Встроенная поддержка spans (хотя мы используем Sentry)
- **Тестируемость**: Все операции pure functions

### Error Recovery
```typescript
chatAgentEffect(modelMessages).pipe(
  Effect.tapError((error) => 
    Effect.sync(() => Sentry.captureException(error))
  ),
)
```

Агент имеет встроенный fallback на дефолтные значения при ошибках.

## Monitoring & Observability

### Sentry Dashboard
Вы можете отслеживать:
- **Latency**: Время ответа каждого компонента
- **Throughput**: Количество запросов в секунду
- **Error Rate**: Процент ошибок по компонентам
- **User Experience**: Session Replay для отладки UI

### Key Metrics
- **Agent Processing Time**: Время анализа намерений
- **OpenAI Response Time**: Время создания stream
- **Total Request Time**: E2E латентность
- **Temperature Distribution**: Какие стратегии используются чаще

### Debug Information
Каждый span содержит детальную информацию для отладки:
- Количество и типы сообщений
- Длина системных промптов
- Параметры модели
- Версия модели и провайдер

## Development & Testing

### Local Development
```bash
# Установите SENTRY_DSN в .env.local
NEXT_PUBLIC_SENTRY_DSN=your-dsn-here

# Запустите dev server
npm run dev
```

### Testing Agent Logic
```typescript
// Тестируйте агента изолированно
const result = await Effect.runPromise(
  chatAgentEffect([
    { role: "user", content: "help me with order" }
  ])
);
// result.parameters.temperature === 0.5 (order_inquiry)
```

### Monitoring in Production
- Установите `tracesSampleRate: 0.1` для production
- Настройте алерты в Sentry для критических ошибок
- Мониторьте P95 латентность для каждого компонента

## Configuration Files

- **`sentry.server.config.js`**: Server-side Sentry config
- **`sentry.client.config.js`**: Client-side Sentry config  
- **`sentry.edge.config.js`**: Edge runtime Sentry config
- **`instrumentation.ts`**: Next.js instrumentation hook

## Future Improvements

1. **Caching**: Кэширование результатов агента для похожих запросов
2. **Rate Limiting**: Ограничение запросов по пользователям
3. **A/B Testing**: Тестирование разных стратегий агента
4. **Custom Metrics**: Бизнес-метрики (satisfaction, task completion)
5. **Advanced Context**: RAG integration для более релевантного контекста
