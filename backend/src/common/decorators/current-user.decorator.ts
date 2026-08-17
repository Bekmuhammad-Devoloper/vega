import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest<{ user: User }>();
    return req.user;
  },
);

export const CurrentLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): 'uz' | 'ru' => {
    const req = ctx.switchToHttp().getRequest<{ user?: User; headers: Record<string, string | undefined> }>();
    if (req.user?.language === 'ru' || req.user?.language === 'uz') return req.user.language;
    const header = (req.headers['accept-language'] ?? '').toLowerCase();
    if (header.startsWith('ru')) return 'ru';
    return 'uz';
  },
);
