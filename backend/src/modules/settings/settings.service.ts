import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { limitsFor } from '@/common/tariff';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';

export interface StoreSettings {
  name?: string;
  phone?: string;
  workingHours?: string;
  about?: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  /** Storefront foni — rang (#RRGGBB). null = standart */
  backgroundColor?: string | null;
  /** Storefront foni — rasm URL. null = standart. Rasm bo'lsa rangdan ustun. */
  backgroundImageUrl?: string | null;
  /** Paid tarif (branding) — webapp sarlavhasida do'kon nomini ko'rsatish uchun */
  branded?: boolean;
  /** "Biz haqimizda" havolalari — ulangan bo'lsa ko'rsatiladi */
  mainChannelUrl?: string | null;
  reviewChannelUrl?: string | null;
  adminContactUrl?: string | null;
}

export interface PublicSettings {
  store: StoreSettings;
  /** Valyuta kodi (masalan UZS) — storefront narxlarni formatlashda ishlatadi */
  currency: string;
  payments: { payme: boolean; click: boolean; card: boolean };
  /** Karta o'tkazma uchun rekvizitlar (sozlangan bo'lsa) */
  cardPayment: { number: string; holder: string } | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TelegramBotService))
    private readonly telegram: TelegramBotService,
  ) {}

  // Kanal chat ID -> t.me havola (username) keshi (10 daqiqa).
  private readonly channelLinkCache = new Map<
    string,
    { url: string | null; at: number }
  >();

  /** Ulangan kanal (chat ID yoki @username) -> https://t.me/username. Topilmasa null. */
  private async resolveChannelLink(channelId?: string | null): Promise<string | null> {
    const id = (channelId ?? '').trim();
    if (!id) return null;
    const now = Date.now();
    const cached = this.channelLinkCache.get(id);
    if (cached && now - cached.at < 10 * 60 * 1000) return cached.url;
    let url: string | null = null;
    try {
      const bot = this.telegram.bot;
      if (bot) {
        const chat = id.startsWith('@')
          ? id
          : /^-?\d+$/.test(id)
            ? Number(id)
            : id;
        const info = (await bot.api.getChat(chat)) as { username?: string };
        if (info.username) url = `https://t.me/${info.username}`;
      }
    } catch {
      url = null;
    }
    this.channelLinkCache.set(id, { url, at: now });
    return url;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const row = await this.prisma.settings.findUnique({ where: { key } });
    return (row?.value as T | undefined) ?? null;
  }

  async getStore(tenantId?: string | null): Promise<StoreSettings> {
    // Tenant (do'kon) bo'lsa — o'sha sotuvchining ma'lumotini qaytaramiz
    if (tenantId) {
      const t = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          shopName: true,
          ownerPhone: true,
          workingHours: true,
          about: true,
          primaryColor: true,
          logoUrl: true,
          backgroundColor: true,
          backgroundImageUrl: true,
        },
      });
      if (t) {
        return {
          name: t.shopName,
          phone: t.ownerPhone ?? undefined,
          workingHours: t.workingHours ?? undefined,
          about: t.about ?? undefined,
          primaryColor: t.primaryColor,
          logoUrl: t.logoUrl,
          backgroundColor: t.backgroundColor,
          backgroundImageUrl: t.backgroundImageUrl,
        };
      }
    }
    return (
      (await this.get<StoreSettings>('store')) ?? {
        name: 'Vega',
        phone: '+998901234567',
        workingHours: '09:00–22:00',
      }
    );
  }

  async getPublic(tenantId?: string | null): Promise<PublicSettings> {
    const currency = process.env.DEFAULT_CURRENCY ?? 'UZS';
    // Tenant rejimida store+payments ma'lumotini bitta DB so'rovida olamiz —
    // bu endpoint webapp'ning har bir sahifa yuklanishida chaqiriladi.
    if (tenantId) {
      const t = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          shopName: true,
          ownerPhone: true,
          workingHours: true,
          about: true,
          primaryColor: true,
          logoUrl: true,
          backgroundColor: true,
          backgroundImageUrl: true,
          tariffPlan: true,
          paymeMerchantId: true,
          clickServiceId: true,
          clickMerchantId: true,
          manualCardNumber: true,
          manualCardHolder: true,
          manualPaymentChannelId: true,
          mainChannelUrl: true,
          reviewChannelUrl: true,
          adminContactUrl: true,
          ownerUsername: true,
          channelId: true,
          reviewsChannelId: true,
          reviewsEnabled: true,
        },
      });
      // Havolalar: aniq kiritilgan URL bo'lsa o'sha; aks holda ULANGAN kanal
      // (channelId / reviewsChannelId) @username'ini resolve qilib havola qilamiz.
      const store: StoreSettings = t
        ? {
            name: t.shopName,
            phone: t.ownerPhone ?? undefined,
            workingHours: t.workingHours ?? undefined,
            about: t.about ?? undefined,
            primaryColor: t.primaryColor,
            logoUrl: t.logoUrl,
            backgroundColor: t.backgroundColor,
            backgroundImageUrl: t.backgroundImageUrl,
            branded: limitsFor(t.tariffPlan).branding,
            mainChannelUrl:
              t.mainChannelUrl ?? (await this.resolveChannelLink(t.channelId)),
            reviewChannelUrl:
              t.reviewChannelUrl ??
              (t.reviewsEnabled
                ? await this.resolveChannelLink(t.reviewsChannelId)
                : null),
            adminContactUrl:
              t.adminContactUrl ??
              (t.ownerUsername ? `https://t.me/${t.ownerUsername}` : null),
          }
        : await this.getStore(null);
      const cardReady = !!(t?.manualCardNumber && t?.manualPaymentChannelId);
      return {
        store,
        currency,
        payments: {
          payme: !!t?.paymeMerchantId,
          click: !!(t?.clickServiceId && t?.clickMerchantId),
          card: cardReady,
        },
        cardPayment:
          cardReady && t?.manualCardNumber && t?.manualCardHolder
            ? { number: t.manualCardNumber, holder: t.manualCardHolder }
            : null,
      };
    }

    // Tenant'siz (global) chaqiruv — eski global Settings'dan
    const store = await this.getStore(null);
    return {
      store,
      currency,
      payments: { payme: false, click: false, card: false },
      cardPayment: null,
    };
  }
}
