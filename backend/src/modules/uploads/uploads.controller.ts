import { BadRequestException, Controller, ParseFilePipeBuilder, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../admin-auth/admin-jwt.guard';
import { UploadsService } from './uploads.service';

@Controller('admin/uploads')
@UseGuards(AdminJwtGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService, private readonly config: ConfigService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /image\/(png|jpe?g|webp|gif)/ })
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file required');
    return this.uploads.saveImage(file.buffer);
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // 50MB — Telegram bot (cloud API) faylni yuklash uchun maksimal chegara.
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadVideo(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /video\/(mp4|quicktime|webm)/ })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file required');
    return this.uploads.saveVideo(file.buffer, file.mimetype);
  }
}
