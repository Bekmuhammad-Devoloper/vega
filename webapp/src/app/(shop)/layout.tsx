import { BottomNav } from '@/components/shop/bottom-nav';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-md mx-auto pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
