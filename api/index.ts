import type { Request, Response } from 'express';
import app from '../server.ts';

export default function handler(req: Request, res: Response) {
  try {
    // If Vercel rewrote the URL to /api, recover original path from headers
    const matchedPath = (req.headers['x-matched-path'] as string) || (req.headers['x-forwarded-uri'] as string);
    if (matchedPath && (req.url === '/api' || req.url === '/' || req.url === '')) {
      req.url = matchedPath;
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled error in Vercel API handler:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: err?.message || 'Erro interno no manipulador de requisições da Vercel.',
        status: 'error',
      });
    }
  }
}
