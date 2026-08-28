'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  RefreshCw,
  Plus,
  Copy,
  Check,
  Upload,
  Clock,
  X,
  ChevronRight,
  CreditCard,
  Gem,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { Field, Input } from '@/components/ui/input';
import {
  apiWallet,
  apiWalletCard,
  apiWalletCrypto,
  apiWalletTopups,
  apiWalletTopupReceipt,
  type WalletTopupInvoice,
} from '@/lib/endpoints';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { WalletTransaction } from '@/lib/types';
import { toast } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

const TYPE_LABEL: Record<string, string> = {
  TOPUP: "To'ldirish",
  CREDIT: "To'ldirish",
  DEPOSIT: "To'ldirish",
  PURCHASE: 'Raqam xaridi',
  DEBIT: 'Yechim',
  WITHDRAW: 'Yechim',
  REFUND: 'Qaytarish',
  ADJUSTMENT: 'Tuzatish',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '⏳ Kutilmoqda', cls: 'bg-amber-50 text-amber-600' },
  PAID: { label: '✅ Tasdiqlandi', cls: 'bg-emerald-50 text-emerald-600' },
  CANCELLED: { label: '❌ Rad etildi', cls: 'bg-rose-50 text-rose-600' },
  FAILED: { label: '❌ Rad etildi', cls: 'bg-rose-50 text-rose-600' },
  REFUNDED: { label: 'Qaytarildi', cls: 'bg-gray-100 text-gray-500' },
};

function isCredit(t: WalletTransaction): boolean {
  const n = Number(t.amount);
  if (Number.isFinite(n) && n !== 0) return n > 0;
  const type = (t.type ?? '').toUpperCase();
  return ['TOPUP', 'CREDIT', 'DEPOSIT', 'REFUND'].includes(type);
}

/** Izohga qarab aniqroq sarlavha (masalan mijoz balansiga o'tkazma). */
function txTitle(t: WalletTransaction): string {
  const note = (t.note ?? '').toLowerCase();
  if (note.includes('mijoz balansiga')) return "Mijoz balansiga o'tkazma";
  return TYPE_LABEL[(t.type ?? '').toUpperCase()] ?? t.type ?? '—';
}

function parseMoneyInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}
function formatMoneyInput(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '';
  return new Intl.NumberFormat('ru-RU').format(n).replace(/,/g, ' ');
}

