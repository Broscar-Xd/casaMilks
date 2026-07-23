import { Settings as SettingsIcon, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>
        <p className="text-xs text-gray-500">Información del sistema</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
              <Info size={20} />
            </div>
            <h2 className="font-semibold text-gray-900">Información del Sistema</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Versión</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Régimen Fiscal</span>
              <span className="font-medium">RIMPE Negocio Popular</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Comprobante</span>
              <span className="font-medium">Nota de Venta</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">IVA</span>
              <span className="font-medium">No aplica</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Usuario actual</span>
              <span className="font-medium">{user?.email}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <SettingsIcon size={20} />
            </div>
            <h2 className="font-semibold text-gray-900">Casa Milks</h2>
          </div>

          <div className="space-y-3 text-sm text-gray-600">
            <p>Sistema de Pedidos y Facturación</p>
            <p>Latacunga, Ecuador — 2026</p>
            <p className="text-xs text-gray-400 mt-4">
              Para configurar los datos fiscales (RUC, autorización, secuencial), 
              ve a la sección <strong>Locales</strong> y edita la configuración SRI del local correspondiente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
