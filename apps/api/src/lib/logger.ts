/**
 * Structured JSON logger — single line per event, parseable by Loki/CloudWatch/Datadog.
 *
 * Levels: debug, info, warn, error
 * Filter via LOG_LEVEL env (default: info)
 *
 * Usage: log.info('event.name', { foo: 'bar', requestId })
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold = LEVELS[(process.env.LOG_LEVEL ?? 'info') as Level] ?? LEVELS.info;

interface LogFields {
  requestId?: string;
  orgId?: string;
  userId?: string;
  duration?: number;
  status?: number;
  path?: string;
  [k: string]: unknown;
}

function emit(level: Level, event: string, fields: LogFields = {}): void {
  if (LEVELS[level] < threshold) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  // process.stderr for warn+error so they sort into stderr stream
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info:  (event: string, fields?: LogFields) => emit('info', event, fields),
  warn:  (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
