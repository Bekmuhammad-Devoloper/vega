'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Send } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sheet } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiGetTicket, apiListTickets, apiRespondTicket, apiUpdateTicketStatus } from '@/lib/endpoints';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast-store';

export default function SupportPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'all' | 'open' | 'answered' | 'closed'>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets', status],
    queryFn: () => apiListTickets({ status: status === 'all' ? undefined : status, limit: 50 }),
  });

  const { data: ticket } = useQuery({
    queryKey: ['support-ticket', selectedId],
    queryFn: () => apiGetTicket(selectedId!),
    enabled: Boolean(selectedId),
  });

  const [response, setResponse] = useState('');

  const respond = useMutation({
    mutationFn: () => apiRespondTicket(selectedId!, response),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', selectedId] });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support', 'open-count'] });
      setResponse('');
      toast.success('Yuborildi');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const close = useMutation({
    mutationFn: () => apiUpdateTicketStatus(selectedId!, 'closed'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-ticket', selectedId] });
      qc.invalidateQueries({ queryKey: ['support', 'open-count'] });
      toast.success('Yopildi');
    },
  });

  return (
    <div>
      <PageHeader title="Support tiketlar" />

      <div className="flex gap-2 mb-4">
        {(['all', 'open', 'answered', 'closed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'h-9 px-3 rounded-full text-xs font-medium',
              status === s
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]',
            )}
          >
            {s === 'all' ? 'Hammasi' : s === 'open' ? 'Yangi' : s === 'answered' ? 'Javob berilgan' : 'Yopilgan'}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-40" />
      ) : data.items.length === 0 ? (
        <Card>
          <div className="px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
            <MessageCircle className="inline-block mb-2" size={32} />
            <p>Tiketlar yo&apos;q</p>
          </div>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {data.items.map((t) => (
              <li key={t.id}>
                <button onClick={() => setSelectedId(t.id)} className="w-full text-left px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold truncate">{t.subject}</p>
                    <Badge tone={t.status === 'open' ? 'amber' : t.status === 'answered' ? 'blue' : 'gray'}>
                      {t.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{t.message}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {t.user.firstName ?? t.user.username ?? 'User'} · {formatDateTime(t.createdAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Sheet open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={ticket?.subject ?? 'Tiket'}>
        {ticket && (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">
                {ticket.user.firstName ?? ticket.user.username} — {formatDateTime(ticket.createdAt)}
              </p>
              <p className="text-sm whitespace-pre-line">{ticket.message}</p>
            </div>
            {ticket.responses.map((r) => (
              <div key={r.id} className={r.fromAdmin ? 'bg-[var(--color-primary)]/10 rounded-xl p-3' : 'bg-gray-50 rounded-xl p-3'}>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  {r.fromAdmin ? 'Admin' : 'User'} — {formatDateTime(r.createdAt)}
                </p>
                <p className="text-sm whitespace-pre-line">{r.message}</p>
              </div>
            ))}

            {ticket.status !== 'closed' && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <Textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={3}
                  placeholder="Javob..."
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => respond.mutate()}
                    disabled={!response.trim()}
                    loading={respond.isPending}
                    fullWidth
                  >
                    <Send size={14} /> Yuborish
                  </Button>
                  <Button variant="ghost" onClick={() => close.mutate()}>Yopish</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
