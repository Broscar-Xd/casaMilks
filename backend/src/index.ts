import app from './app';
import { env } from './config/env';
import { installPerfDiagnostics } from './utils/perf';

installPerfDiagnostics();

const start = () => {
  app.listen(env.port, () => {
    console.log(`
🚀 Casa Milks API iniciada
   Puerto: ${env.port}
   Entorno: ${env.nodeEnv}
   Fecha: ${new Date().toISOString()}
    `);
  });
};

start();
