'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Cpu,
  MemoryStick,
  Database,
  Activity,
  Clock,
  HardDrive,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { apiFetchDbStats, apiFetchHealth, apiFetchJobs } from '@/lib/endpoints';
import { formatBytes, formatNumber, formatPct } from '@/lib/format';
import { cn } from '@/lib/cn';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function InfrastructurePage() {
  const health = useQuery({
    queryKey: ['server-health'],
    queryFn: apiFetchHealth,
    refetchInterval: 10_000,
  });
  const db = useQuery({ queryKey: ['db-stats'], queryFn: apiFetchDbStats });
  const jobs = useQuery({
    queryKey: ['jobs-stats'],
    queryFn: apiFetchJobs,
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Server resurslari"
        subtitle="Real-time server health, database va background jobs"
        action={
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-success)] pulse-dot" />
            Jonli (10s)
          </div>
        }
      />

      {/* Health KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {health.isLoading || !health.data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              label="RAM ishlatish"
              value={formatPct(health.data.memory.usedPct)}
              icon={MemoryStick}
              tone={health.data.memory.usedPct > 80 ? 'danger' : health.data.memory.usedPct > 60 ? 'warning' : 'success'}
              hint={`${health.data.memory.usedGb.toFixed(1)} / ${health.data.memory.totalGb.toFixed(1)} GB`}
              index={0}
            />
            <KpiCard
              label="CPU yadrolari"
              value={formatNumber(health.data.cpu.cores)}
              icon={Cpu}
              tone="primary"
              hint={`Load: ${health.data.cpu.loadAvg?.[0]?.toFixed(2) ?? '—'}`}
              index={1}
            />
            <KpiCard
              label="Process uptime"
              value={formatUptime(health.data.uptime.process)}
              icon={Clock}
              tone="success"
              hint={`OS: ${formatUptime(health.data.uptime.os)}`}
              index={2}
            />
            <KpiCard
              label="Node memory"
              value={`${health.data.memory.processRssMb.toFixed(0)} MB`}
              icon={Zap}
              tone="default"
              hint={`Heap: ${health.data.memory.processHeapMb.toFixed(0)} MB`}
              index={3}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* Server info */}
        <Card>
          <CardHeader title="Server ma'lumoti" subtitle="OS va environment" />
          <CardBody className="space-y-3">
            {health.isLoading || !health.data ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <Row label="Hostname" value={health.data.hostname} icon={Server} />
                <Row
                  label="Platform"
                  value={`${health.data.platform} (${health.data.arch})`}
                  icon={HardDrive}
                />
                <Row label="Node.js" value={health.data.nodeVersion} icon={Zap} />
                <Row label="CPU model" value={health.data.cpu.model} icon={Cpu} />
                <Row
                  label="CPU tezligi"
                  value={`${health.data.cpu.speed} MHz`}
                  icon={Activity}
                />
                <div className="border-t border-[var(--color-border)] pt-3 mt-3">
                  <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-2">
                    RAM
                  </p>
                  <div className="h-3 bg-[var(--color-bg)] rounded-full overflow-hidden mb-1.5">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        health.data.memory.usedPct > 80
                          ? 'bg-[var(--color-danger)]'
                          : health.data.memory.usedPct > 60
                            ? 'bg-[var(--color-warning)]'
                            : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]',
                      )}
                      style={{ width: `${health.data.memory.usedPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">
                      {health.data.memory.usedGb.toFixed(1)} GB band
                    </span>
                    <span className="text-[var(--color-text-subtle)]">
                      {health.data.memory.freeGb.toFixed(1)} GB bo'sh
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader title="Database (PostgreSQL)" subtitle="Jadval va o'lcham statistika" />
          <CardBody className="space-y-3">
            {db.isLoading || !db.data ? (
              <Skeleton className="h-40" />
            ) : (
              <>
                <Row label="Jami o'lcham" value={db.data.totalSize} icon={Database} />
                <Row
                  label="Jadval soni"
                  value={formatNumber(db.data.tables.length)}
                  icon={HardDrive}
                />
                <div className="border-t border-[var(--color-border)] pt-3 mt-3">
                  <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-2">
                    Top jadvallar (yozuv soni)
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {db.data.tables.map((t) => {
                      const max = db.data!.tables[0]?.count || 1;
                      const pct = (t.count / max) * 100;
                      return (
                        <div key={t.table} className="text-xs">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[var(--color-text-muted)] font-mono">
                              {t.table}
                            </span>
                            <span className="text-[var(--color-text)] tabular-nums">
                              {formatNumber(t.count)}
                            </span>
                          </div>
                          <div className="h-1 bg-[var(--color-bg)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-primary)]/60 rounded-full"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Jobs */}
      <Card>
        <CardHeader title="Background jobs" subtitle="Kanal postlari va broadcast" />
        <CardBody>
          {jobs.isLoading || !jobs.data ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <JobStat
                  label="Pending"
                  value={jobs.data.channelPosts?.pending ?? 0}
                  tone="warning"
                />
                <JobStat
                  label="Sent"
                  value={jobs.data.channelPosts?.sent ?? 0}
                  tone="success"
                />
                <JobStat
                  label="Failed"
                  value={jobs.data.channelPosts?.failed ?? 0}
                  tone={(jobs.data.channelPosts?.failed ?? 0) > 0 ? 'danger' : 'default'}
                />
              </div>
              <p className="text-[10px] text-[var(--color-text-subtle)] uppercase tracking-wider mb-2">
                So'nggi broadcast'lar
              </p>
              {(jobs.data.broadcasts?.length ?? 0) === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                  Broadcast yo'q
                </p>
              ) : (
                <div className="space-y-2">
                  {(jobs.data.broadcasts ?? []).map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--color-bg)]"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            b.status === 'completed'
                              ? 'success'
                              : b.status === 'running'
                                ? 'info'
                                : b.status === 'failed'
                                  ? 'danger'
                                  : 'default'
                          }
                        >
                          {b.status}
                        </Badge>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {b.sentCount} / {b.totalCount}
                        </span>
                      </div>
                      {b.failedCount > 0 && (
                        <span className="text-xs text-[var(--color-danger)]">
                          {b.failedCount} failed
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Server;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <Icon size={13} className="text-[var(--color-text-subtle)]" />
        <span>{label}</span>
      </div>
      <span className="text-xs font-medium text-[var(--color-text)] tabular-nums truncate max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

function JobStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger' | 'default';
}) {
  const toneClasses = {
    success: 'text-[var(--color-success)] bg-[var(--color-success)]/10',
    warning: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10',
    danger: 'text-[var(--color-danger)] bg-[var(--color-danger)]/10',
    default: 'text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]',
  };
  return (
    <div className={`rounded-lg p-3 ${toneClasses[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}
