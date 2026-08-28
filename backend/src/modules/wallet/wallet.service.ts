import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletTxType, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

/// Reseller ULGURJI hamyoni — raqam sotib olish uchun oldindan to'ldiriladi.
/// Tenant.walletBalance = joriy balans; WalletTransaction = ledger (audit).
@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Platforma balansi qatorining IDsi (singleton). */
  private readonly PLATFORM_ID = 'platform';

  /** Platforma kartasi — reseller shu kartaga o'tkazib chek yuklaydi. */
  /**
   * Platforma kartasi — resellerlar hamyonini shu kartaga to'ldiradi.
   *
   * DIQQAT: ilgari bu yerda BOSHQA loyihadan qolgan karta raqami zaxira
   * qiymat sifatida turardi. Sozlama qo'yilmasa, resellerlarning puli
   * begona kartaga ketardi. Endi zaxira qiymat YO'Q — sozlanmagan bo'lsa
   * bo'sh qaytadi va UI karta ko'rsatmaydi (jim xato o'rniga ko'rinadigan
   * bo'shliq).
   */
  topupCard(): { cardNumber: string; cardHolder: string; feePercent: number } {
    return {
      cardNumber: (this.config.get<string>('PLATFORM_CARD_NUMBER') ?? '').trim(),
      cardHolder: (this.config.get<string>('PLATFORM_CARD_HOLDER') ?? '').trim(),
      // Karta orqali to'ldirishda ushlanadigan komissiya (%). Kripto — 0.
      feePercent: Number(this.config.get('TOPUP_CARD_FEE_PERCENT') ?? 2),
    };
  }

  /** Platforma kripto hamyoni (TON) — reseller USDT/TON shu manzilga yuboradi. */
  topupCrypto(): { address: string; network: string; assets: string } {
    return {
      address:
        this.config.get<string>('CRYPTO_TON_ADDRESS') ??
        'UQAMmFAC8PPEQDuaXp0f88_My2ofnToAVkfE-uKVJJJrlg1j',
      network: 'TON',
      assets: 'USDT · TON',
    };
  }

  // 1 TON narxi (so'mda) — jonli, 2 daqiqa keshlanadi.
  private tonPriceCache: { uzs: number; at: number } | null = null;

  /** 1 TON = necha so'm (jonli kurs). Binance -> CoinGecko; xato bo'lsa oxirgi kesh. */
  async tonPriceUzs(): Promise<number> {
    const now = Date.now();
    if (this.tonPriceCache && now - this.tonPriceCache.at < 120_000) {
      return this.tonPriceCache.uzs;
    }
    const rate = Number(this.config.get('USD_TO_UZS') ?? 12200);
    const usd = await this.fetchTonUsd();
    if (usd > 0) {
      const uzs = Math.round(usd * rate);
      this.tonPriceCache = { uzs, at: now };
      return uzs;
    }
    return this.tonPriceCache?.uzs ?? 0;
  }

  private async fetchTonUsd(): Promise<number> {
    // 1) Binance
    try {
      const r = await fetch(
        'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT',
        { signal: AbortSignal.timeout(5000) },
      );
      const d = (await r.json()) as { price?: string };
      const p = Number(d?.price);
      if (Number.isFinite(p) && p > 0) return p;
    } catch {
      /* keyingisiga o'tamiz */
    }
    // 2) CoinGecko (zaxira)
    try {
      const r = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd',
        { signal: AbortSignal.timeout(5000) },
      );
      const d = (await r.json()) as { 'the-open-network'?: { usd?: number } };
      const p = Number(d?.['the-open-network']?.usd);
      if (Number.isFinite(p) && p > 0) return p;
    } catch {
      /* ignore */
    }
    return 0;
  }

  // ── Platforma (egasi) balansi ────────────────────────────────────
  /** Egasining joriy ulgurji balansi (resellerlarга tarqatish uchun manba). */
  async platformBalance(): Promise<number> {
    const w = await this.prisma.platformWallet.findUnique({
      where: { id: this.PLATFORM_ID },
    });
    return Number(w?.balance ?? 0);
  }

  /** Egasi o'z platforma balansini to'ldiradi (float). Atomik + ledger. */
  async platformTopup(amount: number, note?: string): Promise<number> {
    if (amount <= 0) throw new BadRequestException("Summa musbat bo'lishi kerak");
    return this.prisma.$transaction(async (tx) => {
      const w = await tx.platformWallet.upsert({
        where: { id: this.PLATFORM_ID },
        update: { balance: { increment: amount } },
        create: { id: this.PLATFORM_ID, balance: amount },
        select: { balance: true },
      });
      await tx.platformWalletTx.create({
        data: {
          type: 'TOPUP',
          amount,
          balanceAfter: w.balance,
          note: note ?? "Platforma balansini to'ldirish",
        },
      });
      return Number(w.balance);
    });
  }

  /** Platforma balansi tranzaksiyalari (audit). */
  platformTxs(take = 30) {
    return this.prisma.platformWalletTx.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async balance(tenantId: string): Promise<number> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { walletBalance: true },
    });
    return Number(t?.walletBalance ?? 0);
  }

  transactions(tenantId: string, take = 50) {
    return this.prisma.walletTransaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Tranzaksiyalar + har TOPUP uchun chek rasm URLi (invoice metadatasidan).
   * Bog'lash: tranzaksiya note'ида invoice raqami — "... (WT-XXXX)".
   */
  async transactionsWithReceipts(tenantId: string, take = 50) {
    const [txs, invoices] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.invoice.findMany({
        where: { tenantId, kind: 'WALLET_TOPUP' },
        select: { invoiceNumber: true, metadata: true },
      }),
    ]);
    const receiptByNumber = new Map<string, string>();
    for (const inv of invoices) {
      const meta =
        inv.metadata && typeof inv.metadata === 'object'
          ? (inv.metadata as Record<string, unknown>)
          : {};
      const url = typeof meta.receiptUrl === 'string' ? meta.receiptUrl : null;
      if (url) receiptByNumber.set(inv.invoiceNumber, url);
    }
    return txs.map((t) => {
      // Ustundagi chek (yangi) ustun; bo'lmasa — eski TOPUP invoice raqamidan.
      const m = t.note?.match(/\((WT-[A-Z0-9]+)\)/);
      const fromInvoice = m ? (receiptByNumber.get(m[1]) ?? null) : null;
      return { ...t, receiptUrl: t.receiptUrl ?? fromInvoice };
    });
  }

  /** Balansni oshirish (TOPUP / REFUND / ADJUSTMENT). Atomik. */
  async credit(
    tenantId: string,
    amount: number,
    type: WalletTxType,
    note?: string,
    orderId?: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException("Summa musbat bo'lishi kerak");
    return this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.update({
        where: { id: tenantId },
        data: { walletBalance: { increment: amount } },
        select: { walletBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          tenantId,
          type,
          amount,
          balanceAfter: t.walletBalance,
          note,
          orderId,
        },
      });
      return Number(t.walletBalance);
    });
  }

  /** Balansdan yechish (raqam ulgurji xaridi). Yetmasa xato. Atomik. */
  async debit(
    tenantId: string,
    amount: number,
    note?: string,
    orderId?: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException("Summa musbat bo'lishi kerak");
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { walletBalance: true },
      });
      if (!current || Number(current.walletBalance) < amount) {
        throw new BadRequestException(
          "Hamyonda mablag' yetarli emas. Balansni to'ldiring.",
        );
      }
      const t = await tx.tenant.update({
        where: { id: tenantId },
        data: { walletBalance: { decrement: amount } },
        select: { walletBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          tenantId,
          type: WalletTxType.PURCHASE,
          amount: -amount,
          balanceAfter: t.walletBalance,
          note,
          orderId,
        },
      });
      return Number(t.walletBalance);
    });
  }

  // ── To'ldirish (topup) oqimi ──────────────────────────────────────

  /** Reseller balansni to'ldirish so'rovi -> kutilayotgan invoice (superadmin/kanal tasdiqlaydi). */
  async requestTopup(
    tenantId: string,
    amount: number,
    opts?: {
      receiptUrl?: string;
      method?: string;
      requestedByUserId?: string;
      grossAmount?: number;
      feePercent?: number;
      tonAmount?: number;
    },
  ) {
    if (amount <= 0) throw new BadRequestException("Summa musbat bo'lishi kerak");
    const invoiceNumber = 'WT-' + Date.now().toString(36).toUpperCase();
    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        tenantId,
        amount, // hamyonga qo'shiladigan SOF summa (komissiyadan keyin)
        currency: 'UZS',
        status: InvoiceStatus.PENDING,
        kind: 'WALLET_TOPUP',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description: "Ulgurji hamyon to'ldirish",
        metadata: {
          ...(opts?.method ? { method: opts.method } : {}),
          ...(opts?.receiptUrl ? { receiptUrl: opts.receiptUrl } : {}),
          ...(opts?.grossAmount != null ? { grossAmount: opts.grossAmount } : {}),
          ...(opts?.feePercent != null ? { feePercent: opts.feePercent } : {}),
          ...(opts?.tonAmount != null ? { tonAmount: opts.tonAmount } : {}),
          ...(opts?.requestedByUserId
            ? { requestedByUserId: opts.requestedByUserId }
            : {}),
        },
      },
    });
  }

  /** Reseller: o'z to'ldirish so'rovlari tarixi. */
  myTopups(tenantId: string, take = 20) {
    return this.prisma.invoice.findMany({
      where: { tenantId, kind: 'WALLET_TOPUP' },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Superadmin: kutilayotgan hamyon to'ldirishlar. */
  listPendingTopups() {
    return this.prisma.invoice.findMany({
      where: { kind: 'WALLET_TOPUP', status: InvoiceStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        tenant: {
          select: { id: true, slug: true, shopName: true, walletBalance: true },
        },
      },
    });
  }

  /**
   * Superadmin/kanal: to'ldirishni tasdiqlab, hamyonga kredit qiladi.
   * Platforma (egasi) balansidan yechiladi — yetmasa tasdiqlab bo'lmaydi (atomik).
   */
  async approveTopup(invoiceId: string): Promise<{
    tenantId: string;
    amount: number;
    balance: number;
    invoiceNumber: string;
  }> {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv || inv.kind !== 'WALLET_TOPUP') {
      throw new BadRequestException("To'ldirish so'rovi topilmadi");
    }
    if (inv.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException("So'rov allaqachon ko'rib chiqilgan");
    }
    const amount = Number(inv.amount);
    const invMeta =
      inv.metadata && typeof inv.metadata === 'object'
        ? (inv.metadata as Record<string, unknown>)
        : {};
    const invReceipt =
      typeof invMeta.receiptUrl === 'string' ? invMeta.receiptUrl : null;

    const balance = await this.prisma.$transaction(async (tx) => {
      // 1) Platforma balansi yetarlimi?
      const pw = await tx.platformWallet.findUnique({
        where: { id: this.PLATFORM_ID },
      });
      const platformBal = Number(pw?.balance ?? 0);
      if (platformBal < amount) {
        throw new BadRequestException(
          `Platforma balansi yetarli emas: ${platformBal.toLocaleString('ru-RU')} < ${amount.toLocaleString('ru-RU')} so'm. Avval o'z balansingizni to'ldiring.`,
        );
      }
      // Platformadan yechish + ledger
      const pwUpd = await tx.platformWallet.update({
        where: { id: this.PLATFORM_ID },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      });
      await tx.platformWalletTx.create({
        data: {
          type: 'DISBURSE',
          amount: -amount,
          balanceAfter: pwUpd.balance,
          note: `Reseller to'ldirish (${inv.invoiceNumber})`,
          invoiceId,
        },
      });
      // 2) Invoice PAID
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.PAID, paidAt: new Date() },
      });
      // 3) Reseller hamyoniga kredit + ledger
      const t = await tx.tenant.update({
        where: { id: inv.tenantId },
        data: { walletBalance: { increment: amount } },
        select: { walletBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          tenantId: inv.tenantId,
          type: WalletTxType.TOPUP,
          amount,
          balanceAfter: t.walletBalance,
          note: `Hamyon to'ldirish (${inv.invoiceNumber})`,
          receiptUrl: invReceipt,
        },
      });
      return Number(t.walletBalance);
    });

    return { tenantId: inv.tenantId, amount, balance, invoiceNumber: inv.invoiceNumber };
  }

  /** Superadmin/kanal: to'ldirishni rad etadi (kredit qilinmaydi). */
  async rejectTopup(
    invoiceId: string,
    reason?: string,
  ): Promise<{ tenantId: string; amount: number; invoiceNumber: string }> {
    const inv = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv || inv.kind !== 'WALLET_TOPUP') {
      throw new BadRequestException("To'ldirish so'rovi topilmadi");
    }
    if (inv.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException("So'rov allaqachon ko'rib chiqilgan");
    }
    const meta =
      inv.metadata && typeof inv.metadata === 'object'
        ? (inv.metadata as Record<string, unknown>)
        : {};
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.CANCELLED,
        metadata: { ...meta, rejectReason: reason ?? 'Rad etildi' },
      },
    });
    return {
      tenantId: inv.tenantId,
      amount: Number(inv.amount),
      invoiceNumber: inv.invoiceNumber,
    };
  }

  /**
   * Superadmin: qo'lda kredit (ADJUSTMENT). approveTopup kabi — platforma
   * (dev panel) balansidan yechib, reseller hamyoniga qo'shadi. Yetmasa xato.
   */
  async adminCredit(
    tenantId: string,
    amount: number,
    note?: string,
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException("Summa musbat bo'lishi kerak");
    return this.prisma.$transaction(async (tx) => {
      const pw = await tx.platformWallet.findUnique({
        where: { id: this.PLATFORM_ID },
      });
      const platformBal = Number(pw?.balance ?? 0);
      if (platformBal < amount) {
        throw new BadRequestException(
          `Platforma balansi yetarli emas: ${platformBal.toLocaleString('ru-RU')} < ${amount.toLocaleString('ru-RU')} so'm. Avval o'z balansingizni to'ldiring.`,
        );
      }
      const pwUpd = await tx.platformWallet.update({
        where: { id: this.PLATFORM_ID },
        data: { balance: { decrement: amount } },
        select: { balance: true },
      });
      await tx.platformWalletTx.create({
        data: {
          type: 'DISBURSE',
          amount: -amount,
          balanceAfter: pwUpd.balance,
          note: note ?? "Qo'lda kredit (reseller hamyoni)",
        },
      });
      const t = await tx.tenant.update({
        where: { id: tenantId },
        data: { walletBalance: { increment: amount } },
        select: { walletBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          tenantId,
          type: WalletTxType.ADJUSTMENT,
          amount,
          balanceAfter: t.walletBalance,
          note: note ?? 'Superadmin tuzatishi',
        },
      });
      return Number(t.walletBalance);
    });
  }
}
