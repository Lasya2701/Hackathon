import type { Plugin } from 'vite';
import express from 'express';
import dotenv from 'dotenv';
import { registerGeminiRoutes } from './gemini.ts';
import { registerEmailRoutes } from './email.ts';

dotenv.config();

export function geminiDevServerPlugin(): Plugin {
  return {
    name: 'gemini-dev-server-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '25mb' }));
      app.use(express.urlencoded({ extended: true, limit: '25mb' }));

      registerGeminiRoutes(app);
      registerEmailRoutes(app);

      // Mount express app into Vite connect middleware
      server.middlewares.use(app);
    },
  };
}
