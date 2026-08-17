export interface BotTokenCheck {
  ok: boolean;
  username?: string;
  firstName?: string;
  error?: string;
}

/** Telegram bot tokenini getMe orqali tekshiradi. */
export async function checkBotToken(rawToken: string): Promise<BotTokenCheck> {
  const token = rawToken.trim();
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token)) {
    return { ok: false, error: "Token formati noto'g'ri" };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as {
      ok: boolean;
      result?: { username?: string; first_name?: string };
    };
    if (!data.ok || !data.result) {
      return { ok: false, error: 'Token yaroqsiz — @BotFather dan tekshiring' };
    }
    return { ok: true, username: data.result.username, firstName: data.result.first_name };
  } catch {
    return { ok: false, error: "Telegram bilan bog'lanib bo'lmadi" };
  }
}
