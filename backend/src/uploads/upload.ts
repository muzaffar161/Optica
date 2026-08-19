import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';

export type UploadedImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const IMAGE_MAX = 5 * 1024 * 1024;

export const IMAGE_UPLOAD = {
  limits: { fileSize: IMAGE_MAX },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new BadRequestException('Нужно изображение (jpg, png, webp)'), false);
      return;
    }
    cb(null, true);
  },
};

function imageExt(buf: Buffer): '.jpg' | '.png' | '.webp' | '.gif' {
  if (buf.length < 12) {
    throw new BadRequestException('Файл слишком короткий');
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return '.png';
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return '.gif';
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp';
  }
  throw new BadRequestException('Нужно изображение (jpg, png, webp)');
}

export function saveProductPhoto(opticsId: string, file: UploadedImage): string {
  return saveImage(`products/${opticsId}`, file);
}

export function savePlatformImage(kind: string, file: UploadedImage): string {
  return saveImage(`platform/${kind}`, file);
}

function saveImage(folder: string, file: UploadedImage): string {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Нужно изображение (jpg, png, webp)');
  }
  const ext = imageExt(file.buffer);
  const name = `${randomUUID()}${ext}`;
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
