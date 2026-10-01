import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerGeminiRoutes } from './server/gemini.ts';
import { registerEmailRoutes } from './server/email.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Register Gemini AI endpoints
registerGeminiRoutes(app);

// Register Email notification endpoint (Email only)
registerEmailRoutes(app);

// In production, serve static built files from dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA routing, send index.html for all non-API requests
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CampusFind AI Server running on port ${PORT}`);
});
