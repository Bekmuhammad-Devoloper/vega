import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Bot, type Context, InlineKeyboard, InputFile } from 'grammy';
import { WalletTxType } from '@prisma/client';
import { join } from 'path';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramBotService } from './telegram-bot.service';

/**
 * Sotuvchi ulagan Telegram kanali haqida jonli ma'lumot (e'lonlar sahifasida
 * "ulangan kanal" kartochkasi uchun). `connected` — bot kanalni ko'ra oladimi.
 */
export interface ChannelInfo {
  connected: boolean;
  /** connected=false bo'lsa — foydalanuvchiga ko'rsatiladigan sabab. */
  reason?: string;
  id?: string;
  title?: string;
  username?: string | null;
  type?: string; // 'channel' | 'group' | 'supergroup'
  description?: string | null;
  /** Obunachilar soni — faqat bot admin bo'lsa o'qiladi. */
  subscriberCount?: number | null;
  /** Bot kanalda admin (obunachi sonini o'qiy oladi / e'lon joylay oladi). */
  isAdmin?: boolean;
  /** Kanal rasmi (data URL — bot tokeni oshkor bo'lmaydi). Rasm bo'lmasa null. */
  photoDataUrl?: string | null;
}

/**
 * Har sotuvchining o'z Telegram boti — mijozlar o'sha bot orqali shu sotuvchining
 * do'konini ochadi. Webhook'lar /telegram/t/:tenantId/webhook ga keladi.
 */
