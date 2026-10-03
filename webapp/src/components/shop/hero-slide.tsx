import { Globe2, ShieldCheck, Zap } from 'lucide-react';
import type { Locale } from '@/i18n';

/**
 * Bosh sahifa karuselining birinchi slaydi — rasm emas, kod bilan chizilgan
 * banner: yengil, har qanday ekranda tiniq, slayd balandligiga moslashadi.
 */
export function HeroSlide({ locale }: { locale: Locale }) {
  const ru = locale === 'ru';
  return (
    <div className="relative flex h-full overflow-hidden bg-[linear-gradient(135deg,#2563EB_0%,#1E40AF_48%,#0B1440_100%)] text-white">
      {/* ── Fon ── */}
      <div className="pointer-events-none absolute -left-10 -top-16 h-44 w-44 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[8%] top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-indigo-400/40 blur-3xl" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(white 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          maskImage: 'linear-gradient(90deg, transparent 0%, black 55%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 55%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/10" />

      {/* ── Chap: matn ── */}
      <div className="relative z-10 flex w-[57%] flex-col justify-center py-4 pl-5">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-2.5 py-[3px] text-[10px] font-extrabold uppercase tracking-wider text-[#3b2600] shadow-[0_4px_14px_rgba(251,191,36,0.45)]">
          <Zap size={11} className="fill-current" />
          {ru ? 'Мгновенно' : 'Tezkor'}
        </span>

        <h2 className="mt-2.5 text-[25px] font-black leading-[1.02] tracking-tight">
          {ru ? 'Виртуальные' : 'Virtual'}
          <br />
          <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 bg-clip-text text-transparent">
            {ru ? 'номера' : 'raqamlar'}
          </span>
        </h2>

        <p className="mt-1.5 text-[12px] font-medium text-white/75">
          {ru ? 'SMS-код приходит за секунды' : 'SMS kod soniyalarda keladi'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10.5px] font-semibold backdrop-blur-sm">
            <Globe2 size={11} className="text-sky-200" />
            {ru ? '200+ стран' : '200+ davlat'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10.5px] font-semibold backdrop-blur-sm">
            <ShieldCheck size={11} className="text-emerald-300" />
            24/7
          </span>
        </div>
      </div>

      {/* ── O'ng: telefon ── */}
      <div className="relative z-10 flex w-[43%] items-center justify-center">
        <div className="hero-float relative h-[80%] max-h-[178px] w-[64%] max-w-[106px]">
          {/* korpus */}
          <div className="absolute inset-0 rotate-[7deg] rounded-[20px] bg-gradient-to-b from-slate-200/80 to-slate-400/60 p-[3px] shadow-[0_22px_45px_-10px_rgba(0,0,0,0.6)]">
            <div className="relative h-full overflow-hidden rounded-[17px] bg-gradient-to-b from-[#132257] to-[#0A1235]">
              <div className="mx-auto mt-1.5 h-[5px] w-8 rounded-full bg-black/60" />
              {/* ilovalar to'ri */}
              <div className="mt-[34%] grid grid-cols-2 gap-1.5 px-2.5 opacity-90">
                {(['telegram', 'whatsapp', 'instagram', 'gmail'] as const).map((a) => (
                  <div
                    key={a}
                    className="grid aspect-square place-items-center rounded-[9px] bg-white/[0.08] ring-1 ring-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/brands/${a}.svg`} alt="" className="h-[55%] w-[55%]" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.07] to-transparent" />
            </div>
          </div>

          {/* kelgan SMS bildirishnomasi */}
          <div className="hero-pop absolute -left-[38%] top-[16%] w-[118%] -rotate-[3deg]">
            <div className="flex items-center gap-1.5 rounded-[12px] bg-white/95 p-1.5 pr-2 text-[#0B1440] shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5)] ring-1 ring-black/5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] bg-[#26A5E4]/12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brands/telegram.svg" alt="" className="h-4 w-4" />
              </span>
              <span className="min-w-0 leading-none">
                <span className="block text-[7.5px] font-semibold uppercase tracking-wide text-slate-500">
                  Telegram · {ru ? 'код' : 'kod'}
                </span>
                <span className="mt-[3px] block text-[14px] font-black tabular-nums tracking-[0.14em]">
                  48213
                </span>
              </span>
            </div>
          </div>

          {/* suzuvchi ikonalar */}
          <span className="hero-float-slow absolute -right-[22%] bottom-[10%] grid h-7 w-7 place-items-center rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brands/whatsapp.svg" alt="" className="h-4 w-4" />
          </span>
          <span className="absolute -right-[16%] -top-[6%] text-[16px] text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">
            ✦
          </span>
          <span className="absolute -left-[22%] bottom-[2%] text-[10px] text-sky-200/80">✦</span>
        </div>
      </div>
    </div>
  );
}
