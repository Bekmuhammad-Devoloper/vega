import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Telegram sovg'asi (katalog uchun). */
export interface GiftInfo {
  /** Telegram'dagi sovg'a id (string sifatida — BigInt bo'lgani uchun). */
  giftId: string;
  /** Narxi — Stars. */
  stars: number;
  /** Cheklangan sovg'ami (tugab qolishi mumkin). */
  limited: boolean;
  /** Qolgan soni (cheklangan bo'lsa). */
  remains: number | null;
  /** Sotib bo'lingan (endi olinmaydi). */
  soldOut: boolean;
  /** Emoji (sticker'dan olinsa). */
  emoji: string | null;
}

export type GiftSendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

/**
 * Telegram SOVG'ALARINI yetkazish — MTProto userbot orqali.
 *
 * Nega Bot API emas: bot Stars balansini to'ldirib bo'lmaydi (Fragment botlarga
 * Stars yubormaydi — 4/4 bot rad etilgani tekshirilgan). Sovg'ani faqat HAQIQIY
 * foydalanuvchi akkaunti yubora oladi, uning Stars balansidan to'lanadi.
 *
 * Sozlash: TG_API_ID + TG_API_HASH (my.telegram.org) + TG_SESSION (login natijasi).
 * Sessiya string — akkauntga TO'LIQ kirish demak, .env da (chmod 600) saqlanadi.
 *
 * DIQQAT: userbot Telegram qoidalariga zid — akkaunt bloklanishi mumkin.
 * Shuning uchun ASOSIY akkaunt emas, alohida akkaunt ishlatilsin.
 */
@Injectable()
export class TelegramUserbotProvider implements OnModuleDestroy {
  private readonly logger = new Logger(TelegramUserbotProvider.name);
  constructor(private readonly config: ConfigService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  private get apiId(): number {
    return Number(this.config.get<string>('TG_API_ID') ?? 0);
  }
  private get apiHash(): string {
    return (this.config.get<string>('TG_API_HASH') ?? '').trim();
  }
  private get session(): string {
    return (this.config.get<string>('TG_SESSION') ?? '').trim();
  }

  isConfigured(): boolean {
    return this.apiId > 0 && this.apiHash.length > 0 && this.session.length > 0;
  }

  /** Ulangan klient (bir marta ochiladi va qayta ishlatiladi). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async client(): Promise<any> {
    if (!this.isConfigured()) throw new Error('Userbot sozlanmagan');
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        // Runtime import — userbot sozlanmagan o'rnatmalarda kutubxona yuklanmasin.
        const { TelegramClient } = await import('teleproto');
        const { StringSession } = await import('teleproto/sessions');
        const c = new TelegramClient(
          new StringSession(this.session),
          this.apiId,
          this.apiHash,
          { connectionRetries: 3, autoReconnect: true },
        );
        await c.connect();
        const me = await c.getMe();
        this.logger.log(
          `Userbot ulandi: @${me?.username ?? '—'} (id=${String(me?.id)})`,
        );
        return c;
      })().catch((e) => {
        this.clientPromise = null; // keyingi urinishda qayta ulanadi
        throw e;
      });
    }
    return this.clientPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.clientPromise) return;
    try {
      const c = await this.clientPromise;
      await c.disconnect();
    } catch {
      /* yopilishda xato muhim emas */
    }
  }

  /** Userbot akkauntining Stars balansi. */
  async starBalance(): Promise<number | null> {
    if (!this.isConfigured()) return null;
    try {
      const { Api } = await import('teleproto');
      const c = await this.client();
      const st = await c.invoke(
        new Api.payments.GetStarsStatus({ peer: new Api.InputPeerSelf() }),
      );
      return Number(st?.balance?.amount ?? st?.balance ?? 0);
    } catch (e) {
      this.logger.warn(`starBalance: ${(e as Error).message}`);
      return null;
    }
  }

  /** Telegram'dagi mavjud sovg'alar ro'yxati (katalog sinxroni uchun). */
  async listGifts(): Promise<GiftInfo[]> {
    const { Api } = await import('teleproto');
    const c = await this.client();
    const res = await c.invoke(new Api.payments.GetStarGifts({ hash: 0 }));
    const gifts = res?.gifts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return gifts.map((g: any) => {
      const remains =
        g.availabilityRemains === undefined || g.availabilityRemains === null
          ? null
          : Number(g.availabilityRemains);
      return {
        giftId: String(g.id),
        stars: Number(g.stars ?? 0),
        limited: Boolean(g.limited),
        remains,
        soldOut: Boolean(g.soldOut) || remains === 0,
        emoji: g.sticker?.attributes?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any) => typeof a.alt === 'string',
        )?.alt ?? null,
      } as GiftInfo;
    });
  }

  /**
   * @username -> sovg'a yuborish. Narx sovg'aning o'zida (Stars), userbot
   * akkauntining balansidan yechiladi.
   */
  async sendGift(
    username: string,
    giftId: string,
    message?: string,
  ): Promise<GiftSendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Userbot sozlanmagan', retryable: false };
    }
    try {
      const { Api } = await import('teleproto');
      const bigInt = (await import('big-integer')).default;
      const c = await this.client();

      const uname = username.replace(/^@/, '');
      const peer = await c.getInputEntity(uname);

      const invoice = new Api.InputInvoiceStarGift({
        peer,
        giftId: bigInt(giftId),
        ...(message
          ? { message: new Api.TextWithEntities({ text: message.slice(0, 128), entities: [] }) }
          : {}),
      });

      const form = await c.invoke(new Api.payments.GetPaymentForm({ invoice }));
      await c.invoke(
        new Api.payments.SendStarsForm({ formId: form.formId, invoice }),
      );

      this.logger.log(`Sovg'a ${giftId} -> @${uname}`);
      return { ok: true };
    } catch (e) {
      const msg = (e as Error).message || String(e);
      // Balans yetmasa yoki sovg'a tugagan bo'lsa qayta urinish foydasiz.
      const fatal =
        /BALANCE_TOO_LOW|STARGIFT_USAGE_LIMITED|SOLD_OUT|USERNAME_(NOT_OCCUPIED|INVALID)|PEER_ID_INVALID/i.test(
          msg,
        );
      this.logger.warn(`sendGift @${username} (${giftId}): ${msg}`);
      return { ok: false, error: msg, retryable: !fatal };
    }
  }
}
