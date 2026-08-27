'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Upload, Store, Bot, Crown, Copy, CreditCard, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { VegaMark } from '@/components/brand';
import { toast } from '@/stores/toast-store';
import { setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';
import { getDeviceId } from '@/lib/device';
import { TariffCarousel } from '@/components/tariff-carousel';
import {
  apiSellerOnboard,
  apiSellerPaymentInfo,
  apiSellerSubmitPayment,
  apiSellerTariffs,
  apiSellerUploadLogo,
  apiSellerValidateBot,
  apiTelegramLogin,
  type LoginMode,
  type PaymentInfo,
  type TariffOption,
  tariffPrice,
} from '@/lib/endpoints';

interface TgUser {
  first_name?: string;
  last_name?: string;
}
interface TgWebApp {
  initData: string;
  initDataUnsafe?: { user?: TgUser };
  ready?: () => void;
  expand?: () => void;
}
declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const SDK_URL = 'https://telegram.org/js/telegram-web-app.js';
const BOT_URL = 'https://t.me/vegastorebot';

function loadTelegramSdk(): Promise<TgWebApp | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.Telegram?.WebApp) return resolve(window.Telegram.WebApp);
    const done = () => resolve(window.Telegram?.WebApp ?? null);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', done);
      return;
    }
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onload = done;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

const STEPS = ["Do'kon", 'Tarif', 'Bot'];

/** O'zbek raqamini "+998 98 765 43 21" ko'rinishida formatlaydi. */
function formatUzPhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9); // operator (2) + raqam (7)
  if (d.length === 0) return '';
  let out = '+998';
  if (d.length > 0) out += ' ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += ' ' + d.slice(5, 7);
  if (d.length > 7) out += ' ' + d.slice(7, 9);
  return out;
}

