import { Module, forwardRef } from '@nestjs/common';
import { TelegramAuthGuard } from './telegram-auth.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [TelegramAuthGuard, AuthService],
  exports: [TelegramAuthGuard, AuthService],
})
export class AuthModule {}
