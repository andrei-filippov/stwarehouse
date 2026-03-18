// Система логирования с уровнями
// В production логи отключены по умолчанию

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enabled: boolean;
  prefix?: string;
}

// Уровни логирования (числовые значения для сравнения)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Глобальная конфигурация
const globalConfig: LoggerConfig = {
  level: (import.meta.env.VITE_LOG_LEVEL as LogLevel) || 'info',
  enabled: import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOGS === 'true',
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      ...globalConfig,
      ...config,
    };
  }

  // Создать дочерний логгер с префиксом
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, args: any[]): any[] {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : '';
    return [`[${timestamp}]${prefix}[${level.toUpperCase()}]`, ...args];
  }

  debug(...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(...this.formatMessage('debug', args));
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage('info', args));
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', args));
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', args));
    }
  }

  // Установить уровень логирования
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  // Включить/выключить логи
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// Экспортируем глобальный логгер
export const logger = new Logger();

// Фабрика для создания логгеров с префиксом
export function createLogger(prefix: string): Logger {
  return logger.child(prefix);
}

// Утилиты для обратной совместимости
export function debugLog(...args: any[]): void {
  logger.debug(...args);
}

export function infoLog(...args: any[]): void {
  logger.info(...args);
}

export function warnLog(...args: any[]): void {
  logger.warn(...args);
}

export function errorLog(...args: any[]): void {
  logger.error(...args);
}

export default Logger;
