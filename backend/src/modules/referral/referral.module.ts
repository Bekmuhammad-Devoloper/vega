import { Module } from '@nestjs/common';
import { ReferralService } from './referral.service';

/**
 * Referal tizimi yadrosi — faqat ReferralService (prisma + config).
 * Bot/auth bog'liqligi yo'q, shuning uchun TelegramBot/SuperAdmin/AdminStore
 * modullari buni xavfsiz import qila oladi (sikl yo'q).
 */
@Module({
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
