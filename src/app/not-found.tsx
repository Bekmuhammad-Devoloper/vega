import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="text-6xl">🔍</div>
      <h1 className="mt-4 text-2xl font-bold">Sahifa topilmadi</h1>
      <p className="mt-2 text-[var(--muted)]">
        Siz qidirgan sahifa mavjud emas yoki o&apos;chirilgan.
      </p>
      <Link href="/" className="btn btn-primary mt-6 px-6 py-3">
        Bosh sahifaga qaytish
      </Link>
    </div>
  );
}
