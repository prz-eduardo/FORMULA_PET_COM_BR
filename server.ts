import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Public maps endpoint used by the frontend to fetch partner vets and maps API key.
  // Returns { partners: [...], mapsApiKey: string|null }
  server.get('/maps', (req, res) => {
    const mapsApiKey = process.env['MAPS_API_KEY'] || process.env['GOOGLE_MAPS_API_KEY'] || null;

    // Allow cross-origin requests so frontend dev server can call this endpoint.
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,OPTIONS');

    // Return a small mock list of partner veterinarians so the frontend can
    // render the mapa page during development without a connected DB.
    const partners = [
      { id: 1, nome: 'Clínica Vet Curitibana', telefone: '+55 41 98765-4321', email: 'contato@vetcuritiba.com', crmv: 'PR-12345', approved: 1, ativo: 1 },
      { id: 2, nome: 'Hospital Veterinário Central', telefone: '+55 41 91234-5678', email: 'central@hv.com', crmv: 'PR-54321', approved: 1, ativo: 1 },
      { id: 3, nome: 'PetCare 24h', telefone: '+55 41 99876-1112', email: 'atendimento@petcare24h.com', crmv: 'PR-67890', approved: 1, ativo: null }
    ];

    res.json({ partners, mapsApiKey });
  });
  // Serve static files from /browser
  server.get('**', express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  }));

  // All regular routes use the Angular engine
  server.get('**', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
  });
}

run();
