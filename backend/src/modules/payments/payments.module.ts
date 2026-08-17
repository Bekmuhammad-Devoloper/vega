import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymeService } from './payme.service';
import { ClickService } from './click.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymeService, ClickService],
})
export class PaymentsModule {}
