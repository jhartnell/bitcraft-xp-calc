// Zero-dependency bounded in-memory ring buffer for runtime & API diagnostic events

export type DiagnosticEventLevel = 'info' | 'warn' | 'error';
export type DiagnosticEventSource = 'window' | 'promise' | 'error-boundary' | 'api' | 'app';

export interface DiagnosticEvent {
  timestamp: string;
  level: DiagnosticEventLevel;
  source: DiagnosticEventSource;
  message: string;
  details?: Record<string, unknown>;
}

export const MAX_DIAGNOSTIC_EVENTS = 60;
const MAX_MESSAGE_LENGTH = 400;
const MAX_DETAIL_STRING_LENGTH = 600;

let eventBuffer: DiagnosticEvent[] = [];

function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}… [truncated]`;
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(details)) {
    if (val === undefined) continue;
    if (typeof val === 'string') {
      sanitized[key] = truncateString(val, MAX_DETAIL_STRING_LENGTH);
    } else if (typeof val === 'number' || typeof val === 'boolean' || val === null) {
      sanitized[key] = val;
    } else {
      try {
        sanitized[key] = truncateString(JSON.stringify(val), MAX_DETAIL_STRING_LENGTH);
      } catch {
        sanitized[key] = String(val);
      }
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function recordDiagnosticEvent(
  event: Omit<DiagnosticEvent, 'timestamp'> & { timestamp?: string }
): void {
  const entry: DiagnosticEvent = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    level: event.level,
    source: event.source,
    message: truncateString(String(event.message || 'Unknown event'), MAX_MESSAGE_LENGTH),
    ...(event.details ? { details: sanitizeDetails(event.details) } : {}),
  };

  eventBuffer.push(entry);
  if (eventBuffer.length > MAX_DIAGNOSTIC_EVENTS) {
    eventBuffer = eventBuffer.slice(eventBuffer.length - MAX_DIAGNOSTIC_EVENTS);
  }
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  return [...eventBuffer];
}

export function clearDiagnosticEvents(): void {
  eventBuffer = [];
}
