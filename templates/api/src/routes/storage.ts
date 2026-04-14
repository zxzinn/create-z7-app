import { extname } from 'node:path'
import { Readable } from 'node:stream'
import { getFile, getFileRange, getMimeType } from '{{scope}}/shared/s3'
import { Hono } from 'hono'
import { stream } from 'hono/streaming'

// S3 Body in Node.js is a Readable (node:stream).
// Readable.toWeb() returns node:stream/web.ReadableStream which doesn't match
// the global Web ReadableStream type. This helper bridges the gap safely.
function toWebStream(body: NodeJS.ReadableStream): ReadableStream {
  return Readable.toWeb(body as Readable) as unknown as ReadableStream
}

const storage = new Hono()

storage.get('/*', async (c) => {
  const pathParam = c.req.path.replace('/api/storage/', '')

  if (!pathParam) {
    return c.text('Path is required', 400)
  }

  const normalizedPath = pathParam.replace(/\.\./g, '').replace(/\/+/g, '/')
  const ext = extname(normalizedPath).toLowerCase()
  const contentType = getMimeType(normalizedPath)
  const isVideo = ext === '.mp4' || ext === '.webm'

  try {
    const rangeHeader = c.req.header('range')
    if (isVideo && rangeHeader) {
      const result = await getFileRange(normalizedPath, rangeHeader)
      return stream(c, async (s) => {
        c.status(206)
        c.header('Content-Type', contentType)
        c.header('Content-Range', result.contentRange)
        c.header('Accept-Ranges', 'bytes')
        c.header('Content-Length', result.contentLength.toString())
        c.header('Cache-Control', 'public, max-age=31536000, immutable')
        await s.pipe(toWebStream(result.body))
      })
    }

    const result = await getFile(normalizedPath)
    return stream(c, async (s) => {
      c.header('Content-Type', contentType)
      c.header('Content-Length', result.contentLength.toString())
      c.header('Cache-Control', 'public, max-age=31536000, immutable')
      if (isVideo)
        c.header('Accept-Ranges', 'bytes')
      await s.pipe(toWebStream(result.body))
    })
  }
  catch (err: unknown) {
    const code = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (code === 404 || (err as { name?: string }).name === 'NoSuchKey') {
      return c.text('File not found', 404)
    }
    throw err
  }
})

export { storage }
