import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InputFile, type Bot } from 'grammy';
import { PrismaService } from '@/prisma/prisma.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';
import { UploadsService } from '../uploads/uploads.service';
import { isInstagramLink, parseTelegramPostLink, resolveInstagramMedia } from './broadcast-media';

export interface BroadcastFilters {
  /** Faqat order qilgan (true) yoki hech qachon order qilmagan (false). undefined = filtersiz. */
  hasOrders?: boolean;
  /** Oxirgi N kun ichida order qilmaganlar (re-engagement uchun). */
  noOrdersInDays?: number;
  /** Oxirgi N kun ichida faol bo'lganlar (lastSeenAt asosida). */
  activeInDays?: number;
  /** Faqat shu tildagi foydalanuvchilar (uz / ru). */
  language?: 'uz' | 'ru';
  /** Bloklanganlarni qo'shmaslik (default true). */
  excludeBlocked?: boolean;
  /** Joriy do'kon — shu do'kon mijozlari bilan cheklash (server tomonda qo'yiladi). */
  tenantId?: string | null;
}

export interface CreateBroadcastInput {
  messageUz: string;
  messageRu?: string | null;
  filters: BroadcastFilters;
  /** 'text' | 'photo' | 'video' — yuklangan media turi. */
  mediaType?: 'text' | 'photo' | 'video';
  /** Yuklangan media URL'i (rasm/video). */
  mediaUrl?: string | null;
  /** Havola: Telegram kanal posti yoki Instagram post/reel. */
  link?: string | null;
}

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);
  /** Telegram global rate limit ~30 msg/sec. Bizniki 25 — xavfsiz chegara. */
  private readonly BATCH_SIZE = 25;
  private readonly BATCH_DELAY_MS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: TelegramBotService,
    private readonly tenantBot: TenantBotService,
    private readonly uploads: UploadsService,
  ) {}

  /** Filter shartlariga mos foydalanuvchilarni nechtaligi (preview). */
  async countRecipients(filters: BroadcastFilters, tenantId: string | null): Promise<number> {
    const where = this.buildUserWhere({ ...filters, tenantId });
    return this.prisma.user.count({ where });
  }

  async listHistory(tenantId: string | null, limit = 30): Promise<Array<unknown>> {
    return this.prisma.broadcast.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async getById(id: string, tenantId: string | null): Promise<unknown> {
    const b = await this.prisma.broadcast.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
    });
    if (!b) throw new NotFoundException('Broadcast not found');
    return b;
  }

  /**
   * Yangi broadcast yaratadi va fonda yuborishni boshlaydi.
   * Havola berilgan bo'lsa (Telegram/Instagram) — shu yerda hal qilinadi.
   */
  async create(
    adminId: string,
    tenantId: string | null,
    input: CreateBroadcastInput,
  ): Promise<{ id: string; totalCount: number }> {
    const filters = { ...input.filters, excludeBlocked: input.filters.excludeBlocked ?? true };

    // ─── Media: havola yoki yuklangan fayl ───────────────────
    let mediaType: 'text' | 'photo' | 'video' = input.mediaType ?? 'text';
    let mediaUrl: string | null = input.mediaUrl ?? null;
    let copyFromChatId: string | null = null;
    let copyMessageId: number | null = null;

    const link = input.link?.trim();
    if (link) {
      const tg = parseTelegramPostLink(link);
      if (tg) {
        copyFromChatId = tg.fromChatId;
        copyMessageId = tg.messageId;
        mediaType = 'text';
        mediaUrl = null;
      } else if (isInstagramLink(link)) {
        const media = await resolveInstagramMedia(link);
        if (!media) {
          throw new BadRequestException(
            "Instagram havolasidan media olib bo'lmadi. Iltimos, faylni to'g'ridan-to'g'ri yuklang.",
          );
        }
        if (media.type === 'video') {
          const saved = await this.uploads.saveVideo(media.buffer, media.mime);
          mediaUrl = saved.url;
          mediaType = 'video';
        } else {
          const saved = await this.uploads.saveImage(media.buffer);
          mediaUrl = saved.url;
          mediaType = 'photo';
        }
      } else {
        throw new BadRequestException("Havola noto'g'ri. Telegram kanal posti yoki Instagram havolasi bo'lishi kerak.");
      }
    }

    const where = this.buildUserWhere({ ...filters, tenantId });
    const totalCount = await this.prisma.user.count({ where });

    const created = await this.prisma.broadcast.create({
      data: {
        tenantId: tenantId ?? null,
        messageUz: input.messageUz,
        messageRu: input.messageRu || null,
        mediaType,
        mediaUrl,
        copyFromChatId,
        copyMessageId,
        filters: filters as unknown as Prisma.JsonObject,
        totalCount,
        status: 'pending',
        createdById: adminId,
      },
    });

    // Fonda yuborish — async, errorni log qilamiz lekin javobni kutmaymiz
    this.processBroadcast(created.id).catch((err) =>
      this.logger.error(`Broadcast ${created.id} processing failed: ${(err as Error).message}`),
    );

    return { id: created.id, totalCount };
  }

  /** Asosiy yuborish jarayoni — batch'larda, rate limit bilan, do'kon boti orqali. */
  private async processBroadcast(broadcastId: string): Promise<void> {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return;
    if (broadcast.status !== 'pending') {
      this.logger.warn(`Broadcast ${broadcastId} status is ${broadcast.status}, skipping`);
      return;
    }

    await this.prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'running' } });

    const filters = broadcast.filters as unknown as BroadcastFilters;
    const where = this.buildUserWhere({ ...filters, tenantId: broadcast.tenantId });
    const recipients = await this.prisma.user.findMany({
      where,
      select: { id: true, telegramId: true, language: true },
    });

    this.logger.log(`Broadcast ${broadcastId}: starting send to ${recipients.length} users`);

    // Do'kon broadcast'i — do'kon boti; platforma broadcast'i (tenantId yo'q) — global bot.
    const sender: Bot | null = broadcast.tenantId
      ? await this.tenantBot.getBot(broadcast.tenantId)
      : this.bot.bot ?? null;

    if (!sender) {
      this.logger.warn(`Broadcast ${broadcastId}: bot topilmadi (token yo'q) — bekor qilindi`);
      await this.prisma.broadcast.update({ where: { id: broadcastId }, data: { status: 'failed' } });
      return;
    }

    // Yuklangan video — bir marta Telegram'ga yuklab, qaytgan file_id ni har
    // keyingi userga qayta ishlatamiz (50MB videoni 1000 marta qayta yuklamaymiz).
    // Boshqa media (rasm/havola) avvalgidek URL orqali ketadi.
    const localVideoPath =
      broadcast.mediaType === 'video' ? this.uploads.localPathFromUrl(broadcast.mediaUrl) : null;
    let videoFileId: string | null = null;

    let sent = 0;
    let failed = 0;
    let startIdx = 0;

    // 1-faza: yuklangan video bo'lsa — file_id olinmaguncha ketma-ket yuboramiz
    // (faqat 1-2 ta yuborish, odatda birinchisi muvaffaqiyatli bo'ladi).
    if (localVideoPath) {
      while (startIdx < recipients.length && !videoFileId) {
        const u = recipients[startIdx];
        try {
          const msg = await this.sendOne(
            sender,
            Number(u.telegramId),
            u.language,
            broadcast,
            new InputFile(localVideoPath),
          );
          videoFileId = this.videoFileIdOf(msg);
          sent++;
        } catch {
          failed++;
        }
        startIdx++;
      }
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { sentCount: sent, failedCount: failed },
      });
    }

    // 2-faza: qolganlarga batch'larda. Video uchun file_id (bo'lsa), aks holda mediaUrl.
    for (let i = startIdx; i < recipients.length; i += this.BATCH_SIZE) {
      const batch = recipients.slice(i, i + this.BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((u) =>
          this.sendOne(sender, Number(u.telegramId), u.language, broadcast, videoFileId ?? undefined),
        ),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') sent++;
        else failed++;
      }
      await this.prisma.broadcast.update({
        where: { id: broadcastId },
        data: { sentCount: sent, failedCount: failed },
      });
      if (i + this.BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY_MS));
      }
    }

    await this.prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        sentCount: sent,
        failedCount: failed,
        status: failed === recipients.length && recipients.length > 0 ? 'failed' : 'completed',
        finishedAt: new Date(),
      },
    });

    // Tugagach — yuklangan video faylni o'chiramiz: diskda joy egallamasin.
    // (Video Telegram'da file_id orqali saqlanadi, bizga kerak emas.)
    if (localVideoPath) {
      await this.uploads.deleteByUrl(broadcast.mediaUrl).catch(() => undefined);
      await this.prisma.broadcast
        .update({ where: { id: broadcastId }, data: { mediaUrl: null } })
        .catch(() => undefined);
    }

    this.logger.log(`Broadcast ${broadcastId} finished: ${sent} sent, ${failed} failed`);
  }

  /** sendVideo javobidan file_id ni ajratadi (video/animation/document bo'lishi mumkin). */
  private videoFileIdOf(msg: unknown): string | null {
    const m = msg as {
      video?: { file_id?: string };
      animation?: { file_id?: string };
      document?: { file_id?: string };
    } | null;
    return m?.video?.file_id ?? m?.animation?.file_id ?? m?.document?.file_id ?? null;
  }

  /** Telegram caption chegarasi. Bundan uzun matn alohida xabar bo'lib ketadi. */
  private readonly CAPTION_MAX = 1024;

  private sendText(bot: Bot, chatId: number, text: string): Promise<unknown> {
    return bot.api.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  }

  /**
   * Bitta foydalanuvchiga matn yoki media yuboradi.
   * `videoRef` — video uchun manba: birinchi yuborishda `InputFile` (fayl yuklanadi),
   * keyin esa file_id (string) qayta ishlatiladi. Berilmasa — `mediaUrl` ishlatiladi.
   * Video yuborilganda Message qaytadi (file_id ni ajratish uchun).
   */
  private async sendOne(
    bot: Bot,
    chatId: number,
    lang: string,
    b: { messageUz: string; messageRu: string | null; mediaType: string; mediaUrl: string | null; copyFromChatId: string | null; copyMessageId: number | null },
    videoRef?: InputFile | string,
  ): Promise<unknown> {
    const text = (lang === 'ru' && b.messageRu ? b.messageRu : b.messageUz) ?? '';

    // ─── Telegram kanal posti (havola) — postni o'zini qayta yuboramiz.
    // Matnni alohida xabar qilamiz: copyMessage'ga caption berish matnli postda
    // xato beradi, media postda esa originalni almashtirib yuboradi.
    if (b.copyFromChatId && b.copyMessageId) {
      if (text.trim()) await this.sendText(bot, chatId, text);
      return bot.api.copyMessage(chatId, b.copyFromChatId, b.copyMessageId);
    }

    const hasMedia = (b.mediaType === 'photo' || b.mediaType === 'video') && (b.mediaUrl || videoRef);
    if (hasMedia) {
      // Caption faqat 1024 belgidan oshmasa beramiz (kesmaymiz — HTML teglari buzilmasligi uchun).
      const fits = text.length <= this.CAPTION_MAX;
      const opts = fits && text.trim() ? { caption: text, parse_mode: 'HTML' as const } : {};
      let msg: unknown;
      if (b.mediaType === 'photo') {
        msg = await bot.api.sendPhoto(chatId, b.mediaUrl as string, opts);
      } else {
        // Video: InputFile (birinchi marta yuklash) yoki file_id, aks holda URL.
        const ref = videoRef ?? (b.mediaUrl as string);
        msg = await bot.api.sendVideo(chatId, ref, { ...opts, supports_streaming: true });
      }
      // Matn caption'ga sig'masa — to'liq matnni alohida xabar qilib yuboramiz.
      if (!fits && text.trim()) await this.sendText(bot, chatId, text);
      return msg;
    }

    return this.sendText(bot, chatId, text);
  }

  private buildUserWhere(filters: BroadcastFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (filters.excludeBlocked !== false) {
      where.isBlocked = false;
    }
    if (filters.language) {
      where.language = filters.language;
    }
    if (filters.activeInDays !== undefined && filters.activeInDays > 0) {
      where.lastSeenAt = { gte: this.daysAgo(filters.activeInDays) };
    }

    // Order shartlarini AND bilan birlashtiramiz — bir-birini bekor qilmasligi uchun.
    const orderScope: Prisma.NumberOrderWhereInput = filters.tenantId ? { tenantId: filters.tenantId } : {};
    const orderConds: Prisma.UserWhereInput[] = [];

    // Do'kon konteksti: "Mijozlar" = shu do'kondan kamida bitta order qilganlar
    // (dashboard "customersCount" bilan bir xil ta'rif).
    if (filters.tenantId) {
      orderConds.push({ orders: { some: orderScope } });
    }
    if (filters.hasOrders === true) {
      orderConds.push({ orders: { some: orderScope } });
    } else if (filters.hasOrders === false) {
      // Do'kon konteksti bilan birga bu bo'sh to'plam beradi (mijoz, lekin order'i yo'q) — to'g'ri.
      orderConds.push({ orders: { none: orderScope } });
    }
    if (filters.noOrdersInDays !== undefined && filters.noOrdersInDays > 0) {
      orderConds.push({
        orders: { none: { ...orderScope, createdAt: { gte: this.daysAgo(filters.noOrdersInDays) } } },
      });
    }

    if (orderConds.length === 1) {
      Object.assign(where, orderConds[0]);
    } else if (orderConds.length > 1) {
      where.AND = orderConds;
    }

    return where;
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
