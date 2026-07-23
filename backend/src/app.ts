import express from 'express';
import cors from 'cors';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { authRoutes } from './routes/auth.routes';
import { branchRoutes } from './routes/branch.routes';
import { categoryRoutes } from './routes/category.routes';
import { productRoutes } from './routes/product.routes';
import { ingredientRoutes } from './routes/ingredient.routes';
import { recipeRoutes } from './routes/recipe.routes';
import { orderRoutes } from './routes/order.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { reportRoutes } from './routes/report.routes';
import { closeRoutes } from './routes/close.routes';
import { userRoutes } from './routes/user.routes';
import { tableRoutes } from './routes/table.routes';

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Servir frontend compilado (en producción)
const publicPath = path.join(__dirname, '../../public');
app.use(express.static(publicPath));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Casa Milks API funcionando', timestamp: new Date().toISOString() });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/closes', closeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tables', tableRoutes);

// SPA fallback — cualquier ruta que no sea API sirve el index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Manejo de errores (debe ir al final)
app.use(errorHandler);

export default app;
