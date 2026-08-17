import { createHmac } from 'crypto';

export interface ParsedInitDataUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface ParsedInitData {
  user: ParsedInitDataUser;
  auth_date: number;
  query_id?: string;
  start_param?: string;
  hash: string;
}

const AUTH_MAX_AGE_SECONDS = 86_400; // 24 soat

export class InvalidInitDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInitDataError';
  }
}

export function verifyTelegramInitData(initData: string, botToken: string): ParsedInitData {
  if (!initData) throw new InvalidInitDataError('Empty initData');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new InvalidInitDataError('Missing hash');
  params.delete('hash');

  const dataCheckArray: string[] = [];
  for (const [key, value] of [...params.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    dataCheckArray.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArray.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) throw new InvalidInitDataError('Invalid hash');

  const authDateRaw = params.get('auth_date');
  if (!authDateRaw) throw new InvalidInitDataError('Missing auth_date');
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) throw new InvalidInitDataError('Bad auth_date');
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - authDate > AUTH_MAX_AGE_SECONDS) {
    throw new InvalidInitDataError('initData too old');
  }

  const userRaw = params.get('user');
  if (!userRaw) throw new InvalidInitDataError('Missing user');
  let user: ParsedInitDataUser;
  try {
    user = JSON.parse(userRaw) as ParsedInitDataUser;
  } catch {
    throw new InvalidInitDataError('Bad user payload');
  }
  if (!user.id) throw new InvalidInitDataError('Missing user.id');

  return {
    user,
    auth_date: authDate,
    query_id: params.get('query_id') ?? undefined,
    start_param: params.get('start_param') ?? undefined,
    hash,
  };
}
