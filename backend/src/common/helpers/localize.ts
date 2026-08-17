import type { Language } from '@prisma/client';

export type Locale = Language | 'uz' | 'ru';

export interface I18nFields {
  titleUz?: string | null;
  titleRu?: string | null;
  descriptionUz?: string | null;
  descriptionRu?: string | null;
}

export function localizeTitle(input: { titleUz: string; titleRu: string }, lang: Locale): string {
  return lang === 'ru' ? input.titleRu : input.titleUz;
}

export function localizeDescription(
  input: { descriptionUz?: string | null; descriptionRu?: string | null },
  lang: Locale,
): string | null {
  return (lang === 'ru' ? input.descriptionRu : input.descriptionUz) ?? null;
}