export default function RegisterPage() {
  const router = useRouter();
  const setAdmin = useAuthStore((s) => s.setAdmin);

  const [phase, setPhase] = useState<'loading' | 'wizard' | 'no-telegram' | 'payment' | 'blocked'>('loading');
  const [blockedMsg, setBlockedMsg] = useState('');
  const [step, setStep] = useState(1);
  const [initData, setInitData] = useState('');

  const [tariffs, setTariffs] = useState<TariffOption[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);

  // Step 1
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  // Step 2
  const [tariff, setTariff] = useState('FREE');
  // Step 3
  const [botToken, setBotToken] = useState('');
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [checkingBot, setCheckingBot] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // To'lov bosqichi
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wa = await loadTelegramSdk();
      if (cancelled) return;
      wa?.ready?.();
      wa?.expand?.();

      const id = wa?.initData ?? '';
      if (!id) {
        setPhase('no-telegram');
        return;
      }
      setInitData(id);

      const u = wa?.initDataUnsafe?.user;
      if (u) setOwnerName([u.first_name, u.last_name].filter(Boolean).join(' ').trim());

      apiSellerTariffs().then((t) => !cancelled && setTariffs(t)).catch(() => undefined);
      apiSellerPaymentInfo().then((p) => !cancelled && setPaymentInfo(p)).catch(() => undefined);

      // Bot rejimi: /start → owner, /creator → creator, /moderator → moderator.
      const m = new URLSearchParams(window.location.search).get('mode');
      const mode: LoginMode | undefined =
        m === 'creator' || m === 'moderator' || m === 'owner' ? m : undefined;
      const teamMode = mode === 'creator' || mode === 'moderator';

      // Avval to'g'ridan-to'g'ri login — EGASI yoki JAMOA a'zosi (creator/moderator/
      // manager) bo'lsa shu yerda kiradi. Faqat yangi foydalanuvchi onboarding'ga tushadi.
      try {
        const res = await apiTelegramLogin(id, mode);
        if (cancelled) return;
        setAccessToken(res.accessToken);
        setAdmin(res.admin);
        // Creator faqat narxlar/takliflar bilan ishlaydi — dashboard'ga emas.
        router.replace(res.admin.role === 'CREATOR' ? '/offers' : '/');
        return;
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error).message ?? '';
        // Jamoa rejimida (creator/moderator) yoki tarif faol bo'lmasa — wizard ko'rsatmaymiz.
        if (teamMode || /tarif|faol emas/i.test(msg)) {
          setBlockedMsg(msg);
          setPhase('blocked');
          return;
        }
        // Aks holda — ro'yxatdan o'tmagan yangi foydalanuvchi → onboarding wizard.
      }
      if (!cancelled) setPhase('wizard');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPickLogo(file: File | undefined) {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function nextFromStep1() {
    if (!shopName.trim() || !ownerName.trim() || !phone.trim()) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    setStep(2);
  }

  async function checkBot() {
    if (!botToken.trim()) return;
    setCheckingBot(true);
    setBotUsername(null);
    try {
      const res = await apiSellerValidateBot(botToken.trim());
      if (res.ok && res.username) {
        setBotUsername(res.username);
        toast.success(`Bot topildi: @${res.username}`);
      } else {
        toast.error(res.error ?? 'Bot token yaroqsiz');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCheckingBot(false);
    }
  }

  async function finish(skipBot: boolean) {
    setSubmitting(true);
    try {
      const token = skipBot ? undefined : botToken.trim() || undefined;
      if (token && !botUsername) {
        const check = await apiSellerValidateBot(token);
        if (!check.ok) {
          toast.error(check.error ?? 'Bot token yaroqsiz');
          setSubmitting(false);
          return;
        }
      }

      let logoUrl: string | undefined;
      if (logoFile) {
        try {
          const up = await apiSellerUploadLogo(logoFile);
          logoUrl = up.url;
        } catch {
          toast.error('Logo yuklanmadi — Vega standart logosi qoldiriladi');
        }
      }

      // Referal kod — URL ?ref= yoki Telegram start_param (ref<KOD>)
      const ref = (() => {
        try {
          const fromUrl = new URLSearchParams(window.location.search).get('ref') ?? '';
          const sp =
            (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } })
              .Telegram?.WebApp?.initDataUnsafe?.start_param ?? '';
          const fromStart = sp.startsWith('ref') ? sp.slice(3) : '';
          return fromUrl || fromStart || undefined;
        } catch {
          return undefined;
        }
      })();

      await apiSellerOnboard({
        initData,
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: phone.trim(),
        tariffPlan: tariff,
        logoUrl,
        botToken: token,
        ref,
        deviceId: getDeviceId(),
      });
      const res = await apiTelegramLogin(initData);
      setAccessToken(res.accessToken);
      setAdmin(res.admin);

      if (tariff !== 'FREE') {
        // Pulli tarif — to'lov sahifasiga o'tamiz (do'kon hozircha Free'da)
        toast.success("Do'koningiz yaratildi! 🎉");
        setPhase('payment');
      } else {
        toast.success("Do'koningiz yaratildi! 🎉");
        router.replace('/');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Nusxa olindi');
    } catch {
      toast.error('Nusxa olishda xato');
    }
  }

  function onPickReceipt(file: File | undefined) {
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  }

  async function submitReceipt() {
    if (!receiptFile) {
      toast.error('Chek rasmini tanlang');
      return;
    }
    setSendingReceipt(true);
    try {
      await apiSellerSubmitPayment(initData, receiptFile);
      setReceiptSent(true);
      toast.success('Chek yuborildi! Tasdiqlashni kuting.');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingReceipt(false);
    }
  }

  const selectedTariff = tariffs.find((t) => t.value === tariff);

  if (phase === 'loading') {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-10 w-10 border-4 border-gray-200 border-t-[var(--color-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  if (phase === 'no-telegram') {
    return (
      <div className="min-h-dvh grid place-items-center px-4 text-center">
        <div className="max-w-sm">
          <div className="flex justify-center mb-3">
            <VegaMark size={56} />
          </div>
          <h1 className="text-lg font-bold mb-1">Telegram orqali oching</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Ro&apos;yxatdan o&apos;tish Vega bot ichida ishlaydi. Quyidagi tugma orqali botni oching.
          </p>
          <a href={BOT_URL} className="inline-block">
            <Button>Vega botini ochish</Button>
          </a>
        </div>
      </div>
    );
  }

  if (phase === 'blocked') {
    return (
      <div className="min-h-dvh grid place-items-center px-4 text-center">
        <div className="max-w-sm">
          <div className="flex justify-center mb-3">
            <VegaMark size={56} />
          </div>
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-500">
            <CreditCard size={22} />
          </div>
          <h1 className="text-lg font-bold mb-1">Do&apos;kon tarifi faol emas</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {blockedMsg || "Egasi tarifni yangilagach, panel funksiyalaridan foydalana olasiz."}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'payment') {
    return (
      <div className="min-h-dvh px-4 py-8 bg-gradient-to-br from-[var(--color-bg)] to-blue-50">
        <div className="w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-5">
            <VegaMark size={44} className="mb-2" />
            <h1 className="text-xl font-bold tracking-tight">To&apos;lov</h1>
            <p className="text-sm text-[var(--color-text-muted)]">Tarifni faollashtirish uchun</p>
          </div>

          <div className="bg-white rounded-3xl border border-[var(--color-border)] p-6 shadow-sm space-y-4">
            {selectedTariff && (
              <div className="rounded-2xl bg-[var(--color-primary)]/[0.05] border border-[var(--color-primary)]/20 p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Tanlangan tarif</p>
                <p className="font-bold">{selectedTariff.label}</p>
                <p className="text-2xl font-extrabold tracking-tight mt-0.5">
                  {tariffPrice(selectedTariff).toLocaleString('ru-RU')}
                  <span className="text-sm font-medium text-[var(--color-text-muted)]"> so'm</span>
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <CreditCard size={18} className="text-[var(--color-primary)]" />
              <h2 className="font-semibold">Karta orqali to'lov</h2>
            </div>

            <div className="space-y-2">
              {paymentInfo?.cards.map((c, i) => (
                <div
                  key={`${c.type}-${i}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-text-muted)]">{c.type}</p>
                    <p className="font-mono font-semibold tracking-wider">{c.number}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(c.number.replace(/\s/g, ''))}
                    className="h-9 w-9 grid place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0"
                    aria-label="Nusxa olish"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              ))}
              {paymentInfo && (
                <div className="rounded-xl border border-[var(--color-border)] p-3">
                  <p className="text-xs text-[var(--color-text-muted)]">Karta egasi</p>
                  <p className="font-semibold">{paymentInfo.holder}</p>
                </div>
              )}
            </div>

            {paymentInfo && (
              <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                {paymentInfo.confirmNote}
              </p>
            )}

            {receiptSent ? (
              <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center">
                <div className="inline-flex h-10 w-10 rounded-full bg-green-500 text-white items-center justify-center mb-2">
                  <Check size={20} />
                </div>
                <p className="font-semibold text-green-700">Chek yuborildi!</p>
                <p className="text-[13px] text-green-700/80 mt-1">
                  Tasdiqlash 2–30 daqiqa davom etadi. Tasdiqlanguncha tekin versiyadan
                  foydalanib turing.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Send size={18} className="text-[var(--color-primary)]" />
                  <h2 className="font-semibold">To'lov chekini yuboring</h2>
                </div>
                <label className="flex items-center gap-3 h-16 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                  {receiptPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={receiptPreview} alt="chek" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <span className="inline-flex h-12 w-12 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
                      <Upload size={20} />
                    </span>
                  )}
                  <span className="text-sm text-[var(--color-text-muted)] truncate">
                    {receiptFile ? receiptFile.name : 'Chek rasmini tanlash (PNG/JPG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => onPickReceipt(e.target.files?.[0])}
                  />
                </label>
                <Button
                  fullWidth
                  size="lg"
                  loading={sendingReceipt}
                  disabled={!receiptFile}
                  onClick={submitReceipt}
                >
                  Tasdiqlashga yuborish
                </Button>
              </>
            )}

            <button
              type="button"
              onClick={() => router.replace('/')}
              className="w-full text-center text-sm text-[var(--color-text-muted)] py-1"
            >
              {receiptSent ? 'Panelga o\'tish →' : 'Hozircha tekin versiyada davom etish →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh px-4 py-6 bg-gradient-to-br from-[var(--color-bg)] to-blue-50">
      <div className="w-full max-w-md mx-auto">
        {/* Brand + stepper */}
        <div className="flex flex-col items-center mb-5">
          <VegaMark size={44} className="mb-2" />
          <h1 className="text-xl font-bold tracking-tight">Vega</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Do&apos;koningizni oching</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-5">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                    active && 'bg-[var(--color-primary)] text-white',
                    done && 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
                    !active && !done && 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]',
                  )}
                >
                  <span className="grid place-items-center h-4 w-4 rounded-full bg-white/25 text-[10px]">
                    {done ? <Check size={11} /> : n}
                  </span>
                  {label}
                </div>
                {n < STEPS.length && <span className="w-3 h-px bg-[var(--color-border)]" />}
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-3xl border border-[var(--color-border)] p-6 shadow-sm">
          {/* ── STEP 1: Do'kon ma'lumotlari ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Store size={18} className="text-[var(--color-primary)]" />
                <h2 className="font-semibold">Do'kon ma'lumotlari</h2>
              </div>

              <Field label="Do'kon nomi *">
                <Input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Masalan: Bek Store"
                  maxLength={80}
                />
              </Field>
              <Field label="Ismingiz *">
                <Input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ism Familiya"
                  maxLength={80}
                />
              </Field>
              <Field label="Telefon raqam *">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatUzPhone(e.target.value))}
                  placeholder="+998 98 765 43 21"
                  maxLength={17}
                />
              </Field>
              <Field label="Logo (ixtiyoriy)" hint="Bo'lmasa Vega standart logosi ishlatiladi">
                <label className="flex items-center gap-3 h-14 px-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white cursor-pointer">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="logo" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <span className="inline-flex h-10 w-10 rounded-lg bg-[var(--color-bg)] items-center justify-center text-[var(--color-text-muted)]">
                      <Upload size={18} />
                    </span>
                  )}
                  <span className="text-sm text-[var(--color-text-muted)] truncate">
                    {logoFile ? logoFile.name : 'Rasm tanlash (PNG/JPG)'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => onPickLogo(e.target.files?.[0])}
                  />
                </label>
              </Field>

              <Button fullWidth size="lg" onClick={nextFromStep1}>
                Keyingi
              </Button>
            </div>
          )}

          {/* ── STEP 2: Tarif ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Crown size={18} className="text-[var(--color-primary)]" />
                <h2 className="font-semibold">Tarifni tanlang</h2>
              </div>

              <p className="text-xs text-[var(--color-text-muted)] -mt-1">
                Tariflar avtomatik aylanadi — qo'lda surib yoki strelkalar bilan ham tanlashingiz mumkin.
              </p>

              <TariffCarousel tariffs={tariffs} value={tariff} onChange={setTariff} />

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" fullWidth size="lg" onClick={() => setStep(1)}>
                  Orqaga
                </Button>
                <Button fullWidth size="lg" onClick={() => setStep(3)}>
                  Keyingi
                </Button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Bot ── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Bot size={18} className="text-[var(--color-primary)]" />
                <h2 className="font-semibold">Telegram botingizni ulang</h2>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] -mt-1">
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] font-medium"
                >
                  @BotFather
                </a>
                'da <span className="font-medium">/newbot</span> orqali bot yarating va tokenni nusxalang.
                Bu — mijozlaringiz do'koningizni ochadigan bot.
              </p>

              <Field label="Bot token (ixtiyoriy)">
                <div className="flex gap-2">
                  <Input
                    value={botToken}
                    onChange={(e) => {
                      setBotToken(e.target.value);
                      setBotUsername(null);
                    }}
                    placeholder="123456:ABC-DEF…"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <Button
                    variant="secondary"
                    onClick={checkBot}
                    loading={checkingBot}
                    disabled={!botToken.trim()}
                  >
                    Tekshirish
                  </Button>
                </div>
              </Field>
              {botUsername && (
                <p className="flex items-center gap-1.5 text-sm text-[var(--color-primary)] font-medium">
                  <Check size={15} /> @{botUsername} ulanadi
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" fullWidth size="lg" onClick={() => setStep(2)}>
                  Orqaga
                </Button>
                <Button fullWidth size="lg" loading={submitting} onClick={() => finish(false)}>
                  Yakunlash
                </Button>
              </div>
              <button
                type="button"
                onClick={() => finish(true)}
                disabled={submitting}
                className="w-full text-center text-sm text-[var(--color-text-muted)] py-1 disabled:opacity-50"
              >
                Botni keyinroq ulayman →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
