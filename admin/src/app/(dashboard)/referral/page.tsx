'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gift, Copy, Wallet, Users, CreditCard, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiReferral, apiReferralWithdraw } from '@/lib/endpoints';
import { formatMoney } from '@/lib/format';
import { toast } from '@/stores/toast-store';

const WITHDRAW_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Kutilmoqda', cls: 'bg-amber-50 text-amber-600' },
  PAID: { label: "To'landi", cls: 'bg-emerald-50 text-emerald-600' },
  REJECTED: { label: 'Rad etildi', cls: 'bg-red-50 text-red-600' },
};

const PLAN_LABEL: Record<string, string> = { STANDARD: 'Standart', PRO: 'Pro', PREMIUM: 'Premium', FREE: 'Free' };

export default function ReferralPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['referral'], queryFn: apiReferral });

  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');

  const withdraw = useMutation({
    mutationFn: () => apiReferralWithdraw({ cardNumber: cardNumber.trim(), cardHolder: cardHolder.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['referral'] });
      setCardNumber('');
      setCardHolder('');
      toast.success("Yechish so'rovi yuborildi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async () => {
    if (!data?.link) return;
    try {
      await navigator.clipboard.writeText(data.link);
      toast.success('Havola nusxalandi');
    } catch {
      toast.error('Nusxalab bo\'lmadi');
    }
  };

  return (
    <div className="pb-10">
      <PageHeader title="Referal" description="Do'kon taklif qiling — har to'lovidan ulush oling" />

      <div className="w-full md:max-w-2xl md:mx-auto space-y-3">
        {isLoading || !data ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </>
        ) : (
          <>
            {/* Balans */}
            <Card>
              <CardBody className="space-y-3">
                <div className="rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-600 p-4 text-white shadow-sm">
                  <p className="text-xs opacity-80 flex items-center gap-1.5">
                    <Wallet size={14} /> Referal balansi
                  </p>
                  <p className="mt-1 text-3xl font-extrabold">{formatMoney(data.balance)}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                    <p className="text-lg font-bold leading-none">{formatMoney(data.earnedTotal)}</p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Jami daromad</p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] p-3 text-center">
                    <p className="text-lg font-bold leading-none flex items-center justify-center gap-1">
                      <Users size={15} /> {data.referralsCount}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Taklif qilingan</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] flex items-start gap-1.5">
                  <Gift size={14} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                  <span>
                    Havolangiz orqali qo&apos;shilgan do&apos;kon tarif to&apos;laganda — har to&apos;lovidan{' '}
                    <b className="text-[var(--color-text)]">{data.commissionPercent}%</b> sizning balansingizga tushadi.
                  </span>
                </p>
              </CardBody>
            </Card>

            {/* Referal havola */}
            <Card>
              <CardHeader title="Referal havolangiz" />
              <CardBody className="space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                  <span className="font-mono text-xs truncate flex-1">{data.link}</span>
                  <button onClick={copyLink} className="shrink-0 inline-flex items-center gap-1 text-[var(--color-primary)] text-xs font-semibold">
                    <Copy size={14} /> Nusxa
                  </button>
                </div>
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent("Vega'da o'z Telegram do'koningizni oching!")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  <Button fullWidth variant="secondary">
                    <Send size={16} /> Telegramda ulashish
                  </Button>
                </a>
              </CardBody>
            </Card>

            {/* Kartaga yechish */}
            <Card>
              <CardHeader title="Kartaga yechish" />
              <CardBody className="space-y-3">
                {data.hasPendingWithdrawal ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
                    Sizda kutilayotgan yechish so&apos;rovi bor. Ko&apos;rib chiqilgach yangisini yubora olasiz.
                  </div>
                ) : data.balance < data.minWithdrawal ? (
                  <div className="rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2.5 text-xs text-[var(--color-text-muted)]">
                    Kartaga yechish uchun kamida <b className="text-[var(--color-text)]">{formatMoney(data.minWithdrawal)}</b> kerak.
                    Hozir: {formatMoney(data.balance)}.
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-700">
                      <b>{formatMoney(data.balance)}</b> yechish mumkin. Karta raqamingizni kiriting.
                    </div>
                    <Field label="Karta raqami">
                      <Input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
                        placeholder="8600 1234 5678 9012"
                        inputMode="numeric"
                        className="font-mono"
                      />
                    </Field>
                    <Field label="Karta egasi (ixtiyoriy)">
                      <Input value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="ISM FAMILIYA" />
                    </Field>
                    <Button
                      loading={withdraw.isPending}
                      disabled={cardNumber.replace(/\D/g, '').length < 12}
                      onClick={() => withdraw.mutate()}
                    >
                      <CreditCard size={16} /> Yechish so&apos;rovi
                    </Button>
                  </>
                )}
              </CardBody>
            </Card>

            {/* Daromad tarixi */}
            {data.earnings.length > 0 && (
              <Card>
                <CardHeader title="Daromad tarixi" />
                <CardBody className="divide-y divide-[var(--color-border)] py-0">
                  {data.earnings.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.shopName}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          {PLAN_LABEL[e.plan] ?? e.plan} · {e.percent}% · {new Date(e.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 shrink-0">+{formatMoney(e.amount)}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}

            {/* Yechishlar */}
            {data.withdrawals.length > 0 && (
              <Card>
                <CardHeader title="Yechishlar" />
                <CardBody className="divide-y divide-[var(--color-border)] py-0">
                  {data.withdrawals.map((w) => {
                    const st = WITHDRAW_STATUS[w.status] ?? WITHDRAW_STATUS.PENDING;
                    return (
                      <div key={w.id} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatMoney(w.amount)}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">{w.cardNumber}</p>
                        </div>
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
