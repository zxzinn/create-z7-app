import type { Buffer } from 'node:buffer'
import { extname } from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
}

export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] || 'application/octet-stream'
}

export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
})

export const S3_BUCKET = process.env.S3_BUCKET || '{{projectName}}'

export async function uploadFile(key: string, body: Buffer | Uint8Array, contentType?: string): Promise<void> {
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || getMimeType(key),
  }))
}

export async function getFile(key: string): Promise<{
  body: NodeJS.ReadableStream
  contentLength: number
  contentType: string
}> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }))
  return {
    body: response.Body as NodeJS.ReadableStream,
    contentLength: response.ContentLength || 0,
    contentType: response.ContentType || getMimeType(key),
  }
}

export async function getFileRange(key: string, range: string): Promise<{
  body: NodeJS.ReadableStream
  contentLength: number
  contentRange: string
  contentType: string
}> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Range: range,
  }))
  return {
    body: response.Body as NodeJS.ReadableStream,
    contentLength: response.ContentLength || 0,
    contentRange: response.ContentRange || '',
    contentType: response.ContentType || getMimeType(key),
  }
}

export async function deleteFile(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }))
}

export async function headFile(key: string): Promise<{
  contentLength: number
  contentType: string
}> {
  const response = await s3Client.send(new HeadObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  }))
  return {
    contentLength: response.ContentLength || 0,
    contentType: response.ContentType || getMimeType(key),
  }
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await headFile(key)
    return true
  }
  catch {
    return false
  }
}
