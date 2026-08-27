import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export interface UploadedImage {
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  width: number;
  height: number;
  size: number;
}

export interface UploadedVideo {
  url: string;
  size: number;
}

@Injectable()
export class UploadsService {
  private readonly dir: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.dir = config.get<string>('UPLOAD_DIR') ?? './uploads';
    this.publicUrl = (config.get<string>('PUBLIC_UPLOADS_URL') ?? '/uploads').replace(/\/$/, '');
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async saveImage(buffer: Buffer): Promise<UploadedImage> {
    await this.ensureDir();
    const id = randomUUID();
    const baseName = `${Date.now()}-${id}`;

    const meta = await sharp(buffer).metadata();
    const ext = 'webp';

    // 3 sizes: thumb (200), medium (600), original (max 1600)
    const sizes = [
      { suffix: '', maxW: 1600 },
      { suffix: '-md', maxW: 600 },
      { suffix: '-sm', maxW: 200 },
    ];

    const written = await Promise.all(
      sizes.map(async (s) => {
        const filename = `${baseName}${s.suffix}.${ext}`;
        const filePath = join(this.dir, filename);
        await sharp(buffer)
          .resize({ width: s.maxW, withoutEnlargement: true })
          .webp({ quality: 85 })
          .toFile(filePath);
        return { suffix: s.suffix, filename };
      }),
    );

    const orig = written.find((w) => w.suffix === '')!;
    const md = written.find((w) => w.suffix === '-md')!;
    const sm = written.find((w) => w.suffix === '-sm')!;

    return {
      url: `${this.publicUrl}/${orig.filename}`,
      mediumUrl: `${this.publicUrl}/${md.filename}`,
      thumbUrl: `${this.publicUrl}/${sm.filename}`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      size: buffer.length,
    };
  }

  /**
   * Videoni vaqtincha diskka saqlaydi (mp4/mov/webm). Yuborilgandan keyin
   * `deleteByUrl` bilan o'chiriladi — fayl Telegram'da file_id orqali qoladi,
   * bizning diskda joy egallamaydi.
   */
  async saveVideo(buffer: Buffer, mime: string): Promise<UploadedVideo> {
    await this.ensureDir();
    const ext = /quicktime|mov/.test(mime) ? 'mov' : /webm/.test(mime) ? 'webm' : 'mp4';
    const filename = `${Date.now()}-${randomUUID()}.${ext}`;
    await fs.writeFile(join(this.dir, filename), buffer);
    return { url: `${this.publicUrl}/${filename}`, size: buffer.length };
  }

  /**
   * Public URL'dan disk yo'lini topadi — faqat bizning yuklamalar uchun
   * (`PUBLIC_UPLOADS_URL` prefiksi). Tashqi URL yoki path-traversal bo'lsa null.
   */
  localPathFromUrl(url: string | null | undefined): string | null {
    if (!url || !url.startsWith(`${this.publicUrl}/`)) return null;
    const name = url.slice(this.publicUrl.length + 1);
    if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null;
    return join(this.dir, name);
  }

  /** Yuklangan faylni o'chiradi (broadcast tugagach — diskda joy egallamasin). */
  async deleteByUrl(url: string | null | undefined): Promise<void> {
    const p = this.localPathFromUrl(url);
    if (!p) return;
    await fs.unlink(p).catch(() => undefined);
  }
}
