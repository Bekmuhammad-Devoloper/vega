import uz from './messages/uz.json';
import ru from './messages/ru.json';

export type Locale = 'uz' | 'ru';

export const messages = { uz, ru } as const;

export type Messages = typeof uz;

export function getMessages(locale: Locale): Messages {
  return messages[locale] as Messages;
}

export function tr(messages: Messages, path: string, vars?: Record<string, string | number>): string {
  const parts = path.split('.');
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  let str = typeof cur === 'string' ? cur : path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
