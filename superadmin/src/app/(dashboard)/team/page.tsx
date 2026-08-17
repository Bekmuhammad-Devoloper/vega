'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Shield,
  Server,
  Wallet,
  TrendingUp,
  Headphones,
  KeyRound,
  Power,
  PowerOff,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';
import {
  apiActivateAdmin,
  apiCreateAdmin,
  apiDeactivateAdmin,
  apiFetchTeam,
  apiResetAdminPassword,
  apiUpdateAdmin,
} from '@/lib/endpoints';
import type { PlatformAdminDto, PlatformRole } from '@/lib/types';
import { formatDate, formatRelative } from '@/lib/format';
import { toast } from '@/stores/toast-store';
import { useAuthStore } from '@/stores/auth-store';

const ROLE_META: Record<PlatformRole, { label: string; icon: typeof Shield; color: string }> = {
  OWNER: { label: 'Owner', icon: ShieldCheck, color: 'text-[var(--color-warning)]' },
  DEVOPS: { label: 'DevOps', icon: Server, color: 'text-[var(--color-info)]' },
  FINANCE: { label: 'Finance', icon: Wallet, color: 'text-[var(--color-success)]' },
  SALES: { label: 'Sales', icon: TrendingUp, color: 'text-[var(--color-primary)]' },
  SUPPORT: { label: 'Support', icon: Headphones, color: 'text-[var(--color-text-muted)]' },
};

export default function TeamPage() {
  const me = useAuthStore((s) => s.admin);
  const isOwner = me?.role === 'OWNER';
  const qc = useQueryClient();
  const team = useQuery({ queryKey: ['team'], queryFn: apiFetchTeam });

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<PlatformAdminDto | null>(null);

  return (
    <>
      <PageHeader
        title="Komanda"
        subtitle="Platforma adminlari va ularning rollari"
        action={
          isOwner && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              Admin qo'shish
            </Button>
          )
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left">
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Admin
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Rol
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Status
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  2FA
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Oxirgi kirish
                </th>
                <th className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Qo'shilgan
                </th>
                <th className="py-3 px-5" />
              </tr>
            </thead>
            <tbody>
              {team.isLoading || !team.data ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)]">
                    <td colSpan={7} className="py-3 px-5">
                      <Skeleton className="h-10" />
                    </td>
                  </tr>
                ))
              ) : (
                team.data.map((admin) => {
                  const role = ROLE_META[admin.role];
                  const RoleIcon = role.icon;
                  return (
                    <tr
                      key={admin.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] grid place-items-center text-white font-semibold text-sm">
                            {admin.fullName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text)] truncate">
                              {admin.fullName}
                              {admin.id === me?.id && (
                                <span className="ml-2 text-[10px] text-[var(--color-text-subtle)]">
                                  (siz)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">
                              {admin.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <div className={`inline-flex items-center gap-1.5 ${role.color}`}>
                          <RoleIcon size={14} />
                          <span className="text-sm font-medium">{role.label}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <Badge variant={admin.isActive ? 'success' : 'default'}>
                          {admin.isActive ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </td>
                      <td className="py-3 px-5">
                        <Badge variant={admin.twoFactorEnabled ? 'success' : 'warning'}>
                          {admin.twoFactorEnabled ? 'Yoqilgan' : "Yo'q"}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-xs text-[var(--color-text-muted)]">
                        {admin.lastLoginAt ? formatRelative(admin.lastLoginAt) : '—'}
                        {admin.lastLoginIp && (
                          <p className="text-[10px] text-[var(--color-text-subtle)] mt-0.5 font-mono">
                            {admin.lastLoginIp}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-5 text-xs text-[var(--color-text-muted)]">
                        {formatDate(admin.createdAt)}
                      </td>
                      <td className="py-3 px-5">
                        {isOwner && admin.id !== me?.id && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setResetTarget(admin)}
                              className="h-8 w-8 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                              title="Parolni reset qilish"
                            >
                              <KeyRound size={14} />
                            </button>
                            <ToggleActiveButton admin={admin} onChanged={() => qc.invalidateQueries({ queryKey: ['team'] })} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CreateAdminModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['team'] });
          setCreateOpen(false);
        }}
      />

      <ResetPasswordModal
        admin={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </>
  );
}

function ToggleActiveButton({
  admin,
  onChanged,
}: {
  admin: PlatformAdminDto;
  onChanged: () => void;
}) {
  const mut = useMutation({
    mutationFn: () => (admin.isActive ? apiDeactivateAdmin(admin.id) : apiActivateAdmin(admin.id)),
    onSuccess: () => {
      toast.success(admin.isActive ? 'Deaktivlashtirildi' : 'Aktivlashtirildi');
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      onClick={() => {
        if (!confirm(`${admin.isActive ? 'Deaktivlashtirish' : 'Aktivlashtirish'}?`)) return;
        mut.mutate();
      }}
      disabled={mut.isPending}
      className="h-8 w-8 rounded-lg grid place-items-center text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
      title={admin.isActive ? 'Deaktivlashtirish' : 'Aktivlashtirish'}
    >
      {admin.isActive ? <PowerOff size={14} /> : <Power size={14} />}
    </button>
  );
}

function CreateAdminModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<PlatformRole>('SUPPORT');

  const mut = useMutation({
    mutationFn: () => apiCreateAdmin({ email, fullName, password, role }),
    onSuccess: () => {
      toast.success('Admin yaratildi');
      setEmail('');
      setFullName('');
      setPassword('');
      setRole('SUPPORT');
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi platforma admin">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-3"
      >
        <Field label="To'liq ismi">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Sardor Karimov"
            required
          />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@platform.uz"
            required
          />
        </Field>
        <Field label="Parol" hint="Kamida 12 ta belgi">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            minLength={12}
          />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value as PlatformRole)}>
            <option value="SUPPORT">Support — tiketlar va broadcast</option>
            <option value="SALES">Sales — tenant boshqaruvi</option>
            <option value="FINANCE">Finance — billing va tariflar</option>
            <option value="DEVOPS">DevOps — infrastructure va dev tools</option>
            <option value="OWNER">Owner — hamma narsa</option>
          </Select>
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" loading={mut.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({
  admin,
  onClose,
}: {
  admin: PlatformAdminDto | null;
  onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const mut = useMutation({
    mutationFn: () => apiResetAdminPassword(admin!.id, newPassword),
    onSuccess: () => {
      toast.success('Parol yangilandi');
      setNewPassword('');
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Modal open={!!admin} onClose={onClose} title={`Parolni reset qilish — ${admin?.fullName}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="space-y-3"
      >
        <p className="text-xs text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-3 py-2 rounded-lg">
          ⚠️ Barcha refresh tokenlar bekor qilinadi — admin qayta login qilishi kerak bo'ladi.
        </p>
        <Field label="Yangi parol" hint="Kamida 12 ta belgi">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={12}
            autoFocus
          />
        </Field>
        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Bekor
          </Button>
          <Button type="submit" variant="danger" loading={mut.isPending}>
            Reset qilish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
