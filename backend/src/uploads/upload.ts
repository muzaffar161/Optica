import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function saveProductPhoto(opticsId: string, file: UploadedImage): string {
  return saveImage(`products/${opticsId}`, file);
}

export function savePlatformImage(kind: string, file: UploadedImage): string {
  return saveImage(`platform/${kind}`, file);
}

function saveImage(folder: string, file: UploadedImage): string {
  if (!file.mimetype.startsWith('image/')) {
    throw new BadRequestException('Нужно изображение (jpg, png, webp)');
  }
  const ext = extname(file.originalname || '').toLowerCase();
  const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
  const name = `${randomUUID()}${safeExt}`;
  const dir = join(UPLOADS_ROOT, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), file.buffer);
  return `/uploads/${folder}/${name}`;
}

export function deleteUpload(photoPath?: string | null) {
  if (!photoPath?.startsWith('/uploads/')) {
    return;
  }
  const rel = photoPath.slice('/uploads/'.length);
  if (!rel || rel.includes('..') || rel.includes('\\')) {
    return;
  }
  const abs = join(UPLOADS_ROOT, rel);
  if (existsSync(abs)) {
    unlinkSync(abs);
  }
}
