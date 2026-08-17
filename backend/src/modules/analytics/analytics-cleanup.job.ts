import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsCleanupJob {
  private readonly logger = new Logger(AnalyticsCleanupJob.name);
  private readonly retentionDays: number;

  constructor(
    private readonly analytics: AnalyticsService,
    config: ConfigService,
  ) {
    this.retentionDays = Number(config.get('EVENTS_RETENTION_DAYS') ?? 14);
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanup(): Promise<void> {
    const removed = await this.analytics.cleanupOld(this.retentionDays);
    this.logger.log(`Cleaned ${removed} old events (retention ${this.retentionDays} days)`);
  }
}
