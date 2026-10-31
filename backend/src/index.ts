import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { catalogModuleRouter, lookupsRouter } from './modules/catalog';

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health Check
app.get('/api/health', (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', service: 'catalog-service', timestamp: new Date().toISOString() });
});

// Lookups (Published for P1, P3, P4)
app.use('/api/lookups', lookupsRouter);

// Catalog Slice (P2)
app.use('/api/catalog', catalogModuleRouter);

app.listen(port, () => {
  console.log(`🚀 Backend server running on http://localhost:${port}`);
  console.log(`   - Lookups: http://localhost:${port}/api/lookups/products`);
  console.log(`   - Catalog: http://localhost:${port}/api/catalog/products`);
});
