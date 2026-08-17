import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChannelPostStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { TenantBotService } from '../telegram-bot/tenant-bot.service';

/** Bir do'konda bir vaqtning o'zida shuncha rejalashtirilgan (joylanmagan) e'lon bo'lishi mumkin. */
const MAX_SCHEDULED = 10;

export interface CreatePostInput {
  text: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  buyButton?: boolean;
  buttonText?: string | null;
  scheduledAt: string; // ISO
}

@Injectable()
export class ChannelPostsService {
  private readonly logger = new Logger(ChannelPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantBot: TenantBotService,
  ) {}

  /** Sotuvchi kanal sozlamasi (kanal id, bot holati). */
  async config(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { channelId: true, botUsername: true, botToken: true },
    });
    if (!t) throw new NotFoundException("Do'kon topilmadi");
    return {
      channelId: t.channelId ?? '',
      botUsername: t.botUsername ?? null,
      hasBot: !!t.botToken,
      maxScheduled: MAX_SCHEDULED,
    };
  }

  /** Ulangan kanal haqida jonli ma'lumot (nomi, rasmi, obunachilar soni). */
  async channelInfo(tenantId: string) {
    return this.tenantBot.getChannelInfo(tenantId);
  }

  /** Kanal id ni o'rnatadi. */
  async setChannel(tenantId: string, channelId: string) {
    const ch = (channelId ?? '').trim();
    if (ch && !/^(-100\d{6,}|@[A-Za-z]\w{3,})$/.test(ch)) {
      throw new BadRequestException("Kanal ID '-100...' yoki '@kanal' ko'rinishida bo'lsin");
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { channelId: ch || null },
    });
    return { ok: true };
  }

  async list(tenantId: string) {
    const posts = await this.prisma.channelPost.findMany({
      where: { tenantId },
      orderBy: [{ scheduledAt: 'desc' }],
      take: 100,
    });
    return posts.map((p) => ({
      id: p.id,
      text: p.text,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      buyButton: p.buyButton,
      buttonText: p.buttonText,
      scheduledAt: p.scheduledAt,
      status: p.status,
      publishedAt: p.publishedAt,
      error: p.error,
      createdAt: p.createdAt,
    }));
  }

  async create(tenantId: string, input: CreatePostInput) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { channelId: true, botToken: true },
    });
    if (!t) throw new NotFoundException("Do'kon topilmadi");
    if (!t.botToken) throw new BadRequestException("Avval do'kon botini ulang");
    if (!t.channelId) throw new BadRequestException('Avval kanal ID ni kiriting');

    const text = (input.text ?? '').trim();
    if (text.length < 1) throw new BadRequestException("E'lon matni bo'sh bo'lmasin");
    if (text.length > 3500) throw new BadRequestException("Matn juda uzun (3500 belgigacha)");

    const scheduledAt = new Date(input.scheduledAt);
    if (isNaN(scheduledAt.getTime())) throw new BadRequestException("Sana noto'g'ri");
    // 60 kundan keyingisiga ruxsat yo'q
    const maxFuture = Date.now() + 60 * 24 * 60 * 60 * 1000;
    if (scheduledAt.getTime() > maxFuture) {
      throw new BadRequestException('Eng ko\'pi 60 kun ichidagi vaqtni belgilang');
    }

    const pending = await this.prisma.channelPost.count({
      where: { tenantId, status: ChannelPostStatus.SCHEDULED },
    });
    if (pending >= MAX_SCHEDULED) {
      throw new BadRequestException(
        `Rejada ${MAX_SCHEDULED} tagacha e'lon bo'lishi mumkin. Avvalgilari joylangach yangisini qo'shing.`,
      );
    }

    // Bitta media — video bo'lsa rasm e'tiborga olinmaydi
    const videoUrl = input.videoUrl?.trim() || null;
    const imageUrl = videoUrl ? null : input.imageUrl?.trim() || null;

    const post = await this.prisma.channelPost.create({
      data: {
        tenantId,
        text,
        imageUrl,
        videoUrl,
        buyButton: !!input.buyButton,
        buttonText: input.buttonText?.trim() || null,
        scheduledAt,
        status: ChannelPostStatus.SCHEDULED,
      },
    });

    // Vaqti kelgan (yoki o'tgan) bo'lsa — darhol joylaymiz ("hozir joylash")
    if (scheduledAt.getTime() <= Date.now() + 5000) {
      await this.publishOne(post.id);
      return this.getOne(tenantId, post.id);
    }
    return this.getOne(tenantId, post.id);
  }

  private async getOne(tenantId: string, id: string) {
    const p = await this.prisma.channelPost.findFirst({ where: { id, tenantId } });
    if (!p) throw new NotFoundException("E'lon topilmadi");
    return p;
  }

  async remove(tenantId: string, id: string) {
    const p = await this.prisma.channelPost.findUnique({ where: { id } });
    if (!p) throw new NotFoundException("E'lon topilmadi");
    if (p.tenantId !== tenantId) throw new ForbiddenException('Ruxsat yo\'q');
    // Joylangan bo'lsa — kanaldan ham o'chirishga harakat qilamiz
    if (p.status === ChannelPostStatus.PUBLISHED && p.channelMessageId) {
      await this.tenantBot.deleteChannelMessage(tenantId, p.channelMessageId).catch(() => undefined);
    }
    await this.prisma.channelPost.delete({ where: { id } });
    return { ok: true };
  }

  /** Bitta e'lonni kanalga joylaydi (cron yoki "hozir joylash" chaqiradi). */
  private async publishOne(id: string): Promise<void> {
    const post = await this.prisma.channelPost.findUnique({ where: { id } });
    if (!post || post.status !== ChannelPostStatus.SCHEDULED) return;
    try {
      const messageId = await this.tenantBot.publishToChannel(post.tenantId, {
        text: post.text,
        imageUrl: post.imageUrl,
        videoUrl: post.videoUrl,
        buyButton: post.buyButton,
        buttonText: post.buttonText,
      });
      await this.prisma.channelPost.update({
        where: { id },
        data: { status: ChannelPostStatus.PUBLISHED, publishedAt: new Date(), channelMessageId: messageId, error: null },
      });
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 300) ?? 'Xatolik';
      this.logger.warn(`Channel post ${id} failed: ${msg}`);
      await this.prisma.channelPost.update({
        where: { id },
        data: { status: ChannelPostStatus.FAILED, error: msg },
      });
    }
  }

  /** Har daqiqada — vaqti kelgan rejalashtirilgan e'lonlarni kanallarga joylaydi. */
  @Cron(CronExpression.EVERY_MINUTE)
  async publishDue(): Promise<void> {
    const due = await this.prisma.channelPost.findMany({
      where: { status: ChannelPostStatus.SCHEDULED, scheduledAt: { lte: new Date() } },
      select: { id: true },
      take: 25,
    });
    for (const p of due) {
      await this.publishOne(p.id);
    }
  }
}
