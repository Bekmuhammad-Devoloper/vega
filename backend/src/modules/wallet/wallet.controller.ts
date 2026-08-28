import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { type Admin } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { CurrentAdmin, RolesGuard } from '../admin-auth/roles.guard';
import { UploadsService } from '../uploads/uploads.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import { WalletService } from './wallet.service';

class TopupDto {
  @Type(() => Number) @IsNumber() @Min(1000) amount!: number;
  @IsOptional() @IsString() method?: string;
}

function money(n: number): string {
  return n.toLocaleString('ru-RU').replace(/,/g, ' ');
}

/// Reseller hamyoni — balans, tranzaksiyalar, chek bilan to'ldirish (admin panel).
@Controller('admin/wallet')
@UseGuards(AdminJwtGuard, RolesGuard)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly uploads: UploadsService,
    private readonly tgbot: TelegramBotService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async summary(@CurrentAdmin() admin: Admin) {
    const tenantId = admin.tenantId as string;
    return {
      balance: await this.wallet.balance(tenantId),
      transactions: await this.wallet.transactionsWithReceipts(tenantId),
    };
  }

  /** Platforma kartasi — reseller shu kartaga o'tkazadi. */
  @Get('card')
  card() {
    return this.wallet.topupCard();
  }

  /** Platforma kripto manzili (TON) + jonli TON kursi (so'mda). */
  @Get('crypto')
  async crypto() {
    return {
      ...this.wallet.topupCrypto(),
      tonPriceUzs: await this.wallet.tonPriceUzs(),
    };
  }

  /** Balansni to'ldirish so'rovi (cheksiz — eski oqim, superadmin tasdiqlaydi). */
  @Post('topup')
  topup(@CurrentAdmin() admin: Admin, @Body() dto: TopupDto) {
    return this.wallet.requestTopup(admin.tenantId as string, dto.amount, {
      method: dto.method,
    });
  }

  /**
   * Chek bilan to'ldirish: reseller summa + to'lov chekini (rasm) yuklaydi ->
   * PENDING invoice + admin bot kanaliga tasdiqlash xabari (tugmalar bilan).
   */
  @Post('topup/receipt')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async topupReceipt(
    @CurrentAdmin() admin: Admin,
    @Body('amount') amountRaw: string,
    @Body('method') methodRaw: string,
    @Body('tonAmount') tonAmountRaw: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp)/ })
        .addMaxSizeValidator({ maxSize: 8 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    const tenantId = admin.tenantId as string;
    // Kiritilgan summa = reseller TO'LAGAN (chekdagi) summa (gross).
    const gross = Number(String(amountRaw ?? '').replace(/[^0-9]/g, ''));
    if (!Number.isFinite(gross) || gross < 1000) {
      throw new BadRequestException("Summa noto'g'ri (kamida 1 000 so'm)");
    }
    const method = String(methodRaw ?? '').toUpperCase() === 'CRYPTO' ? 'CRYPTO' : 'CARD';
    const tonAmount = Number(String(tonAmountRaw ?? '').replace(',', '.')) || 0;

    // Komissiya: karta -> feePercent (default 2%), kripto -> 0%.
    const feePercent = method === 'CARD' ? this.wallet.topupCard().feePercent : 0;
    const fee = Math.round((gross * feePercent) / 100);
    const net = gross - fee; // hamyonga qo'shiladigan sof summa

    // Chekni saqlab (dev panel ko'rishi uchun) + invoice yaratamiz (amount = SOF)
    const saved = await this.uploads.saveImage(file.buffer);
    const invoice = await this.wallet.requestTopup(tenantId, net, {
      receiptUrl: saved.mediumUrl,
      requestedByUserId: admin.id,
      method,
      grossAmount: gross,
      feePercent,
      ...(method === 'CRYPTO' && tonAmount > 0 ? { tonAmount } : {}),
    });

    // Admin bot kanaliga chek + tasdiqlash tugmalari
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { shopName: true, ownerUsername: true },
    });
    const by = tenant?.ownerUsername ? `@${tenant.ownerUsername}` : '';
    const methodLabel = method === 'CRYPTO' ? '🪙 Kripto (USDT/TON)' : '💳 Karta';
    let caption =
      `💰 <b>Hamyon to'ldirish so'rovi</b>\n\n` +
      `🏪 Do'kon: <b>${tenant?.shopName ?? tenantId}</b>\n` +
      `💠 Usul: <b>${methodLabel}</b>\n`;
    if (fee > 0) {
      caption +=
        `💵 To'lov (chek): <b>${money(gross)} so'm</b>\n` +
        `➖ Komissiya (${feePercent}%): <b>${money(fee)} so'm</b>\n` +
        `✅ Hamyonga: <b>${money(net)} so'm</b>\n`;
    } else {
      if (method === 'CRYPTO' && tonAmount > 0) {
        caption += `🪙 Yuborildi: <b>${tonAmount} TON</b>\n`;
      }
      caption += `💵 Summa: <b>${money(net)} so'm</b> (komissiyasiz)\n`;
    }
    // Pul QAYSI hisobga tushgani — tasdiqlovchi chekni shu bilan solishtiradi.
    if (method === 'CRYPTO') {
      const cr = this.wallet.topupCrypto();
      caption +=
        `🏦 Qabul qiluvchi: <b>${cr.network}</b> <code>${cr.address}</code>
`;
    } else {
      const cd = this.wallet.topupCard();
      caption += cd.cardNumber
        ? `🏦 Qaysi kartaga: <b>${cd.cardNumber}</b>
` +
          (cd.cardHolder ? `🧑 Karta egasi: <b>${cd.cardHolder}</b>
` : '')
        : `⚠️ <b>Platforma kartasi sozlanmagan</b> (PLATFORM_CARD_NUMBER)
`;
    }
    caption +=
      `🧾 №: ${invoice.invoiceNumber}` +
      (by ? `\n👤 ${by}` : '') +
      `\n\nChekni tekshirib, tasdiqlang yoki rad eting.`;
    try {
      await this.tgbot.sendWalletTopupReceipt(file.buffer, caption, invoice.id);
    } catch {
      // Yuborish muvaffaqiyatsiz — invoice baribir PENDING, dev paneldan tasdiqlanadi
    }
    return { ok: true, invoiceNumber: invoice.invoiceNumber };
  }

  /** Mening to'ldirish so'rovlarim. */
  @Get('topups')
  topups(@CurrentAdmin() admin: Admin) {
    return this.wallet.myTopups(admin.tenantId as string);
  }
}
