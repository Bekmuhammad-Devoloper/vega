import { AdminRole } from '@prisma/client';

/**
 * Rol guruhlari — controllerlardagi @Roles(...) uchun.
 *
 * - BOSS    = do'kon egasi (+ platforma superadmini): hamma narsa, sozlamalar, jamoa,
 *             to'lov, banner/promo/kanal e'lon (marketing).
 * - CATALOG = katalog (xizmat/davlat taklifi) boshqaruvi (boss).
 * - ORDERS  = buyurtmalarni ko'rish/holatini o'zgartirish (boss + manager + moderator).
 * - VIEW    = ko'rish (dashboard, statistika, ro'yxatlar) (boss + manager + moderator).
 *
 * Eslatma: CREATOR roli Vega'da o'chirilgan (katalog kontent-yaratuvchisi yo'q).
 */
export const BOSS_ROLES = [AdminRole.SUPERADMIN, AdminRole.ADMIN] as const;

export const CATALOG_ROLES = [
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
] as const;

export const ORDERS_ROLES = [
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.MANAGER,
  AdminRole.MODERATOR,
] as const;

export const VIEW_ROLES = [
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.MANAGER,
  AdminRole.MODERATOR,
] as const;
