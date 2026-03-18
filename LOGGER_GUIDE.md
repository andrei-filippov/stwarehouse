# Руководство по использованию логгера

## Быстрый старт

```typescript
import { createLogger } from '../lib/logger';

const logger = createLogger('moduleName');

// Использование
logger.debug('Debug message', data);
logger.info('Info message', data);
logger.warn('Warning message', data);
logger.error('Error message', error);
```

## Уровни логирования

- `debug` - Отладочная информация (только в development)
- `info` - Информационные сообщения
- `warn` - Предупреждения
- `error` - Ошибки

## Конфигурация

### Переменные окружения

```env
# Уровень логирования (debug, info, warn, error)
VITE_LOG_LEVEL=info

# Включить логи в production
VITE_ENABLE_LOGS=true
```

### По умолчанию

- **Development**: логи включены, уровень `info`
- **Production**: логи отключены

## Примеры использования

### В hooks

```typescript
// useChecklists.ts
const logger = createLogger('checklists');

logger.info('Loaded rules:', rules.length);
logger.debug('Detailed debug info:', data);
logger.warn('Network error, using cache');
logger.error('Failed to save:', error);
```

### Дочерние логгеры

```typescript
const parentLogger = createLogger('equipment');
const childLogger = parentLogger.child('sync');

// Вывод: [equipment:sync]
childLogger.info('Sync started');
```

## Миграция с console.log

### Было:
```typescript
console.log('Loaded data:', data);
console.error('Error:', err);
```

### Стало:
```typescript
logger.info('Loaded data:', data);
logger.error('Error:', err);
```

## Когда использовать какой уровень

### DEBUG
- Детальная информация для отладки
- Значения переменных
- Трассировка выполнения

### INFO
- Важные события
- Успешные операции
- Изменения состояния

### WARN
- Предупреждения
- Не критичные ошибки
- Fallback'ы (например, офлайн режим)

### ERROR
- Критичные ошибки
- Исключения
- Неудачные операции

## Глобальный логгер

```typescript
import { logger } from '../lib/logger';

logger.info('Global message');
```

## Утилиты

```typescript
import { debugLog, infoLog, warnLog, errorLog } from '../lib/logger';

// Для простых случаев
debugLog('Debug message');
infoLog('Info message');
```