@Injectable()
export class TenantBotService implements OnModuleInit {
  private readonly logger = new Logger(TenantBotService.name);
  private readonly bots = new Map<string, Bot>();
  private readonly webappUrl: string;
  private readonly appUrl: string;
  private readonly secret: string;
  private readonly globalBotToken: string;
  private readonly globalBotUsername: string;
  private readonly uploadDir: string;
  private readonly uploadsPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly globalBot: TelegramBotService,
    config: ConfigService,
  ) {
    this.webappUrl = (config.get<string>('WEBAPP_URL') ?? '').replace(/\/$/, '');
    this.appUrl = (config.get<string>('APP_URL') ?? '').replace(/\/$/, '');
    this.secret = config.get<string>('TELEGRAM_WEBHOOK_SECRET') ?? '';
    this.globalBotToken = (config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
    this.globalBotUsername = (config.get<string>('TELEGRAM_BOT_USERNAME') ?? '').replace(/^@/, '');
    this.uploadDir = config.get<string>('UPLOAD_DIR') ?? './uploads';
    this.uploadsPublicUrl = (config.get<string>('PUBLIC_UPLOADS_URL') ?? '/uploads').replace(/\/$/, '');
  }

  /** Public URL'dan disk yo'lini topadi — faqat bizning /uploads yuklamalari uchun. */
  private localUploadPath(url: string | null | undefined): string | null {
    if (!url || !url.startsWith(`${this.uploadsPublicUrl}/`)) return null;
    const name = url.slice(this.uploadsPublicUrl.length + 1);
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
    return join(this.uploadDir, name);
  }

  private channelChatId(channelId: string): string | number {
    return channelId.startsWith('@') ? channelId : Number(channelId);
  }

  /**
   * Kanal operatsiyalari uchun botni tanlaydi. AVVAL global Sellio boti
   * (@selliostorebot) — sotuvchi uchun qulay, bitta tanish botni admin qiladi.
   * U kanalga admin bo'lmasa — do'konning o'z botiga qaytamiz. Ikkala usul ham ishlaydi.
   */
  private async pickChannelBot(
    tenantId: string,
    channelId: string,
    tenantToken: string | null,
  ): Promise<{ bot: Bot; token: string } | null> {
    const chatId = this.channelChatId(channelId);
    const g = this.globalBot.bot;
    if (g && this.globalBotToken) {
      try {
        await g.api.getChat(chatId);
        return { bot: g, token: this.globalBotToken };
      } catch {
        /* global bot kanalga admin emas — do'kon botini sinaymiz */
      }
    }
    if (tenantToken) {
      const tb = await this.loadBot(tenantId);
      if (tb) {
        try {
          await tb.api.getChat(chatId);
          return { bot: tb, token: tenantToken };
        } catch {
          /* do'kon boti ham admin emas */
        }
      }
    }
    return null;
  }

  /**
   * Otziv kanali FAQAT global @Vega_uzbot orqali ishlaydi — shu bot
   * kanalда ADMIN ekanini tekshiradi (do'kon boti hisobga olinmaydi).
   * Saqlaganda oldindan validatsiya — jim ishlamay qolmasligi uchun.
   */
  async verifyChannelBotAdmin(channelId: string): Promise<{ ok: boolean }> {
    const bot = this.globalBot.bot;
    if (!bot) return { ok: false };
    try {
      const chatId = this.channelChatId(channelId);
      const me = await bot.api.getMe();
      const member = await bot.api.getChatMember(chatId, me.id);
      return {
        ok: member.status === 'administrator' || member.status === 'creator',
      };
    } catch {
      return { ok: false };
    }
  }

  /** Majburiy obuna — a'zo BO'LMAGAN kanallar ro'yxati. null = tekshirib bo'lmadi. */
  private async forcedSubMissing(
    tenantId: string,
    userId: number,
  ): Promise<Array<{ username: string; title: string }> | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { forcedSubEnabled: true, forcedSubChannels: true },
    });
    if (!t?.forcedSubEnabled || !Array.isArray(t.forcedSubChannels)) return [];
    const channels = t.forcedSubChannels as Array<{ username?: string; title?: string }>;
    if (!channels.length) return [];
    const gbot = this.globalBot.bot;
    if (!gbot) return null;
    const missing: Array<{ username: string; title: string }> = [];
    for (const c of channels) {
      const username = String(c.username ?? '').trim();
      if (!username) continue;
      try {
        const m = await gbot.api.getChatMember(username, userId);
        if (m.status === 'left' || m.status === 'kicked') {
          missing.push({ username, title: c.title || username });
        }
      } catch {
        // @Vega_uzbot admin emas / kanal topilmadi — bloklamaymiz (o'tkazamiz)
      }
    }
    return missing;
  }

  private forcedSubText(shopName: string): string {
    return (
      `📢 <b>${shopName}</b> do'konidan foydalanish uchun quyidagi kanal(lar)ga ` +
      `a'zo bo'ling, so'ng «✅ Tekshirish» tugmasini bosing:`
    );
  }

  private forcedSubKeyboard(channels: Array<{ username: string; title: string }>) {
    const kb = new InlineKeyboard();
    for (const c of channels) {
      kb.url(`📢 ${c.title}`, `https://t.me/${c.username.replace(/^@/, '')}`).row();
    }
    kb.text('✅ Tekshirish', 'fsub:check');
    return kb;
  }

  async onModuleInit(): Promise<void> {
    // Fonда — startupни bloklamaymiz
    void this.selfHeal().catch((err) =>
      this.logger.warn(`Tenant bot self-heal: ${(err as Error).message}`),
    );
  }

  /** Startupda: egasiz katalogni yagona do'konga biriktirish + barcha botlarni qayta sozlash. */
  private async selfHeal(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });

    // Yagona do'kon bo'lsa — egasiz (null) banner/promokodlarni unga biriktiramiz.
    if (tenants.length === 1) {
      const tid = tenants[0].id;
      const [bn, pc] = await Promise.all([
        this.prisma.banner.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
        this.prisma.promoCode.updateMany({ where: { tenantId: null }, data: { tenantId: tid } }),
      ]);
      if (bn.count || pc.count) {
        this.logger.log(`Backfill → tenant ${tid}: ${bn.count} banner, ${pc.count} promokod`);
      }
    }

    // Barcha ulangan botlarni qayta sozlaymiz (webhook + menu → ?shop=slug)
    const withBot = await this.prisma.tenant.findMany({
      where: { botToken: { not: null } },
      select: { id: true },
    });
    for (const t of withBot) {
      void this.configure(t.id).catch(() => undefined);
    }
    if (withBot.length) this.logger.log(`${withBot.length} ta tenant boti qayta sozlandi`);
  }

  private storeUrl(slug: string): string {
    return `${this.webappUrl}?shop=${encodeURIComponent(slug)}`;
  }

  private buildBot(token: string, slug: string, shopName: string, tenantId: string): Bot {
    const bot = new Bot(token);
    bot.catch((err) => this.logger.error(`Tenant bot error: ${err.error}`));
    const sendShop = async (ctx: Context) => {
      const url = this.storeUrl(slug);
      const text = `👋 Assalomu alaykum!\n\n<b>${shopName}</b> do'koniga xush kelibsiz. Quyidagi tugmadan xaridni boshlang:`;
      if (url.startsWith('https://')) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: "🛍 Do'konni ochish", web_app: { url } }]] },
        });
      } else {
        await ctx.reply(text, { parse_mode: 'HTML' });
      }
    };

    bot.command('start', async (ctx) => {
      // Majburiy obuna — a'zo bo'lmagan kanallar bo'lsa, avval obuna so'raladi.
      const userId = ctx.from?.id;
      if (userId) {
        const missing = await this.forcedSubMissing(tenantId, userId);
        if (missing && missing.length) {
          await ctx.reply(this.forcedSubText(shopName), {
            parse_mode: 'HTML',
            reply_markup: this.forcedSubKeyboard(missing),
          });
          return;
        }
      }
      await sendShop(ctx);
    });

    // Majburiy obuna — "✅ Tekshirish" tugmasi
    bot.callbackQuery('fsub:check', async (ctx) => {
      const userId = ctx.from?.id;
      const missing = userId ? await this.forcedSubMissing(tenantId, userId) : [];
      if (missing && missing.length) {
        await ctx
          .answerCallbackQuery({
            text: "Hali barcha kanallarga a'zo emassiz. A'zo bo'lib, qayta bosing.",
            show_alert: true,
          })
          .catch(() => undefined);
        return;
      }
      await ctx.answerCallbackQuery({ text: '✅ Rahmat!' }).catch(() => undefined);
      await ctx.deleteMessage().catch(() => undefined);
      await sendShop(ctx);
    });

    // To'lov chekini tasdiqlash / rad etish (kanaldagi tugmalar)
    bot.callbackQuery(/^paycfm:(approve|reject):(.+)$/, async (ctx) => {
      const action = ctx.match![1] as 'approve' | 'reject';
      const orderId = ctx.match![2];
      try {
        await this.handlePaymentCallback(tenantId, action, orderId, ctx);
        await ctx.answerCallbackQuery({ text: action === 'approve' ? '✅ Tasdiqlandi' : '❌ Rad etildi' });
      } catch (err) {
        this.logger.error(`Payment callback failed: ${(err as Error).message}`);
        await ctx.answerCallbackQuery({ text: 'Xatolik yuz berdi' }).catch(() => undefined);
      }
    });

    return bot;
  }

  /** Broadcast/bulk yuborish uchun do'kon botini ochib beradi (keshlangan). */
  async getBot(tenantId: string): Promise<Bot | null> {
    return this.loadBot(tenantId);
  }

  private async loadBot(tenantId: string): Promise<Bot | null> {
    const cached = this.bots.get(tenantId);
    if (cached) return cached;
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { botToken: true, slug: true, shopName: true },
    });
    if (!t?.botToken) return null;
    const bot = this.buildBot(t.botToken, t.slug, t.shopName, tenantId);
    await bot.init();
    this.bots.set(tenantId, bot);
    return bot;
  }

  private formatMoney(n: number | string): string {
    return Number(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' so\'m';
  }

  /**
   * Yangi buyurtma kartochkasini DO'KONNING O'Z buyurtmalar kanaliga yuboradi.
   *
   * Ilgari buyurtmalar bitta GLOBAL kanalga tushardi, ya'ni do'konlar
   * bir-birining buyurtmalarini ko'rardi. Endi har do'kon o'z kanalini
   * sozlaydi; sozlanmagan bo'lsa — hech qayerga yuborilmaydi (opt-in).
   *
   * @returns yuborilgan xabar id'si (keyin tahrirlash uchun) yoki null
   */
  async sendOrderToChannel(
    tenantId: string,
    text: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<number | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ordersChannelId: true, botToken: true },
    });
    if (!t?.ordersChannelId) return null; // sozlanmagan — jim qaytamiz

    const picked = await this.pickChannelBot(tenantId, t.ordersChannelId, t.botToken);
    if (!picked) {
      this.logger.warn(`Buyurtma kanali: bot ${tenantId} kanalida admin emas`);
      return null;
    }
    try {
      const msg = await picked.bot.api.sendMessage(
        this.channelChatId(t.ordersChannelId),
        text,
        { parse_mode: 'HTML', reply_markup: replyMarkup },
      );
      return msg.message_id;
    } catch (err) {
      this.logger.warn(`Buyurtma kanaliga yuborilmadi: ${(err as Error).message}`);
      return null;
    }
  }

  /** Do'kon kanalidagi buyurtma kartochkasini yangilaydi (holat o'zgarganda). */
  async editOrderChannelMessage(
    tenantId: string,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<void> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { ordersChannelId: true, botToken: true },
    });
    if (!t?.ordersChannelId) return;
    const picked = await this.pickChannelBot(tenantId, t.ordersChannelId, t.botToken);
    if (!picked) return;
    try {
      await picked.bot.api.editMessageText(
        this.channelChatId(t.ordersChannelId),
        messageId,
        text,
        { parse_mode: 'HTML', reply_markup: replyMarkup },
      );
    } catch {
      // Tahrirlash muhim emas (xabar o'chirilgan yoki o'zgarmagan bo'lishi mumkin).
    }
  }

  /**
   * Mijoz yuklagan to'lov chekini sotuvchining tasdiqlash kanaliga yuboradi.
   * Tugmalar: ✅ Tasdiqlash / ❌ Rad etish.
   * FAQAT global @Vega_uzbot orqali — sotuvchi shu bitta botni admin qilsa yetadi.
   */
  async sendReceiptToChannel(
    tenantId: string,
    photo: Buffer,
    caption: string,
    orderId: string,
  ): Promise<number | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { manualPaymentChannelId: true },
    });
    if (!t?.manualPaymentChannelId) {
      this.logger.warn(`Tenant ${tenantId} uchun to'lov kanali sozlanmagan`);
      return null;
    }
    const bot = this.globalBot.bot;
    if (!bot) return null;
    const keyboard = new InlineKeyboard()
      .text('✅ Tasdiqlash', `paycfm:approve:${orderId}`)
      .text('❌ Rad etish', `paycfm:reject:${orderId}`);
    const msg = await bot.api.sendPhoto(
      t.manualPaymentChannelId,
      new InputFile(photo, 'chek.jpg'),
      { caption, parse_mode: 'HTML', reply_markup: keyboard },
    );
    return msg.message_id;
  }

  /**
   * Mijoz BALANS to'ldirish chekini sotuvchining tasdiqlash kanaliga yuboradi
   * (global @Vega_uzbot orqali). Tugmalar: ✅ Tasdiqlash / ❌ Rad etish.
   */
  async sendBalanceTopupToChannel(
    tenantId: string,
    photo: Buffer,
    caption: string,
    topupId: string,
  ): Promise<number | null> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { manualPaymentChannelId: true },
    });
    if (!t?.manualPaymentChannelId) {
      this.logger.warn(`Tenant ${tenantId} uchun to'lov kanali sozlanmagan`);
      return null;
    }
    const bot = this.globalBot.bot;
    if (!bot) return null;
    const keyboard = new InlineKeyboard()
      .text('✅ Tasdiqlash', `baltop:approve:${topupId}`)
      .text('❌ Rad etish', `baltop:reject:${topupId}`);
    const msg = await bot.api.sendPhoto(
      t.manualPaymentChannelId,
      new InputFile(photo, 'chek.jpg'),
      { caption, parse_mode: 'HTML', reply_markup: keyboard },
    );
    return msg.message_id;
  }

  /**
   * Sotuvchining Telegram kanaliga e'lon joylaydi (matn + ixtiyoriy rasm +
   * ixtiyoriy "Sotib olish" tugmasi → do'kon boti). Bot kanalga admin bo'lishi shart.
   * Joylangan xabarning message_id qaytadi.
   */
  async publishToChannel(
    tenantId: string,
    post: {
      text: string;
      imageUrl?: string | null;
      videoUrl?: string | null;
      buyButton: boolean;
      buttonText?: string | null;
    },
  ): Promise<number> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { channelId: true, botUsername: true, botToken: true },
    });
    if (!t?.channelId) throw new Error('Kanal sozlanmagan');
    // Global Sellio boti yoki do'kon boti — qaysi biri kanalga admin bo'lsa.
    const picked = await this.pickChannelBot(tenantId, t.channelId, t.botToken);
    if (!picked) throw new Error('Bot kanalga admin emas — botni kanalga admin qiling');
    const bot = picked.bot;
    const chatId = this.channelChatId(t.channelId);

    let keyboard: InlineKeyboard | undefined;
    if (post.buyButton && t.botUsername) {
      // "Sotib olish" tugmasi — qaysi bot post qilishidan qat'i nazar, har doim
      // DO'KON botiga olib boradi (mijoz o'sha bot orqali do'konni ochadi).
      keyboard = new InlineKeyboard().url(
        post.buttonText?.trim() || '🛍 Sotib olish',
        `https://t.me/${t.botUsername}`,
      );
    }

    if (post.videoUrl) {
      // Bizning yuklama bo'lsa — faylni to'g'ridan-to'g'ri yuklaymiz (InputFile),
      // shunda 20MB (URL chegarasi) emas, 50MB gacha video ketadi. Tashqi URL bo'lsa — URL.
      const local = this.localUploadPath(post.videoUrl);
      const src = local
        ? new InputFile(local)
        : post.videoUrl.startsWith('http')
          ? post.videoUrl
          : `${this.appUrl}${post.videoUrl}`;
      const msg = await bot.api.sendVideo(chatId, src, {
        caption: post.text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
        supports_streaming: true,
      });
      return msg.message_id;
    }
    if (post.imageUrl) {
      const abs = post.imageUrl.startsWith('http')
        ? post.imageUrl
        : `${this.appUrl}${post.imageUrl}`;
      const msg = await bot.api.sendPhoto(chatId, abs, {
        caption: post.text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      return msg.message_id;
    }
    const msg = await bot.api.sendMessage(chatId, post.text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return msg.message_id;
  }

  /** Telefon raqamining oxirgi 4 raqamini yashiradi (maxfiylik): "+99833988****". */
  private maskPhone(phone: string): string {
    const p = (phone ?? '').trim();
    if (p.length <= 4) return '****';
    return p.slice(0, -4) + '****';
  }

  /** Username'ni yashiradi: @ + birinchi 2 harf + *** (masalan @be***). */
  private maskUsername(username: string): string {
    const u = (username ?? '').replace(/^@/, '').trim();
    if (!u) return '@***';
    return '@' + u.slice(0, 2) + '***';
  }

  /**
   * Sotuv e'loni ("otziv") — har muvaffaqiyatli sotuv reseller'ning ochiq
   * kanaliga chiroyli ijtimoiy isbot sifatida joylanadi. Xato bo'lsa — jim
   * (faqat log): otziv sotuv oqimini hech qachon buzmasin.
   */
  async sendSaleReview(
    tenantId: string,
    review:
      | {
          type: 'NUMBER';
          orderNumber: string;
          price: number | string;
          phone: string;
          serviceName: string;
          serviceEmoji?: string | null;
          countryName: string;
          countryFlag: string;
          buyerUsername?: string | null;
          buyerTelegramId?: bigint | number | null;
        }
      | {
          type: 'DIGITAL';
          kind: 'STARS' | 'PREMIUM' | 'GIFT';
          orderNumber: string;
          price: number | string;
          username: string;
          label: string;
          buyerUsername?: string | null;
          buyerTelegramId?: bigint | number | null;
        },
  ): Promise<void> {
    try {
      const t = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          reviewsChannelId: true,
          reviewsEnabled: true,
          botUsername: true,
          botToken: true,
          shopName: true,
          slug: true,
          totalOrders: true,
        },
      });
      // Otziv o'chirilgan yoki kanal sozlanmagan — jim qaytamiz
      if (!t || !t.reviewsEnabled || !t.reviewsChannelId) return;

      // Otziv FAQAT global Vega boti orqali joylanadi (do'kon boti emas).
      const bot = this.globalBot.bot;
      if (!bot) return; // global bot o'chirilgan — jim qaytamiz
      const chatId = this.channelChatId(t.reviewsChannelId);

      const esc = (s: string) =>
        (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const shop = esc(t.shopName);
      const price = this.formatMoney(review.price); // "12 000 so'm"

      const botHandle = t.botUsername
        ? `@${t.botUsername}`
        : `@${this.globalBotUsername || 'Vega_uzbot'}`;

      let text: string;
      if (review.type === 'NUMBER') {
        const emoji = review.serviceEmoji ? `${review.serviceEmoji} ` : '📱 ';
        text =
          `✅ <b>${botHandle}</b> dan yangi raqam olindi!\n\n` +
          `📞 Nomer: <code>${this.maskPhone(review.phone)}</code>\n` +
          `🌎 Davlat: ${review.countryFlag} <b>${esc(review.countryName)}</b>\n` +
          `${emoji}Xizmat: <b>${esc(review.serviceName)}</b>\n` +
          `💵 Narxi: <b>${price}</b>\n\n` +
          `✅ <b>${botHandle}</b> orqali <b>Tezkor · Arzon · Spamsiz</b> va ` +
          `ishonchli raqamlarni sotib olishingiz mumkin! 🔥\n\n` +
          `📊 Bugungacha <b>${t.totalOrders}</b> ta muvaffaqiyatli sotuv\n` +
          `⚡️ SMS kodi soniyalarda keladi · 24/7\n\n` +
          `🛍 <b>${shop}</b>`;
      } else {
        const kindEmoji =
          review.kind === 'STARS' ? '⭐' : review.kind === 'GIFT' ? '🎁' : '👑';
        const kindWord =
          review.kind === 'STARS'
            ? 'Telegram Stars'
            : review.kind === 'GIFT'
              ? "Telegram sovg'asi"
              : 'Telegram Premium';
        text =
          `✅ <b>${botHandle}</b> dan yangi ${kindEmoji} <b>${esc(review.label)}</b> olindi!\n\n` +
          `👤 Xaridor: ${this.maskUsername(review.username)}\n` +
          `💵 Narxi: <b>${price}</b>\n\n` +
          `✅ <b>${botHandle}</b> orqali <b>${kindWord}</b> — tez, arzon va ` +
          `ishonchli! 🔥\n\n` +
          `📊 Bugungacha <b>${t.totalOrders}</b> ta muvaffaqiyatli sotuv\n` +
          `⚡️ Bir necha soniyada yetkaziladi · 24/7\n\n` +
          `🛍 <b>${shop}</b>`;
      }

      // Tugmalar: "Raqam egasi/Xaridor" (xaridor profili) + "Sotib olish" (do'kon boti)
      const buyUrl = t.botUsername
        ? `https://t.me/${t.botUsername}`
        : `https://t.me/${this.globalBotUsername || 'Vega_uzbot'}?start=shop_${t.slug}`;
      const buyerUrl = review.buyerUsername
        ? `https://t.me/${review.buyerUsername.replace(/^@/, '')}`
        : review.buyerTelegramId
          ? `tg://user?id=${review.buyerTelegramId}`
          : null;
      const keyboard = new InlineKeyboard();
      if (buyerUrl) {
        keyboard
          .url(review.type === 'NUMBER' ? '👤 Raqam egasi' : '👤 Xaridor', buyerUrl)
          .row();
      }
      keyboard.url('🚀 Bizning botimiz', buyUrl);

      await bot.api.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      this.logger.warn(
        `Sotuv e'loni yuborilmadi (tenant ${tenantId}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Sotuvchi ulagan kanal haqida jonli ma'lumot oladi: nomi, @username, turi,
   * obunachilar soni va (mavjud bo'lsa) kanal rasmi. Bot kanalga admin qilingan
   * bo'lishi kerak — aks holda `connected: false` va sabab qaytadi.
   */
  async getChannelInfo(tenantId: string): Promise<ChannelInfo> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { botToken: true, channelId: true, botUsername: true },
    });
    if (!t) return { connected: false, reason: "Do'kon topilmadi" };
    if (!t.channelId) return { connected: false, reason: 'Avval kanal ID ni kiriting' };

    const picked = await this.pickChannelBot(tenantId, t.channelId, t.botToken);
    if (!picked) {
      const adminRef = this.globalBotUsername ? `@${this.globalBotUsername}` : 'Vega bot';
      const own = t.botUsername ? ` (yoki do'kon botingiz @${t.botUsername})` : '';
      return {
        connected: false,
        reason: `Kanalni ko'rib bo'lmadi. ${adminRef} botini${own} kanalga ADMIN qiling va qayta urinib ko'ring.`,
      };
    }
    const { bot, token } = picked;
    const chatId = this.channelChatId(t.channelId);

    let chat;
    try {
      chat = await bot.api.getChat(chatId);
    } catch {
      return { connected: false, reason: "Kanalni ko'rib bo'lmadi. Botni kanalga ADMIN qiling." };
    }

    // Obunachilar soni — kanalda faqat admin bot o'qiy oladi
    let subscriberCount: number | null = null;
    let isAdmin = false;
    try {
      subscriberCount = await bot.api.getChatMemberCount(chatId);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    // Kanal rasmi (ixtiyoriy) — bot orqali yuklab, data URL qilamiz (token oshkor emas)
    let photoDataUrl: string | null = null;
    const fileId = chat.photo?.big_file_id ?? chat.photo?.small_file_id;
    if (fileId) {
      try {
        const file = await bot.api.getFile(fileId);
        if (file.file_path) {
          const res = await fetch(
            `https://api.telegram.org/file/bot${token}/${file.file_path}`,
          );
          if (res.ok) {
            const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
            const mime = file.file_path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
            photoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      } catch {
        // rasm yuklab bo'lmadi — muhim emas
      }
    }

    return {
      connected: true,
      id: String(chat.id),
      title: chat.title ?? '',
      username: chat.username ?? null,
      type: chat.type,
      description: chat.description ?? null,
      subscriberCount,
      isAdmin,
      photoDataUrl,
    };
  }

  /**
   * Otziv kanali jonli ma'lumoti (rasm, obunachilar, nomi) — FAQAT global
   * @Vega_uzbot orqali (reviewsChannelId). Bot admin bo'lmasa connected:false.
   */
  async getReviewChannelInfo(tenantId: string): Promise<ChannelInfo> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { reviewsChannelId: true },
    });
    if (!t) return { connected: false, reason: "Do'kon topilmadi" };
    if (!t.reviewsChannelId) {
      return { connected: false, reason: 'Avval kanal ID ni kiriting' };
    }

    const bot = this.globalBot.bot;
    const token = this.globalBotToken;
    if (!bot || !token) {
      return { connected: false, reason: 'Vega bot sozlanmagan' };
    }
    const ref = this.globalBotUsername ? `@${this.globalBotUsername}` : '@Vega_uzbot';
    const chatId = this.channelChatId(t.reviewsChannelId);

    let chat;
    try {
      chat = await bot.api.getChat(chatId);
    } catch {
      return {
        connected: false,
        reason: `Kanalni ko'rib bo'lmadi. ${ref} botini kanalga ADMIN qiling.`,
      };
    }

    let subscriberCount: number | null = null;
    let isAdmin = false;
    try {
      subscriberCount = await bot.api.getChatMemberCount(chatId);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    let photoDataUrl: string | null = null;
    const fileId = chat.photo?.big_file_id ?? chat.photo?.small_file_id;
    if (fileId) {
      try {
        const file = await bot.api.getFile(fileId);
        if (file.file_path) {
          const res = await fetch(
            `https://api.telegram.org/file/bot${token}/${file.file_path}`,
          );
          if (res.ok) {
            const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
            const mime = file.file_path.toLowerCase().endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';
            photoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      } catch {
        // rasm yuklab bo'lmadi — muhim emas
      }
    }

    return {
      connected: true,
      id: String(chat.id),
      title: chat.title ?? '',
      username: chat.username ?? null,
      type: chat.type,
      description: chat.description ?? null,
      subscriberCount,
      isAdmin,
      photoDataUrl,
    };
  }

  /**
   * To'lov tasdiqlash kanali ma'lumoti (rasm, obunachilar) — FAQAT global
   * @Vega_uzbot orqali (manualPaymentChannelId). Bot admin bo'lmasa connected:false.
   */
  async getPaymentChannelInfo(tenantId: string): Promise<ChannelInfo> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { manualPaymentChannelId: true },
    });
    if (!t) return { connected: false, reason: "Do'kon topilmadi" };
    if (!t.manualPaymentChannelId) {
      return { connected: false, reason: 'Avval kanal ID ni kiriting' };
    }

    const bot = this.globalBot.bot;
    const token = this.globalBotToken;
    if (!bot || !token) {
      return { connected: false, reason: 'Vega bot sozlanmagan' };
    }
    const ref = this.globalBotUsername ? `@${this.globalBotUsername}` : '@Vega_uzbot';
    const chatId = this.channelChatId(t.manualPaymentChannelId);

    let chat;
    try {
      chat = await bot.api.getChat(chatId);
    } catch {
      return {
        connected: false,
        reason: `Kanalni ko'rib bo'lmadi. ${ref} botini kanalga ADMIN qiling.`,
      };
    }

    let subscriberCount: number | null = null;
    let isAdmin = false;
    try {
      subscriberCount = await bot.api.getChatMemberCount(chatId);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    let photoDataUrl: string | null = null;
    const fileId = chat.photo?.big_file_id ?? chat.photo?.small_file_id;
    if (fileId) {
      try {
        const file = await bot.api.getFile(fileId);
        if (file.file_path) {
          const res = await fetch(
            `https://api.telegram.org/file/bot${token}/${file.file_path}`,
          );
          if (res.ok) {
            const buf = Buffer.from(new Uint8Array(await res.arrayBuffer()));
            const mime = file.file_path.toLowerCase().endsWith('.png')
              ? 'image/png'
              : 'image/jpeg';
            photoDataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      } catch {
        // rasm yuklab bo'lmadi — muhim emas
      }
    }

    return {
      connected: true,
      id: String(chat.id),
      title: chat.title ?? '',
      username: chat.username ?? null,
      type: chat.type,
      description: chat.description ?? null,
      subscriberCount,
      isAdmin,
      photoDataUrl,
    };
  }

  /** Kanaldagi e'lonni o'chiradi (post o'chirilganda). Xato bo'lsa — e'tiborsiz. */
  async deleteChannelMessage(tenantId: string, messageId: number): Promise<void> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { channelId: true, botToken: true },
    });
    if (!t?.channelId) return;
    const picked = await this.pickChannelBot(tenantId, t.channelId, t.botToken);
    if (!picked) return;
    await picked.bot.api
      .deleteMessage(this.channelChatId(t.channelId), messageId)
      .catch(() => undefined);
  }

  /** Kanaldagi tasdiqlash/rad tugmasi bosilganda raqam-buyurtma to'lovini hal qiladi. */
  /** Global @Vega_uzbot callback'i uchun: orderId'dan tenant'ni topib ishlaydi. */
  async handlePaymentCallbackByOrder(
    action: 'approve' | 'reject',
    orderId: string,
    ctx: Context,
  ): Promise<void> {
    const o = await this.prisma.numberOrder.findUnique({
      where: { id: orderId },
      select: { tenantId: true },
    });
    if (!o) return;
    await this.handlePaymentCallback(o.tenantId, action, orderId, ctx);
  }

  /** Mijoz BALANS to'ldirishni tasdiqlash/rad — kanaldagi tugma (global bot). */
  async handleBalanceTopupCallback(
    action: 'approve' | 'reject',
    topupId: string,
    ctx: Context,
  ): Promise<void> {
    this.logger.log(`baltop ${action} ${topupId}`);
    const topup = await this.prisma.balanceTopup.findUnique({
      where: { id: topupId },
    });
    // Ilgari bu yerda jimgina `return` bor edi: egasi tugmani bosardi,
    // "Tekshirilmoqda…" yozuvi qotib qolardi va sabab hech qayerda
    // ko'rinmasdi (logda ham). Endi sababni aytamiz.
    if (!topup || topup.status !== 'PENDING') {
      const why = !topup
        ? "So'rov topilmadi (eski xabar bo'lishi mumkin)"
        : `So'rov allaqachon ko'rib chiqilgan: ${topup.status}`;
      this.logger.warn(`baltop ${topupId}: ${why}`);
      await ctx
        .answerCallbackQuery({ text: `⚠️ ${why}`, show_alert: true })
        .catch(() => undefined);
      return;
    }
    const amount = Number(topup.amount);

    let ok = false;
    let errMsg = '';

    if (action === 'approve') {
      try {
        // Atomik: reseller ulgurji hamyoni yetarlimi -> yechish + ledger,
        // so'ng mijoz balansi += amount. Yetmasa — tasdiqlab bo'lmaydi.
        const user = await this.prisma.$transaction(async (tx) => {
          const t = await tx.tenant.findUnique({
            where: { id: topup.tenantId },
            select: { walletBalance: true },
          });
          const walletBal = Number(t?.walletBalance ?? 0);
          if (walletBal < amount) {
            throw new Error(
              `Hamyoningizda mablag' yetarli emas: ${this.formatMoney(walletBal)} < ${this.formatMoney(amount)}. Avval ulgurji hamyonni to'ldiring.`,
            );
          }
          const upd = await tx.tenant.update({
            where: { id: topup.tenantId },
            data: { walletBalance: { decrement: amount } },
            select: { walletBalance: true },
          });
          await tx.walletTransaction.create({
            data: {
              tenantId: topup.tenantId,
              type: WalletTxType.PURCHASE,
              amount: -amount,
              balanceAfter: upd.walletBalance,
              note: "Mijoz balansiga o'tkazma",
              receiptUrl: topup.receiptUrl, // mijoz yuklagan chek
            },
          });
          await tx.balanceTopup.update({
            where: { id: topupId },
            data: { status: 'APPROVED' },
          });
          return tx.user.update({
            where: { id: topup.userId },
            data: { balance: { increment: amount } },
          });
        });
        ok = true;
        const bot = await this.loadBot(topup.tenantId);
        if (bot && user.telegramId) {
          await bot.api
            .sendMessage(
              Number(user.telegramId),
              `✅ <b>Balansingiz to'ldirildi!</b>\n\n💰 +${this.formatMoney(amount)}\n💼 Yangi balans: <b>${this.formatMoney(Number(user.balance))}</b>`,
              { parse_mode: 'HTML' },
            )
            .catch(() => undefined);
        }
      } catch (e) {
        errMsg = (e as Error).message;
      }
    } else {
      await this.prisma.balanceTopup.update({
        where: { id: topupId },
        data: { status: 'REJECTED' },
      });
      ok = true;
      const user = await this.prisma.user.findUnique({
        where: { id: topup.userId },
        select: { telegramId: true },
      });
      const bot = await this.loadBot(topup.tenantId);
      if (bot && user?.telegramId) {
        await bot.api
          .sendMessage(
            Number(user.telegramId),
            `❌ <b>To'ldirish tasdiqlanmadi.</b>\n\n${this.formatMoney(amount)} — chek tasdiqlanmadi. Iltimos, to'lovni tekshiring yoki qayta yuboring.`,
            { parse_mode: 'HTML' },
          )
          .catch(() => undefined);
      }
    }

    try {
      const by = ctx.from?.username
        ? `@${ctx.from.username}`
        : (ctx.from?.first_name ?? '');
      const cap = ctx.callbackQuery?.message?.caption ?? '';
      if (ok) {
        const label =
          action === 'approve' ? "✅ TO'LDIRISH TASDIQLANDI" : '❌ RAD ETILDI';
        await ctx.editMessageCaption({
          caption: `${cap}\n\n<b>${label}</b>${by ? ` — ${by}` : ''}`,
          parse_mode: 'HTML',
        });
        await ctx.editMessageReplyMarkup().catch(() => undefined);
      } else {
        // Hamyon yetmadi — tugmalar qoladi, hamyon to'ldirilgach qayta bosiladi
        await ctx.editMessageCaption({
          caption: `${cap}\n\n⚠️ <b>${errMsg || 'Xatolik'}</b>`,
          parse_mode: 'HTML',
        });
      }
    } catch {
      // tahrirlash muhim emas
    }
  }

  private async handlePaymentCallback(
    tenantId: string,
    action: 'approve' | 'reject',
    orderId: string,
    ctx: Context,
  ): Promise<void> {
    const order = await this.prisma.numberOrder.findUnique({
      where: { id: orderId },
      include: { user: true, service: true, country: true },
    });
    if (!order || order.tenantId !== tenantId) return;
    if (order.paidAt) return; // chek allaqachon tasdiqlangan — qayta ishlamaymiz

    const bot = await this.loadBot(tenantId);
    const priceN = Number(order.retailPrice);

    if (action === 'approve') {
      const now = new Date();
      await this.prisma.numberOrder.update({
        where: { id: orderId },
        data: {
          paidAt: now,
          events: { create: { status: order.status, comment: "To'lov cheki tasdiqlandi" } },
        },
      });
      // Admin paneli + foydalanuvchi WebApp real-time
      // tenantId SHART: admin socket'i hodisani faqat SHU do'kon xonasiga
      // yuboradi (aks holda boshqa do'kon egalari ham ko'rib qolardi).
      this.events.emit('order.status_changed', {
        orderId,
        status: order.status,
        tenantId,
      });
      this.events.emit('user.order.status_changed', {
        userId: order.userId,
        orderId,
        status: order.status,
        orderNumber: order.orderNumber,
      });
      // Mijozga xabar (sotuvchining boti orqali)
      if (bot && order.user.telegramId) {
        const msg =
          `✅ <b>To'lovingiz tasdiqlandi!</b>\n\n` +
          `Buyurtma <b>#${order.orderNumber}</b> (${this.formatMoney(priceN)}) qabul qilindi.\n` +
          `${order.service.emoji ? `${order.service.emoji} ` : ''}${order.service.nameUz} — ${order.country.flag} ${order.country.nameUz}\n` +
          `Raqam: <b>${order.phone}</b>\n\nSMS kodi kelishi bilan yuboramiz.`;
        await bot.api
          .sendMessage(Number(order.user.telegramId), msg, { parse_mode: 'HTML' })
          .catch(() => undefined);
      }
    } else {
      // Rad etildi — mijoz chekni qayta yuklashi mumkin
      await this.prisma.numberOrder.update({
        where: { id: orderId },
        data: {
          events: { create: { status: order.status, comment: "To'lov cheki rad etildi" } },
        },
      });
      if (bot && order.user.telegramId) {
        await bot.api
          .sendMessage(
            Number(order.user.telegramId),
            `❌ <b>To'lov tasdiqlanmadi.</b>\n\nBuyurtma <b>#${order.orderNumber}</b> uchun to'lov chekini qayta yuklang yoki sotuvchi bilan bog'laning.`,
            { parse_mode: 'HTML' },
          )
          .catch(() => undefined);
      }
    }

    // Kanaldagi xabarni belgilash
    try {
      const label = action === 'approve' ? "✅ TO'LOV TASDIQLANDI" : '❌ RAD ETILDI';
      const by = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name ?? '';
      const cap = ctx.callbackQuery?.message?.caption ?? '';
      await ctx.editMessageCaption({
        caption: `${cap}\n\n<b>${label}</b>${by ? ` — ${by}` : ''}`,
        parse_mode: 'HTML',
      });
    } catch {
      // tahrirlash muhim emas
    }
  }

  /**
   * Mijozga (customer) shu do'konning o'z Telegram boti orqali xabar yuboradi.
   * Mijoz do'konni shu bot orqali ochgani uchun bot unga yoza oladi.
   *
   * Tenant yo'q / bot ulanmagan (token yo'q) / yuborish muvaffaqiyatsiz bo'lsa
   * `false` qaytaradi — chaqiruvchi global (Sellio) botga fallback qilishi mumkin.
   * Shunda single-tenant / global rejim ham ishlashda davom etadi.
   */
  async sendToCustomer(
    tenantId: string | null | undefined,
    telegramId: bigint | number,
    text: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<boolean> {
    if (!tenantId) return false;
    const bot = await this.loadBot(tenantId);
    if (!bot) return false;
    try {
      await bot.api.sendMessage(Number(telegramId), text, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        reply_markup: replyMarkup,
      });
      return true;
    } catch (err) {
      this.logger.warn(
        `Mijozga do'kon boti orqali xabar yuborilmadi (tenant ${tenantId}): ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Keshdagi bot instansiyasini unutadi (token o'zgargan/o'chirilganda). */
  forget(tenantId: string): void {
    this.bots.delete(tenantId);
  }

  /**
   * Berilgan token uchun Telegram webhook'ini o'chiradi.
   * Token o'zgarganda eski bot bizga update yubormasligi uchun ishlatiladi.
   * Xato bo'lsa (eski token allaqachon o'chirilgan/yaroqsiz) — log qilamiz,
   * exception qaytarmaymiz.
   */
  async deleteWebhookForToken(token: string): Promise<void> {
    if (!token) return;
    try {
      const bot = new Bot(token);
      await bot.api.deleteWebhook({ drop_pending_updates: true });
      this.logger.log(`Old webhook deleted for token ${token.slice(0, 10)}…`);
    } catch (err) {
      this.logger.warn(`Old webhook delete failed: ${(err as Error).message}`);
    }
  }

  /** Webhook'dan kelgan update'ni shu tenant boti bilan ishlaydi. */
  async handleUpdate(tenantId: string, update: unknown): Promise<void> {
    const bot = await this.loadBot(tenantId);
    if (!bot) {
      this.logger.warn(`No bot for tenant ${tenantId}`);
      return;
    }
    await bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
  }

  /** Sotuvchi botiga webhook + menu tugma o'rnatadi (token ulanganda chaqiriladi). */
  async configure(tenantId: string): Promise<void> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { botToken: true, slug: true },
    });
    if (!t?.botToken) return;
    this.bots.delete(tenantId); // keshni yangilaymiz
    const bot = new Bot(t.botToken);
    const webhookUrl = `${this.appUrl}/telegram/t/${tenantId}/webhook`;
    try {
      await bot.api.setWebhook(webhookUrl, {
        secret_token: this.secret,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false,
      });
      const url = this.storeUrl(t.slug);
      if (url.startsWith('https://')) {
        await bot.api
          .setChatMenuButton({ menu_button: { type: 'web_app', text: "🛍 Do'kon", web_app: { url } } })
          .catch(() => undefined);
      }
      this.logger.log(`Tenant ${tenantId} bot webhook set: ${webhookUrl}`);
    } catch (err) {
      this.logger.error(`Tenant ${tenantId} webhook set failed: ${(err as Error).message}`);
    }
  }
}