export default function WalletPage() {
  const [adding, setAdding] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<WalletTransaction | null>(null);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['wallet'],
    queryFn: apiWallet,
  });
  const { data: topups } = useQuery({ queryKey: ['wallet-topups'], queryFn: apiWalletTopups });

  const transactions = data?.transactions ?? [];
  const pending = useMemo(
    () => (topups ?? []).filter((t) => t.status === 'PENDING'),
    [topups],
  );

  return (
    <div>
      <PageHeader
        title="Hamyon"
        description="Ulgurji balans — har sotilgan raqam shundan yechiladi"
        rightSlot={
          <button
            onClick={() => refetch()}
            className="h-9 w-9 grid place-items-center rounded-xl border border-[var(--color-border)] bg-white text-[var(--color-text-muted)] hover:bg-gray-50"
            aria-label="Yangilash"
          >
            <RefreshCw size={16} className={cn(isFetching && 'animate-spin')} />
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          {/* Balans */}
          <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[#1E4FCC] p-5 text-white">
            <div className="flex items-center gap-2 text-sm/none opacity-90">
              <Wallet size={16} /> Ulgurji balans
            </div>
            {isLoading ? (
              <div className="mt-4 h-9 w-40 rounded-lg bg-white/20 animate-pulse" />
            ) : (
              <p className="mt-3 text-3xl font-bold tabular-nums">{formatMoney(data?.balance ?? 0)}</p>
            )}
          </div>

          {/* To'ldirish tugmasi */}
          <Button fullWidth onClick={() => setAdding(true)}>
            <Plus size={16} /> Balansni to&apos;ldirish
          </Button>

          {/* Kutilayotgan so'rovlar */}
          {pending.length > 0 && (
            <Card>
              <CardHeader title={<span className="inline-flex items-center gap-1.5"><Clock size={15} /> Kutilayotgan so&apos;rovlar</span>} />
              <ul className="divide-y divide-[var(--color-border)]">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="tabular-nums font-semibold">{formatMoney(p.amount)}</span>
                    <span className="text-xs rounded-full bg-amber-50 px-2 py-0.5 text-amber-600">⏳ Kutilmoqda</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* To'ldirish yo'riqnomasi */}
          <Card>
            <CardHeader title={<span className="inline-flex items-center gap-1.5"><Info size={15} /> Qanday to&apos;ldiriladi</span>} />
            <CardBody className="text-sm text-[var(--color-text-muted)] space-y-2 leading-relaxed">
              <p>
                <b>Balansni to&apos;ldirish</b> → <b>Karta</b> yoki <b>Kripto (USDT/TON)</b>ni
                tanlang → to&apos;lov qiling → chek/screenshot yuklang. Administrator
                tasdiqlagach, summa avtomatik qo&apos;shiladi.
              </p>
              <p>
                Har bir sotilgan raqamning ulgurji narxi shu balansdan yechiladi. Balans tugasa,
                mijozlar raqam sotib ololmaydi — o&apos;z vaqtida to&apos;ldirib turing.
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Tranzaksiyalar */}
        <Card className="lg:col-span-2">
          <CardHeader title="Tranzaksiyalar tarixi" />
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <EmptyState icon={Wallet} title="Hozircha tranzaksiya yo'q" />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {transactions.map((t, i) => {
                const credit = isCredit(t);
                return (
                  <li
                    key={t.id ?? i}
                    onClick={() => setDetailTx(t)}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-bg)] active:bg-[var(--color-bg)] transition-colors"
                  >
                    <span
                      className={cn(
                        'h-9 w-9 grid place-items-center rounded-full shrink-0',
                        credit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
                      )}
                    >
                      {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{txTitle(t)}</p>
                      {t.note && <p className="text-xs text-[var(--color-text-muted)] truncate">{t.note}</p>}
                      <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(t.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn('text-sm font-bold tabular-nums', credit ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]')}>
                        {credit ? '+' : '−'}{formatMoney(Math.abs(Number(t.amount) || 0))}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Qoldiq: {formatMoney(t.balanceAfter)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-[var(--color-text-muted)] shrink-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {adding && <TopupSheet onClose={() => setAdding(false)} />}

      {detailTx && (
        <TxDetailSheet
          tx={detailTx}
          onClose={() => setDetailTx(null)}
          onZoom={(url) => setReceipt(url)}
        />
      )}

      {/* Chek rasmi (lightbox) */}
      {receipt && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm grid place-items-center p-4"
          onClick={() => setReceipt(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receipt}
            alt="chek"
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setReceipt(null)}
            className="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
            aria-label="Yopish"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="text-right font-medium break-words">{value}</span>
    </div>
  );
}

/** Tranzaksiya to'liq ma'lumoti — summa, izoh, sana, qoldiq + chek rasmi. */
function TxDetailSheet({
  tx,
  onClose,
  onZoom,
}: {
  tx: WalletTransaction;
  onClose: () => void;
  onZoom: (url: string) => void;
}) {
  const credit = isCredit(tx);
  return (
    <Sheet open onClose={onClose} title="Tranzaksiya">
      <div className="space-y-4 pb-2">
        {/* Summa */}
        <div className="pt-1 text-center">
          <p
            className={cn(
              'text-3xl font-extrabold tabular-nums',
              credit ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]',
            )}
          >
            {credit ? '+' : '−'}
            {formatMoney(Math.abs(Number(tx.amount) || 0))}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{txTitle(tx)}</p>
        </div>

        {/* Tafsilotlar */}
        <div className="rounded-2xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] text-sm">
          <DetailRow label="Turi" value={txTitle(tx)} />
          {tx.note && <DetailRow label="Izoh" value={tx.note} />}
          <DetailRow label="Sana" value={formatDateTime(tx.createdAt)} />
          <DetailRow label="Balansdagi qoldiq" value={formatMoney(tx.balanceAfter)} />
        </div>

        {/* Chek rasmi */}
        {tx.receiptUrl && (
          <div>
            <p className="mb-1.5 text-sm font-medium">To&apos;lov cheki</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tx.receiptUrl}
              alt="chek"
              onClick={() => onZoom(tx.receiptUrl!)}
              className="w-full max-h-72 rounded-xl object-contain border border-[var(--color-border)] bg-[var(--color-bg)] cursor-zoom-in"
            />
            <p className="mt-1 text-center text-xs text-[var(--color-text-muted)]">
              Kattalashtirish uchun bosing
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function TopupSheet({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<'CARD' | 'CRYPTO'>('CARD');
  const [amountText, setAmountText] = useState('');
  const [tonText, setTonText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const amount = parseMoneyInput(amountText);

  const { data: card } = useQuery({ queryKey: ['wallet-card'], queryFn: apiWalletCard });
  const { data: crypto } = useQuery({ queryKey: ['wallet-crypto'], queryFn: apiWalletCrypto });
  const cardDigits = (card?.cardNumber ?? '').replace(/\D/g, '');
  const brand = cardDigits.startsWith('8600')
    ? 'UZCARD'
    : cardDigits.startsWith('9860')
      ? 'HUMO'
      : 'BANK';
  // Kripto: TON miqdori -> so'm (jonli kurs). Karta: to'g'ridan-to'g'ri so'm.
  const tonAmount = Number(tonText.replace(',', '.')) || 0;
  const tonPriceUzs = crypto?.tonPriceUzs ?? 0;
  const somFromTon = Math.round(tonAmount * tonPriceUzs);
  const somAmount = method === 'CARD' ? amount : somFromTon; // to'lov summasi (so'm)
  // Komissiya: karta -> feePercent (default 2%), kripto -> 0%.
  const feePercent = method === 'CARD' ? (card?.feePercent ?? 2) : 0;
  const fee = Math.round((somAmount * feePercent) / 100);
  const net = somAmount - fee; // hamyonga qo'shiladigan sof summa

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function copyText(text: string) {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const submit = useMutation({
    mutationFn: () =>
      apiWalletTopupReceipt(
        somAmount,
        file!,
        method,
        method === 'CRYPTO' ? tonAmount : undefined,
      ),
    onSuccess: () => {
      toast.success("So'rov yuborildi — administrator tasdiqlashini kuting");
      qc.invalidateQueries({ queryKey: ['wallet-topups'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = somAmount >= 1000 && !!file;

  return (
    <Sheet open onClose={onClose} title="Balansni to'ldirish">
      <div className="space-y-4">
        {/* Usul tanlash: Karta / Kripto */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--color-bg)] p-1">
          <button
            type="button"
            onClick={() => setMethod('CARD')}
            className={cn(
              'py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
              method === 'CARD'
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)]',
            )}
          >
            <CreditCard size={15} /> Karta
          </button>
          <button
            type="button"
            onClick={() => setMethod('CRYPTO')}
            className={cn(
              'py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
              method === 'CRYPTO'
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)]',
            )}
          >
            <Gem size={15} /> Kripto
          </button>
        </div>

        {method === 'CARD' ? (
          /* ── Plastik karta ── */
          <div>
            <p className="mb-1.5 text-sm font-medium">Shu kartaga o&apos;tkazing</p>
            <div
              className="relative w-full aspect-[1.6/1] rounded-2xl p-4 sm:p-5 text-white overflow-hidden shadow-xl shadow-black/25 select-none"
              style={{ background: 'linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)' }}
            >
              {/* yorug'lik/gloss */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(130% 130% at 0% 0%, rgba(255,255,255,.14), transparent 42%)' }}
              />
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-40 rotate-[25deg] bg-white/5 blur-2xl" />

              {/* Yuqori: brend + kontaktsiz + nusxalash */}
              <div className="relative flex items-start justify-between">
                <span className="text-sm font-bold tracking-[0.2em] opacity-90">{brand}</span>
                <div className="flex items-center gap-2">
                  <svg width="18" height="22" viewBox="0 0 18 22" fill="none" className="opacity-80" aria-hidden>
                    <path d="M4 7a7 7 0 0 1 0 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M7.5 4.5a11 11 0 0 1 0 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M11 2a15 15 0 0 1 0 18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <button
                    onClick={() => copyText(cardDigits)}
                    className="h-8 w-8 grid place-items-center rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 shrink-0"
                    aria-label="Nusxalash"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* Chip */}
              <div className="relative mt-3 sm:mt-4">
                <svg width="44" height="33" viewBox="0 0 46 34" fill="none" aria-hidden>
                  <rect x="1" y="1" width="44" height="32" rx="6" fill="url(#chipg)" stroke="#b4890f" strokeOpacity=".4" />
                  <path d="M16 1v32M30 1v32M1 12h44M1 22h44" stroke="#8a6d0b" strokeOpacity=".45" strokeWidth="1" />
                  <rect x="16" y="12" width="14" height="10" rx="2" fill="#fde68a" fillOpacity=".7" stroke="#8a6d0b" strokeOpacity=".4" />
                  <defs>
                    <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
                      <stop stopColor="#fde68a" />
                      <stop offset="1" stopColor="#caa02c" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Raqam */}
              <p
                className="relative mt-3 sm:mt-4 text-xl sm:text-2xl font-semibold tracking-[0.14em] tabular-nums"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
              >
                {card?.cardNumber ?? '•••• •••• •••• ••••'}
              </p>

              {/* Egasi */}
              <div className="relative mt-2 sm:mt-3">
                <p className="text-[9px] uppercase tracking-widest opacity-55">Karta egasi</p>
                <p className="text-sm font-medium uppercase tracking-wide truncate">
                  {card?.cardHolder ?? '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Kripto (TON) karta ── */
          <div>
            <p className="mb-1.5 text-sm font-medium">Shu manzilga USDT yoki TON yuboring</p>
            <div
              // Balandlik QAT'IY emas: TON manzili uzun va tor ekranda 3 qatorga
              // bo'linishi mumkin — aspect-ratio bilan qulflansa matn kesilardi.
              className="relative w-full min-h-[212px] rounded-2xl p-4 sm:p-5 text-white overflow-hidden shadow-xl shadow-black/25 select-none flex flex-col"
              style={{ background: 'linear-gradient(135deg,#0098EA 0%,#0062E0 55%,#0b1f3a 100%)' }}
            >
              {/* yorug'lik/gloss — plastik karta bilan bir xil */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: 'radial-gradient(130% 130% at 0% 0%, rgba(255,255,255,.16), transparent 42%)' }}
              />
              <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-40 rotate-[25deg] bg-white/10 blur-2xl" />
              {/* TON olmos suv belgisi */}
              <svg
                className="pointer-events-none absolute -right-6 -bottom-8 h-40 w-40 opacity-[0.13]"
                viewBox="0 0 24 24"
                fill="white"
                aria-hidden
              >
                <path d="M12 22 2.5 8.5h19L12 22ZM4.8 7 12 2l7.2 5H4.8Z" />
              </svg>

              {/* Yuqori: brend + tarmoq + nusxalash */}
              <div className="relative flex items-start justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-[0.14em]">
                  <Gem size={17} /> TON
                </span>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/15 backdrop-blur px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                    {crypto?.assets ?? 'USDT · TON'}
                  </span>
                  <button
                    onClick={() => copyText(crypto?.address ?? '')}
                    className="h-8 w-8 grid place-items-center rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 active:scale-95 transition shrink-0"
                    aria-label="Manzilni nusxalash"
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* Tarmoq yorlig'i — chip o'rnida */}
              <div className="relative mt-3 sm:mt-4">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/12 backdrop-blur px-2 py-1 text-[10px] font-semibold uppercase tracking-widest ring-1 ring-inset ring-white/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  TON tarmog&apos;i
                </span>
              </div>

              {/* Manzil — karta raqami o'rnida */}
              <div className="relative mt-auto">
                <p className="text-[9px] uppercase tracking-widest opacity-55">Hamyon manzili</p>
                <p
                  className="mt-1 break-all font-mono text-[12.5px] sm:text-[13.5px] leading-snug font-medium"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
                >
                  {crypto?.address ?? '••••••••••••••••••••••••'}
                </p>
              </div>

              {/* Pastki qator: nusxalash tugmasi */}
              <button
                onClick={() => copyText(crypto?.address ?? '')}
                disabled={!crypto?.address}
                className="relative mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/15 backdrop-blur px-3 py-2 text-xs font-semibold hover:bg-white/25 active:scale-[0.98] transition disabled:opacity-50"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Nusxalandi ✓' : 'Manzilni nusxalash'}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
              ⚠️ Faqat <b>TON tarmog&apos;i</b> orqali yuboring (USDT-TON yoki TON). Yuborgach —
              tranzaksiya <b>screenshot</b>ini quyiga yuklang.
            </p>
          </div>
        )}

        {method === 'CARD' ? (
          <Field label="Qancha to'laysiz? (so'm)" hint="Kartaga o'tkazadigan summangiz">
            <Input
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(formatMoneyInput(parseMoneyInput(e.target.value)))}
              placeholder="100 000"
            />
          </Field>
        ) : (
          <Field
            label="Necha TON yuborasiz?"
            hint={
              tonPriceUzs > 0
                ? `1 TON ≈ ${formatMoney(tonPriceUzs)} (jonli kurs)`
                : 'TON kursi yuklanmoqda…'
            }
          >
            <Input
              inputMode="decimal"
              value={tonText}
              onChange={(e) => setTonText(e.target.value.replace(/[^0-9.,]/g, ''))}
              placeholder="5"
            />
          </Field>
        )}

        {/* Komissiya + hamyonga tushadigan sof summa */}
        {somAmount > 0 && (
          <div className="-mt-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm space-y-1">
            {method === 'CARD' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">To&apos;lov summasi</span>
                  <span className="font-medium tabular-nums">{formatMoney(somAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Komissiya ({feePercent}%)</span>
                  <span className="font-medium tabular-nums text-[var(--color-danger)]">
                    −{formatMoney(fee)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Yuborasiz</span>
                  <span className="font-medium tabular-nums">{tonAmount} TON</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Qiymati</span>
                  <span className="font-medium tabular-nums">≈ {formatMoney(somFromTon)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)]">Komissiya</span>
                  <span className="font-medium text-[var(--color-success)]">0% · bepul</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 mt-1.5">
              <span className="font-semibold">Hamyonga qo&apos;shiladi</span>
              <span className="font-bold tabular-nums text-[var(--color-success)]">
                {formatMoney(net)}
              </span>
            </div>
          </div>
        )}

        {/* Chek yuklash */}
        <div>
          <p className="mb-1.5 text-sm font-medium">To&apos;lov cheki (rasm)</p>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
          {preview ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="chek" className="w-full max-h-64 rounded-xl object-contain border border-[var(--color-border)] bg-[var(--color-bg)]" />
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-black/60 text-white"
                aria-label="O'chirish"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-[var(--color-border)] py-8 grid place-items-center gap-2 text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            >
              <Upload size={22} />
              <span className="text-sm font-medium">Chek rasmini yuklash</span>
            </button>
          )}
        </div>

        <Button fullWidth loading={submit.isPending} disabled={!valid} onClick={() => submit.mutate()}>
          So&apos;rov yuborish
        </Button>
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          Tasdiqlangach summa avtomatik hamyoningizga qo&apos;shiladi.
        </p>
      </div>
    </Sheet>
  );
}
