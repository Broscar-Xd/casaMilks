import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

/**
 * Diagnóstico de rendimiento (solo registra en consola; NO altera respuestas).
 *
 * Para cada petición que supere SLOW_REQUEST_MS indica cuánto del tiempo fue
 * base de datos y cuántas consultas hizo, así se sabe si la demora está en la
 * BD o en otra parte. También avisa cuando el event loop de Node se bloquea.
 */
const SLOW_REQUEST_MS = 1000;
const SLOW_QUERY_MS = 500;
const LOOP_LAG_MS = 300;

type Stats = { dbMs: number; queries: number; slowest: { what: string; ms: number } };
const als = new AsyncLocalStorage<Stats>();

export function perfMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const stats: Stats = { dbMs: 0, queries: 0, slowest: { what: '', ms: 0 } };
  res.on('finish', () => {
    try {
      const total = Date.now() - start;
      if (total < SLOW_REQUEST_MS) return;
      const route = (req.baseUrl || '') + (req.route?.path && req.route.path !== '/' ? req.route.path : '');
      console.warn(
        `[SLOW] ${req.method} ${route || req.path} ${total}ms | bd=${stats.dbMs}ms en ${stats.queries} consultas` +
        ` | otro=${total - stats.dbMs}ms | mas lenta: ${stats.slowest.what} ${stats.slowest.ms}ms | status=${res.statusCode}`
      );
    } catch { /* nunca romper una petición por el diagnóstico */ }
  });
  als.run(stats, next);
}

export function installPerfDiagnostics(): void {
  // Tiempo de cada consulta Prisma, atribuido a la petición que la originó
  try {
    prisma.$use(async (params, nextQuery) => {
      const t = Date.now();
      try {
        return await nextQuery(params);
      } finally {
        const ms = Date.now() - t;
        const s = als.getStore();
        if (s) {
          s.dbMs += ms;
          s.queries += 1;
          if (ms > s.slowest.ms) s.slowest = { what: `${params.model ?? 'raw'}.${params.action}`, ms };
        }
        if (ms >= SLOW_QUERY_MS) console.warn(`[SLOW-QUERY] ${params.model ?? 'raw'}.${params.action} ${ms}ms`);
      }
    });
  } catch (e) {
    console.error('[perf] no se pudo instalar el monitor de consultas', e);
  }

  // Bloqueo del event loop (CPU saturada o trabajo síncrono pesado)
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const lag = now - last - 1000;
    last = now;
    if (lag > LOOP_LAG_MS) console.warn(`[LOOP-LAG] el servidor estuvo bloqueado ~${lag}ms`);
  }, 1000).unref();
}
