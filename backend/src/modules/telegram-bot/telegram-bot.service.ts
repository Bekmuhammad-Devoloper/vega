import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRole } from '@prisma/client';
import { Bot, type Context, InlineKeyboard, InputFile, webhookCallback } from 'grammy';
import { PrismaService } from '@/prisma/prisma.service';
import { ReferralService } from '../referral/referral.service';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  /**
   * Global "platform" boti. TELEGRAM_BOT_TOKEN berilmasa `undefined` bo'ladi
   * va xizmat "o'chirilgan" rejimda ishlaydi — backend crash bo'lmaydi.
   * (Ko'p-tenantli rejimda har sotuvchi o'z botini ishlatadi — TenantBotService.)
   */
  readonly bot?: Bot;
  private readonly useWebhook: boolean;
  private readonly adminPanelUrl: string;
  private readonly ordersChannelId: string;
  private readonly paymentsChatId: string;
  private readonly walletTopupChatId: string;
  private readonly botUsername: string;

  /** Global bot sozlanganmi (token bor). */
  get enabled(): boolean {
    return this.bot !== undefined;
  }

  constructor(
    private readonly config: ConfigService,
    private readonly referral: ReferralService,
    private readonly prisma: PrismaService,
  ) {
    const token = (this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
    this.useWebhook = this.config.get('TELEGRAM_USE_WEBHOOK') === 'true';
    this.adminPanelUrl =
      (this.config.get<string>('ADMIN_PANEL_URL') || '').trim() ||
      `${(this.config.get<string>('ADMIN_URL') ?? '').replace(/\/$/, '')}/register`;
    // Token bo'lmasa, getOrThrow ishlatmaymiz — aks holda butun backend yiqiladi.
    this.ordersChannelId = this.config.get<string>('TELEGRAM_ORDERS_CHANNEL_ID') ?? '';
    this.paymentsChatId =
      this.config.get<string>('TELEGRAM_PAYMENTS_CHAT_ID') || this.ordersChannelId;
    // Hamyon to'ldirish cheklari shu kanalga (admin bot a'zo bo'lgan) boradi.
    this.walletTopupChatId =
      this.config.get<string>('TELEGRAM_TOPUP_CHAT_ID') ||
      this.paymentsChatId ||
      '-1004482182765';
    this.botUsername = this.config.get<string>('TELEGRAM_BOT_USERNAME') ?? '';

    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN yo\'q — global platforma boti O\'CHIRILGAN. ' +
          'Sotuvchilar o\'z botlarini admin panelidan ulaydi (per-tenant bot).',
      );
      return;
    }

    this.bot = new Bot(token);
    this.registerHandlers();
  }

  async onModuleInit(): Promise<void> {
    const bot = this.bot;
    if (!bot) return; // global bot o'chirilgan (token yo'q)
    try {
      // Webhook rejimida bot.init() majburiy — bot.handleUpdate uni talab qiladi.
      // Polling rejimida bot.start() avtomatik chaqiradi, lekin biz xohlamaymiz duplicate.
      if (this.useWebhook) {
        await bot.init();
        const me = bot.botInfo;
        this.logger.log(`Bot @${me.username} initialized (id=${me.id})`);
        await this.ensureWebhook();
      } else {
        const me = await bot.api.getMe();
        this.logger.log(`Bot @${me.username} connected (id=${me.id})`);
        await bot.api.deleteWebhook({ drop_pending_updates: false }).catch(() => undefined);
        void bot.start({
          onStart: (info) => this.logger.log(`Polling started as @${info.username}`),
        });
      }
      // Menu commands va chat menu button — har safar startda yangilanadi (idempotent)
      await this.setupBotMenu();
    } catch (err) {
      this.logger.error(`Bot init failed: ${(err as Error).message}`);
    }
  }

  /** Bot komandalar ro'yxati va chat pastidagi doimiy "Menu" tugmasini o'rnatadi. */
  private async setupBotMenu(): Promise<void> {
    const bot = this.bot;
    if (!bot) return;
    try {
      await bot.api.setMyCommands([
        { command: 'start', description: "Do'konni ochish / Открыть магазин" },
        { command: 'admin', description: 'Admin panel' },
        { command: 'creator', description: 'Creator paneli (jamoa a\'zosi)' },
        { command: 'moderator', description: 'Moderator paneli (jamoa a\'zosi)' },
        { command: 'id', description: "Telegram ID (jamoaga qo'shilish uchun)" },
        { command: 'help', description: 'Yordam / Помощь' },
      ]);
      this.logger.log('Bot commands ro\'yxati o\'rnatildi');

      const adminUrl = this.adminPanelUrl;
      if (adminUrl.startsWith('https://')) {
        await bot.api.setChatMenuButton({
          menu_button: {
            type: 'web_app',
            text: '⚡ Mening do\'konim',
            web_app: { url: adminUrl },
          },
        });
        this.logger.log(`Chat menu button o'rnatildi → ${adminUrl}`);
      }
    } catch (err) {
      this.logger.warn(`Bot menu setup failed: ${(err as Error).message}`);
    }
  }

  private async ensureWebhook(): Promise<void> {
    const bot = this.bot;
    if (!bot) return;
    const appUrl = this.config.get<string>('APP_URL') ?? '';
    if (!appUrl.startsWith('https://')) {
      this.logger.warn(`APP_URL HTTPS emas — webhook o'rnatilmadi: ${appUrl}`);
      return;
    }
    const webhookUrl = `${appUrl.replace(/\/$/, '')}/telegram/webhook`;
    const secret = this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');

    try {
      const info = await bot.api.getWebhookInfo();
      if (info.url !== webhookUrl) {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: secret,
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        });
        this.logger.log(`Webhook o'rnatildi: ${webhookUrl}`);
      } else {
        this.logger.log(`Webhook allaqachon to'g'ri: ${webhookUrl}`);
      }
    } catch (err) {
      this.logger.error(`Webhook setup error: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot && !this.useWebhook) {
      await this.bot.stop().catch(() => undefined);
    }
  }

  private registerHandlers(): void {
    if (!this.bot) return;
    // Universal error catcher — handler ichida xato bo'lsa loglarda ko'rinadi
    this.bot.catch((err) => {
      this.logger.error(`Bot handler error: ${err.error}`);
    });

    this.bot.command('start', async (ctx) => {
      // Referal deep-link: /start ref<KOD> → admin Mini App URL'iga ?ref=<KOD> qo'shamiz
      const payload = (ctx.match ?? '').toString().trim();
      const ref = payload.startsWith('ref') ? payload.slice(3) : '';
      // Referalни server tomonда (Telegram ID bo'yicha) saqlaymiz — URL ?ref= yo'qolsa ham ishlaydi
      if (ref && ctx.from?.id) {
        void this.referral.rememberPending(ctx.from.id, ref);
      }
      let url = this.adminPanelUrl;
      if (ref && url.startsWith('https://')) {
        url += (url.includes('?') ? '&' : '?') + 'ref=' + encodeURIComponent(ref);
      }
      this.logger.log(`/start from user ${ctx.from?.id} (@${ctx.from?.username ?? '-'})${ref ? ` ref=${ref}` : ''} → Admin URL: ${url}`);
      const text = `👋 Assalomu alaykum, ${ctx.from?.first_name ?? 'mehmon'}!\n\nVega'ga xush kelibsiz — Telegram raqam, Stars va Premium sotuvchi o'z do'koningizni oching. Quyidagi tugmadan boshlang:`;
      const isHttps = url.startsWith('https://');
      try {
        if (isHttps) {
          await ctx.reply(text, {
            reply_markup: {
              inline_keyboard: [[{ text: '🚀 Boshlash', web_app: { url } }]],
            },
          });
        } else {
          await ctx.reply(text + `\n\n${url}`, {
            reply_markup: {
              inline_keyboard: [[{ text: '🚀 Boshlash', url }]],
            },
          });
        }
        this.logger.log(`/start reply sent to ${ctx.from?.id}`);
      } catch (err) {
        this.logger.error(`/start reply failed for ${ctx.from?.id}: ${(err as Error).message}`);
        throw err;
      }
    });

    // Xodimni do'kon jamoasiga qo'shish uchun kerak bo'ladigan Telegram ID
    this.bot.command('id', async (ctx) => {
      const id = ctx.from?.id;
      await ctx.reply(
        `🆔 Sizning Telegram ID: <code>${id}</code>\n\n` +
          'Do\'kon egasi sizni jamoaga qo\'shishi uchun shu raqamni unga yuboring.',
        { parse_mode: 'HTML' },
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'Yordam kerakmi?\n\n• Do\'konni ochish uchun /start\n• Admin panel uchun /admin\n• Buyurtma berishda muammo bo\'lsa, support orqali yozing.',
      );
    });

    this.bot.command('admin', async (ctx) => {
      const adminUrl = this.adminPanelUrl;
      this.logger.log(`/admin from user ${ctx.from?.id} (@${ctx.from?.username ?? '-'}) → ${adminUrl}`);
      const text =
        '🔐 <b>Admin panel</b>\n\n' +
        'Quyidagi tugmadan admin panelni oching va login/parolingiz bilan kiring.\n\n' +
        '⚠️ Faqat tasdiqlangan administratorlar uchun.';
      try {
        if (adminUrl.startsWith('https://')) {
          // Faqat web_app tugma — admin panel Telegram ichida ochiladi.
          await ctx.reply(text, {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔐 Admin panelni ochish', web_app: { url: adminUrl } }],
              ],
            },
          });
        } else {
          await ctx.reply(text + `\n\n${adminUrl}`, { parse_mode: 'HTML' });
        }
      } catch (err) {
        this.logger.error(`/admin reply failed: ${(err as Error).message}`);
      }
    });

    // Jamoa a'zolari uchun qulay kirish: /creator va /moderator.
    // Foydalanuvchi shu roldagi do'kon(lar)да bo'lsa va tarif faol bo'lsa — panel ochiladi.
    this.bot.command('creator', (ctx) => this.handleRoleCommand(ctx, AdminRole.MANAGER, 'creator'));
    this.bot.command('moderator', (ctx) => this.handleRoleCommand(ctx, AdminRole.MODERATOR, 'moderator'));

    this.bot.callbackQuery(/^order:(.+?):(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (!match) return;
      const action = match[1];
      const orderId = match[2];
      this.callbackEmitter?.emit('callback', { action, orderId, ctx });
      await ctx.answerCallbackQuery({ text: '✓' });
    });

    // To'lovni tasdiqlash / bekor qilish tugmalari
    this.bot.callbackQuery(/^pay:(approve|reject):(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (!match) return;
      const action = match[1];
      const tenantId = match[2];
      this.callbackEmitter?.emit('payment-callback', { action, tenantId, ctx });
      await ctx.answerCallbackQuery({ text: action === 'approve' ? '✅' : '❌' });
    });

    // Hamyon to'ldirishni tasdiqlash / rad etish tugmalari (invoice bo'yicha)
    this.bot.callbackQuery(/^topup:(approve|reject):(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (!match) return;
      const action = match[1];
      const invoiceId = match[2];
      this.callbackEmitter?.emit('topup-callback', { action, invoiceId, ctx });
      await ctx.answerCallbackQuery({ text: action === 'approve' ? '✅' : '❌' });
    });

    // Mijoz to'lov chekini tasdiqlash / rad etish (sotuvchi kanalidagi tugmalar)
    this.bot.callbackQuery(/^paycfm:(approve|reject):(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (!match) return;
      const action = match[1];
      const orderId = match[2];
      this.callbackEmitter?.emit('paycfm-callback', { action, orderId, ctx });
      await ctx.answerCallbackQuery({
        text: action === 'approve' ? '✅ Tasdiqlandi' : '❌ Rad etildi',
      });
    });

    // Mijoz BALANS to'ldirishni tasdiqlash / rad etish (sotuvchi kanalidagi tugmalar)
    this.bot.callbackQuery(/^baltop:(approve|reject):(.+)$/, async (ctx) => {
      const match = ctx.match;
      if (!match) return;
      const action = match[1];
      const topupId = match[2];
      this.callbackEmitter?.emit('baltop-callback', { action, topupId, ctx });
      await ctx.answerCallbackQuery({
        text: action === 'approve' ? '✅ Tasdiqlandi' : '❌ Rad etildi',
      });
    });
  }

  private callbackEmitter?: { emit: (event: string, data: unknown) => void };
  setCallbackEmitter(emitter: { emit: (event: string, data: unknown) => void }): void {
    this.callbackEmitter = emitter;
  }

  /**
   * /creator yoki /moderator — jamoa a'zosini panelга yo'naltiradi.
   * - Shu roldagi do'konda umuman yo'q bo'lsa → qanday qo'shilishni tushuntiradi.
   * - Bor, lekin barcha do'konlari tarifi faol bo'lmasa → "tarif faol emas" xabari.
   * - Tarifi faol do'koni bo'lsa → panelni ochish tugmasi (Telegram ID bo'yicha avto-login).
   */
  private async handleRoleCommand(ctx: Context, role: AdminRole, label: string): Promise<void> {
    const tgId = ctx.from?.id;
    if (!tgId) return;
    try {
      const rows = await this.prisma.admin.findMany({
        where: { telegramId: BigInt(tgId), isActive: true, role, tenantId: { not: null } },
        select: {
          tenant: {
            select: {
              shopName: true,
              status: true,
              tariffPlan: true,
            },
          },
        },
      });
      if (rows.length === 0) {
        await ctx.reply(
          `ℹ️ Siz hech qaysi do'konда <b>${label}</b> sifatida qo'shilmagansiz.\n\n` +
            `Do'kon egasi sizni jamoaga qo'shishi kerak — Telegram ID'ingizni olish uchun /id buyrug'ini bosing.`,
          { parse_mode: 'HTML' },
        );
        return;
      }
      // Bir martalik faollashtirish modeli: do'kon faol = status ACTIVE.
      const active = rows.filter((r) => r.tenant && r.tenant.status === 'ACTIVE');
      if (active.length === 0) {
        await ctx.reply(
          `❌ Do'kon tarifi faol emas.\n\n` +
            `Egasi tarifni yangilagach, <b>${label}</b> funksiyalaridan foydalana olasiz.`,
          { parse_mode: 'HTML' },
        );
        return;
      }
      const base = this.adminPanelUrl;
      // Panel shu rejimda ochiladi → switcher faqat shu roldagi do'konlarni ko'rsatadi
      // va creator faqat mahsulot+kategoriya bilan cheklanadi.
      const url = base + (base.includes('?') ? '&' : '?') + 'mode=' + label;
      const shops = active.map((r) => r.tenant!.shopName).join(', ');
      const text =
        `✅ Xush kelibsiz! Siz <b>${shops}</b> do'koni(lar)да <b>${label}</b>siz.\n\n` +
        `Quyidagi tugmadan panelni oching:`;
      if (url.startsWith('https://')) {
        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [[{ text: '🎛 Panelni ochish', web_app: { url } }]] },
        });
      } else {
        await ctx.reply(text + `\n\n${url}`, { parse_mode: 'HTML' });
      }
    } catch (err) {
      this.logger.error(`/${label} command failed: ${(err as Error).message}`);
    }
  }

  webhookHandler() {
    if (!this.bot) {
      // Bot o'chirilgan — webhook kelса 200 qaytaramiz (Telegram qayta urinmasin)
      return (_req: unknown, res: { sendStatus: (n: number) => void }) => res.sendStatus(200);
    }
    return webhookCallback(this.bot, 'express');
  }

  /** To'lov chekini (rasm) tasdiqlash chatiga tugmalar bilan yuboradi. */
  async sendPaymentReceipt(
    photo: Buffer,
    caption: string,
    tenantId: string,
  ): Promise<{ messageId: number }> {
    if (!this.bot || !this.paymentsChatId) {
      this.logger.warn('Global bot/chat yo\'q — to\'lov cheki yuborilmadi');
      return { messageId: 0 };
    }
    const keyboard = new InlineKeyboard()
      .text('✅ Tasdiqlash', `pay:approve:${tenantId}`)
      .text('❌ Bekor qilish', `pay:reject:${tenantId}`);
    const msg = await this.bot.api.sendPhoto(this.paymentsChatId, new InputFile(photo, 'chek.jpg'), {
      caption,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
    return { messageId: msg.message_id };
  }

  /** Hamyon to'ldirish chekini (rasm) tasdiqlash kanaliga tugmalar bilan yuboradi. */
  async sendWalletTopupReceipt(
    photo: Buffer,
    caption: string,
    invoiceId: string,
  ): Promise<{ messageId: number }> {
    if (!this.bot || !this.walletTopupChatId) {
      this.logger.warn("Global bot/kanal yo'q — hamyon cheki yuborilmadi");
      return { messageId: 0 };
    }
    const keyboard = new InlineKeyboard()
      .text('✅ Tasdiqlash', `topup:approve:${invoiceId}`)
      .text('❌ Rad etish', `topup:reject:${invoiceId}`);
    const msg = await this.bot.api.sendPhoto(
      this.walletTopupChatId,
      new InputFile(photo, 'chek.jpg'),
      { caption, parse_mode: 'HTML', reply_markup: keyboard },
    );
    return { messageId: msg.message_id };
  }

  async sendToOrdersChannel(text: string, replyMarkup?: InlineKeyboard): Promise<{ messageId: number }> {
    if (!this.bot || !this.ordersChannelId) return { messageId: 0 };
    const msg = await this.bot.api.sendMessage(this.ordersChannelId, text, {
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
    return { messageId: msg.message_id };
  }

  async editOrdersChannelMessage(messageId: number, text: string, replyMarkup?: InlineKeyboard): Promise<void> {
    if (!this.bot || !this.ordersChannelId) return;
    try {
      await this.bot.api.editMessageText(this.ordersChannelId, messageId, text, {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
    } catch (err) {
      this.logger.warn(`Failed to edit channel message: ${(err as Error).message}`);
    }
  }

  async sendDirectMessage(telegramId: bigint | number, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(Number(telegramId), text, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.warn(`Failed to send DM to ${telegramId}: ${(err as Error).message}`);
    }
  }

  async sendToSupportChat(text: string, replyMarkup?: InlineKeyboard): Promise<void> {
    if (!this.bot) return;
    // Support tiketlar faqat admin panelda ko'rinadi (DB'da saqlanadi). Telegram'ga
    // forward qilish IXTIYORIY — faqat alohida support kanali sozlangan bo'lsa.
    // To'lov/orders kanaliga (paymentsChatId) HECH QACHON tushmasligi kerak.
    const chatId = this.config.get<string>('TELEGRAM_SUPPORT_CHAT_ID');
    if (!chatId) return;
    try {
      await this.bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
    } catch (err) {
      this.logger.warn(`Failed to send to support chat: ${(err as Error).message}`);
    }
  }

  /**
   * Telegram ID bo'yicha foydalanuvchi profilini (ism, username, rasm) qaytaradi.
   * Faqat global bot ushbu foydalanuvchini "ko'rgan" bo'lsa ishlaydi — ya'ni
   * xodim avval @bot ga /id yozган bo'lsa. Aks holda `found: false`.
   * Jamoaga xodim qo'shishda ism va profil rasmini avto-to'ldirish uchun.
   */
  async lookupUserProfile(telegramId: bigint | number): Promise<{
    found: boolean;
    firstName?: string;
    lastName?: string;
    username?: string;
    photo?: Buffer;
  }> {
    if (!this.bot) return { found: false };
    try {
      const chat = await this.bot.api.getChat(Number(telegramId));
      // Faqat shaxsiy foydalanuvchi — kanal/guruh emas
      if (chat.type !== 'private') return { found: false };
      let photo: Buffer | undefined;
      const fileId = chat.photo?.big_file_id;
      if (fileId) {
        photo = await this.downloadFile(fileId).catch(() => undefined);
      }
      return {
        found: true,
        firstName: chat.first_name,
        lastName: chat.last_name,
        username: chat.username,
        photo,
      };
    } catch (err) {
      // "chat not found" — bot bu foydalanuvchini ko'rmagan (u botga /id yozmagan)
      this.logger.debug(`lookupUserProfile(${telegramId}) failed: ${(err as Error).message}`);
      return { found: false };
    }
  }

  /** Telegram file_id bo'yicha faylni yuklab Buffer qaytaradi (global bot tokeni bilan). */
  private async downloadFile(fileId: string): Promise<Buffer> {
    if (!this.bot) throw new Error('Bot disabled');
    const token = (this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '').trim();
    const file = await this.bot.api.getFile(fileId);
    const path = file.file_path;
    if (!path) throw new Error('file_path yo\'q');
    const ab = await fetch(`https://api.telegram.org/file/bot${token}/${path}`).then((r) => r.arrayBuffer());
    return Buffer.from(new Uint8Array(ab));
  }
}
