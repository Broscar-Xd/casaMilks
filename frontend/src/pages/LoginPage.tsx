import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UtensilsCrossed, ChefHat, Coffee, Sandwich } from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.role === 'ADMIN' ? '/admin/dashboard' : '/pos'} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(name, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left side — Decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-gray-950 via-brand-950 to-gray-950 items-center justify-center">
        {/* Abstract pattern */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.3" />
              </pattern>
              <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="800" height="800" fill="url(#grid)" />
            <ellipse cx="400" cy="300" rx="350" ry="250" fill="url(#glow)" />
            {/* Decorative circles */}
            <circle cx="150" cy="600" r="120" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.15" />
            <circle cx="650" cy="180" r="80" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.15" />
            <circle cx="550" cy="650" r="60" fill="none" stroke="#ea580c" strokeWidth="0.5" opacity="0.1" />
            {/* Wavy line */}
            <path d="M 0 700 Q 200 650, 400 700 T 800 700" fill="none" stroke="#f97316" strokeWidth="1" opacity="0.2" />
            <path d="M 0 720 Q 200 670, 400 720 T 800 720" fill="none" stroke="#f97316" strokeWidth="0.5" opacity="0.1" />
          </svg>
        </div>

        {/* Floating icons */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 animate-pulse" style={{ animationDuration: '4s' }}>
            <Sandwich size={28} className="text-brand-500/30" />
          </div>
          <div className="absolute top-1/3 right-1/4 animate-pulse" style={{ animationDuration: '5s' }}>
            <Coffee size={24} className="text-brand-400/25" />
          </div>
          <div className="absolute bottom-1/3 left-1/3 animate-pulse" style={{ animationDuration: '6s' }}>
            <ChefHat size={32} className="text-brand-500/20" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center px-12">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-orange-600 shadow-2xl shadow-brand-500/30 ring-1 ring-white/10">
            <UtensilsCrossed size={48} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Casa Milks</h1>
          <p className="text-lg text-gray-400 font-light max-w-sm mx-auto leading-relaxed">
            Sistema de Pedidos y Facturación para tu restaurante
          </p>

          {/* Brand accent line */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-brand-500" />
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-brand-500" />
          </div>

          <p className="mt-6 text-sm text-gray-500">Latacunga, Ecuador</p>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-950 to-transparent" />
      </div>

      {/* Right side — Login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 p-6 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-100/40 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-brand-100/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

        <div className="w-full max-w-sm relative">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 shadow-lg shadow-brand-500/20">
              <UtensilsCrossed size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Casa Milks</h1>
            <p className="text-sm text-gray-400 mt-1">Sistema de Pedidos y Facturación</p>
          </div>

          {/* Form card */}
          <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-gray-200/50 p-8">
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">Acceso</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Iniciar sesión</h2>
              <p className="text-sm text-gray-400 mt-0.5">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de usuario</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  </span>
                  <input
                    id="name"
                    type="text"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-brand-400 focus:outline-none focus:ring-[3px] focus:ring-brand-500/10"
                    placeholder="Tu nombre de usuario"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400 pointer-events-none">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input
                    id="password"
                    type="password"
                    className="block w-full rounded-xl border border-gray-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-brand-400 focus:outline-none focus:ring-[3px] focus:ring-brand-500/10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200/80 p-3.5 flex items-start gap-3">
                  <span className="shrink-0 mt-0.5">
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="relative w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200
                  bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25
                  hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5
                  focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                  active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Iniciando sesión...
                  </span>
                ) : ( 
                  <span className="flex items-center gap-2">
                    Iniciar sesión
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            Casa Milks © {new Date().getFullYear()} — Latacunga, Ecuador
          </p>
        </div>
      </div>
    </div>
  );
}
