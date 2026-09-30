import Link from "next/link";
import { PRODUCTS } from "@/lib/catalog";

const FEATURES = [
  { icon: "✈️", title: "Telegram raqam", text: "Tayyor akkaunt, kirish kodi saytda — 60 davlat" },
  { icon: "⭐", title: "Premium", text: "3/6/12 oy — havola bilan, istalgan akkauntga" },
  { icon: "🌟", title: "Stars", text: "50 dan 5 000 gacha — istalgan @username'ga" },
  { icon: "📩", title: "SMS raqamlar", text: "WhatsApp, Instagram, Google va boshqalar uchun" },
];

export function Landing() {
  return (
    <div className="space-y-14 py-6">
      {/* Hero */}
      <section className="text-center">
        <div className="mb-4 inline-block rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm text-[var(--muted)]">
          ✈️ Telegram raqam · Premium · Stars · SMS
        </div>
        <h1 className="mx-auto max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
          Telegram va{" "}
          <span className="bg-gradient-to-r from-[var(--brand)] to-[var(--brand-2)] bg-clip-text text-transparent">
            virtual raqamlar
          </span>{" "}
          bir joyda
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
          Tayyor Telegram akkauntlari, Premium va Stars, hamda WhatsApp, Instagram
          va boshqa xizmatlar uchun SMS raqamlarni soniyalar ichida oling.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/login" className="btn btn-primary px-6 py-3">
            Boshlash →
          </Link>
          <a href="#services" className="btn btn-ghost px-6 py-3">
            Xizmatlar
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="card p-5">
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 font-semibold">{f.title}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">{f.text}</div>
          </div>
        ))}
      </section>

      {/* Services */}
      <section id="services" className="text-center">
        <h2 className="text-2xl font-bold">Mahsulotlar</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {PRODUCTS.map((p) => (
            <span
              key={p.slug}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
            >
              <span>{p.emoji}</span>
              {p.name}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="card p-8 text-center">
        <h2 className="text-2xl font-bold">Hoziroq boshlang</h2>
        <p className="mx-auto mt-2 max-w-md text-[var(--muted)]">
          Ro&apos;yxatdan o&apos;ting, balansni to&apos;ldiring va birinchi raqamingizni oling.
        </p>
        <Link href="/login" className="btn btn-primary mt-5 px-6 py-3">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </section>
    </div>
  );
}
