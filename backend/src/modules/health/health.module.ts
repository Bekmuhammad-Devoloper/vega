import { Controller, Get, Module } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// Sog'liq tekshiruvi — watchdog/deploy skripti tez-tez chaqiradi.
// Global throttler bularni 429 qilib, to'lov va bot yangiliklarini uzib qo'yardi.
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
