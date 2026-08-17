import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function buildCursorPage<T extends { id: string }>(
  items: T[],
  limit: number,
): CursorPage<T> {
  if (items.length > limit) {
    const slice = items.slice(0, limit);
    return { items: slice, nextCursor: slice[slice.length - 1]!.id, hasMore: true };
  }
  return { items, nextCursor: null, hasMore: false };
}
