import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Guard tomonidan o'rnatilgan req.tenantId (yoki null). */
export const CurrentTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    return ctx.switchToHttp().getRequest<{ tenantId?: string | null }>().tenantId ?? null;
  },
);
