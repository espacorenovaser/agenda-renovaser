import path from 'path';
import express from 'express';
import { app } from './api/index';

const PORT = 3000;

// Vite Middleware & static serving (used in local development and container environments)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Assistente de Agenda rodando na porta ${PORT}`);
  });
}

startServer();

export { app };
export default app;
