'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Database, Code2, Server, Activity, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetchDevRoutes, apiFetchDevStats, apiRunSqlSelect } from '@/lib/endpoints';
import { toast } from '@/stores/toast-store';
import { formatNumber } from '@/lib/format';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function DevToolsPage() {
  const stats = useQuery({
    queryKey: ['dev-stats'],
    queryFn: apiFetchDevStats,
    refetchInterval: 5_000,
  });
  const routes = useQuery({ queryKey: ['dev-routes'], queryFn: apiFetchDevRoutes });

  return (
    <>
      <PageHeader
        title="Dev Tools"
        subtitle="Faqat DEVOPS rol uchun — extra ehtiyot bilan ishlating"
        action={
          <Badge variant="warning">
            <AlertTriangle size={11} />
            DEVOPS only
          </Badge>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {stats.isLoading || !stats.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard label="Node.js" value={stats.data.nodeVersion} icon={Server} />
            <StatCard
              label="Process PID"
              value={String(stats.data.pid)}
              icon={Activity}
            />
            <StatCard
              label="Uptime"
              value={formatUptime(stats.data.uptime)}
              icon={Activity}
            />
            <StatCard
              label="PostgreSQL"
              value={stats.data.dbVersion.split(' ').slice(0, 2).join(' ')}
              icon={Database}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SQL Runner */}
        <Card>
          <CardHeader
            title="Safe SQL Runner"
            subtitle="Faqat SELECT — mutation taqiqlangan"
            action={
              <Badge variant="info">
                <Database size={11} />
                Read-only
              </Badge>
            }
          />
          <CardBody>
            <SqlRunner />
          </CardBody>
        </Card>

        {/* API Routes */}
        <Card>
          <CardHeader title="API endpoint'lar" subtitle="Super Admin API ko'rinishi" />
          <CardBody>
            {routes.isLoading || !routes.data ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {routes.data.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg)] text-xs"
                  >
                    <Badge
                      variant={
                        r.method === 'GET'
                          ? 'info'
                          : r.method === 'POST'
                            ? 'success'
                            : r.method === 'PATCH'
                              ? 'warning'
                              : 'danger'
                      }
                      className="font-mono shrink-0"
                    >
                      {r.method}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-mono text-[var(--color-text)] truncate">{r.path}</p>
                      <p className="text-[var(--color-text-subtle)] text-[10px] mt-0.5">
                        {r.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Server;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] grid place-items-center">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-0.5">
            {label}
          </p>
          <p className="text-sm font-semibold text-[var(--color-text)] tabular-nums truncate font-mono">
            {value}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

const SAMPLE_QUERIES = [
  'SELECT id, "shopName", "tariffPlan", status FROM "Tenant" ORDER BY "createdAt" DESC LIMIT 10',
  'SELECT plan, COUNT(*) FROM "Tenant" GROUP BY plan',
  'SELECT email, role, "lastLoginAt" FROM "PlatformAdmin"',
  'SELECT action, COUNT(*) FROM "PlatformAuditLog" GROUP BY action ORDER BY 2 DESC',
];

function SqlRunner() {
  const [query, setQuery] = useState(SAMPLE_QUERIES[0]);
  const [result, setResult] = useState<{
    rows?: unknown[];
    rowCount?: number;
    error?: string;
  } | null>(null);

  const run = useMutation({
    mutationFn: () => apiRunSqlSelect(query),
    onSuccess: (data) => {
      setResult(data);
      if (data.error) toast.error(data.error);
      else toast.success(`${data.rowCount} qator qaytdi`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={5}
        className="font-mono text-xs"
        placeholder="SELECT * FROM ..."
      />

      <div className="flex items-center justify-between gap-2">
        <select
          onChange={(e) => {
            if (e.target.value) setQuery(e.target.value);
          }}
          value=""
          className="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-2 h-8 text-[var(--color-text-muted)]"
        >
          <option value="">Sample queries...</option>
          {SAMPLE_QUERIES.map((q, i) => (
            <option key={i} value={q}>
              {q.slice(0, 40)}...
            </option>
          ))}
        </select>
        <Button size="sm" onClick={() => run.mutate()} loading={run.isPending}>
          <Play size={12} />
          Run
        </Button>
      </div>

      {result && (
        <div className="border-t border-[var(--color-border)] pt-3">
          {result.error ? (
            <div className="bg-[var(--color-danger)]/10 text-[var(--color-danger)] rounded-lg p-3 text-xs font-mono">
              {result.error}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)]">
                  Natija ({formatNumber(result.rowCount ?? 0)} qator)
                </p>
                <Badge variant="success">OK</Badge>
              </div>
              <pre className="bg-[var(--color-bg)] rounded-lg p-3 text-xs font-mono text-[var(--color-text-muted)] overflow-x-auto max-h-64">
                {JSON.stringify(result.rows, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
