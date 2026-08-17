import { Module } from '@nestjs/common';
import { WebAppNotificationsGateway } from './webapp-notifications.gateway';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WebAppNotificationsGateway],
  exports: [WebAppNotificationsGateway],
})
export class WebAppNotificationsModule {}
