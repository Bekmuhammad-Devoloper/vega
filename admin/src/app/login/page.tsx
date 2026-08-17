'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { apiLogin } from '@/lib/endpoints';
import { setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { VegaMark } from '@/components/brand';
import { toast } from '@/stores/toast-store';

export default function LoginPage() {
  const router = useRouter();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => apiLogin(email, password),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAdmin(data.admin);
      toast.success(`Salom, ${data.admin.fullName}`);
      router.replace('/');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-gradient-to-br from-[var(--color-bg)] to-blue-50">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-[var(--color-border)] p-6 shadow-sm">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <VegaMark size={48} />
          </div>
          <h1 className="text-xl font-bold">Vega</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Boshqaruv paneli</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email || !password) return;
            loginMutation.mutate();
          }}
          className="space-y-3"
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Parol">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" fullWidth size="lg" loading={loginMutation.isPending}>
            Kirish
          </Button>
        </form>
      </div>
    </div>
  );
}
