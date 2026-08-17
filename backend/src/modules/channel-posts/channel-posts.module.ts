import { Module } from '@nestjs/common';
import { ChannelPostsController } from './channel-posts.controller';
import { ChannelPostsService } from './channel-posts.service';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';

@Module({
  imports: [AdminAuthModule, TelegramBotModule],
  controllers: [ChannelPostsController],
  providers: [ChannelPostsService],
})
export class ChannelPostsModule {}
