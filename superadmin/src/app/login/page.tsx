'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { apiLogin, apiVerify2FA } from '@/lib/endpoints';
import { setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { toast } from '@/stores/toast-store';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [tempToken, setTempToken] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => apiLogin(email, password),
    onSuccess: (data) => {
      if (data.requires2FA && data.tempToken) {
        setTempToken(data.tempToken);
        toast.info('2FA kod kerak');
        return;
      }
      setAccessToken(data.accessToken);
      setAdmin(data.admin);
      toast.success(`Salom, ${data.admin.fullName}`);
      router.replace('/');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiVerify2FA(tempToken!, code),
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setAdmin(data.admin);
      toast.success(`Salom, ${data.admin.fullName}`);
      router.replace('/');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="min-h-dvh grid place-items-center px-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[var(--color-primary)]/15 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -40, 0], y: [0, -60, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[var(--color-accent)]/10 blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm glass rounded-3xl p-8 relative z-10"
      >
        <div className="text-center mb-7">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-white items-center justify-center mb-4 shadow-lg shadow-indigo-500/30 pulse-glow"
          >
            {tempToken ? <KeyRound size={26} /> : <ShieldCheck size={26} />}
          </motion.div>
          <h1 className="text-2xl font-bold gradient-text">
            {tempToken ? '2FA Tasdiqlash' : 'Super Admin'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {tempToken ? 'Authenticator ilovasidan kodni kiriting' : 'Platform Control Tower'}
          </p>
        </div>

        {!tempToken ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email || !password) return;
              loginMutation.mutate();
            }}
            className="space-y-4"
          >
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@platform.uz"
                required
                autoComplete="email"
                autoFocus
              />
            </Field>
            <Field label="Parol">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />
            </Field>
            <Button type="submit" fullWidth size="lg" loading={loginMutation.isPending}>
              Kirish
            </Button>
            <p className="text-[11px] text-center text-[var(--color-text-subtle)] mt-4">
              Bu zona — faqat platforma egalari uchun.
              <br />
              Barcha kirishlar audit log'ga yoziladi.
            </p>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length !== 6) return;
              verifyMutation.mutate();
            }}
            className="space-y-4"
          >
            <Field label="6 xonali kod">
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{6}"
                className="text-center text-2xl tracking-[0.5em] font-mono"
              />
            </Field>
            <Button type="submit" fullWidth size="lg" loading={verifyMutation.isPending}>
              Tasdiqlash
            </Button>
            <button
              type="button"
              onClick={() => {
                setTempToken(null);
                setCode('');
              }}
              className="block w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              ← Orqaga
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
