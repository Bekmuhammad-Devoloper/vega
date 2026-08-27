import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { TariffPlan } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { ReferralService } from '../referral/referral.service';
import { TelegramBotService } from './telegram-bot.service';

const TARIFF_LABEL: Record<TariffPlan, string> = {
  FREE: 'Free',
  STANDARD: 'Standart',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

interface PaymentCallback {
  action: 'approve' | 'reject';
  tenantId: string;
  // grammy Context — faqat xabarni tahrirlash uchun ishlatamiz
  ctx?: {
    from?: { username?: string; first_name?: string };
    callbackQuery?: { message?: { caption?: string } };
    editMessageCaption?: (opts: { caption: string; parse_mode?: string }) => Promise<unknown>;
    editMessageReplyMarkup?: () => Promise<unknown>;
  };
}

@Injectable()
export class TelegramPaymentsListener implements OnModuleInit {
  private readonly logger = new Logger(TelegramPaymentsListener.name);

  constructor(
    private readonly bot: TelegramBotService,
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly referral: ReferralService,
  ) {}

  onModuleInit(): void {
    this.bot.setCallbackEmitter(this.events);
    this.events.on('payment-callback', async (p: PaymentCallback) => {
      try {
        await this.handle(p);
      } catch (err) {
        this.logger.error(`Payment callback failed: ${(err as Error).message}`);
      }
    });
  }

  private async handle({ action, tenantId, ctx }: PaymentCallback): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;

    // Tarif FAQAT shu yerda — admin tasdiqlagach — o'zgaradi. Chek yuborilganda
    // tanlov `pendingPlan`da saqlangan bo'ladi; u bo'lmasa (eski do'konlar)
    // joriy tarif uchun to'lov qilinyapti deb hisoblaymiz.
    const plan = tenant.pendingPlan ?? tenant.tariffPlan;

    if (action === 'approve') {
      const now = new Date();
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          tariffPlan: plan, // kutilayotgan tarif endi kuchga kiradi
          pendingPlan: null,
          isActivated: true,
          activationPaidAt: now,
          status: 'ACTIVE',
        },
      });
      // Referal komissiya — taklif qilingan do'kon faollashtirish to'lovini
      // amalga oshirdi → referrerга. Komissiya bazasi — tarif narxi.
      try {
        const price = await this.referral.planPrice(plan);
        const credited = await this.referral.creditCommission(tenantId, plan, price);
        if (credited) {
          const ref = await this.prisma.tenant.findUnique({
            where: { id: credited.referrerId },
            select: { ownerTelegramId: true },
          });
          if (ref?.ownerTelegramId) {
            const amt = credited.amount.toLocaleString('ru-RU').replace(/,/g, ' ');
            await this.bot.sendDirectMessage(
              ref.ownerTelegramId,
              `🎉 <b>Referal bonus: ${amt} so'm!</b>\n\nSiz taklif qilgan do'kon faollashtirish to'lovini amalga oshirdi. Bonus referal balansingizga qo'shildi.`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Referral commission failed: ${(err as Error).message}`);
      }
      if (tenant.ownerTelegramId) {
        await this.bot.sendDirectMessage(
          tenant.ownerTelegramId,
          `✅ <b>To'lovingiz tasdiqlandi!</b>\n\n<b>${TARIFF_LABEL[plan]}</b> tarifi faollashtirildi. Do'koningiz tayyor — mijozlarga virtual raqam sota boshlang!`,
        );
      }
    } else {
      // Rad — kutilayotgan tarif bekor qilinadi, do'kon oldingi holatiga qaytadi.
      // Ilgari faollashtirilgan bo'lsa ACTIVE'da qoladi (eski tarifi bilan
      // ishlayveradi), aks holda to'lov kutish holatida turadi.
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          pendingPlan: null,
          status: tenant.isActivated ? 'ACTIVE' : 'PENDING_PAYMENT',
        },
      });
      if (tenant.ownerTelegramId) {
        await this.bot.sendDirectMessage(
          tenant.ownerTelegramId,
          `❌ <b>To'lov tasdiqlanmadi.</b>\n\nIltimos, to'lovni qayta tekshiring yoki support bilan bog'laning.`,
        );
      }
    }

    // Admin chatidagi xabarni belgilash
    try {
      const label = action === 'approve' ? '✅ TASDIQLANDI' : '❌ BEKOR QILINDI';
      const by = ctx?.from?.username
        ? `@${ctx.from.username}`
        : ctx?.from?.first_name ?? '';
      const cap = ctx?.callbackQuery?.message?.caption ?? '';
      await ctx?.editMessageCaption?.({
        caption: `${cap}\n\n<b>${label}</b>${by ? ` — ${by}` : ''}`,
        parse_mode: 'HTML',
      });
    } catch {
      // tahrirlash muvaffaqiyatsiz — muhim emas
    }
  }
}
