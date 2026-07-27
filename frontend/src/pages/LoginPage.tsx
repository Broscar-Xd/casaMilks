import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Milk,
  Coffee,
  IceCreamCone,
  Croissant,
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Loader2,
  MapPin,
} from 'lucide-react';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cocoa-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-milk-300 border-t-transparent" />
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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ===== MOBILE TOP HALF: Brand (solo < lg) ===== */}
      <div className="relative flex h-[45vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-cocoa-950 via-cocoa-900 to-cocoa-800 lg:hidden">
        {/* Cow spot pattern */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="#f3e0c3">
            <path opacity="0.06" d="M130 90c40-30 100-20 115 25s-15 85-60 90-80-20-85-60 5-40 30-55z" />
            <path opacity="0.05" d="M560 60c35-20 85-5 90 35s-30 70-70 65-60-35-50-70 15-20 30-30z" />
            <path opacity="0.07" d="M640 420c30-25 80-15 90 25s-20 75-60 75-70-30-65-65 20-25 35-35z" />
            <path opacity="0.06" d="M100 480c35-15 80 5 85 45s-35 70-75 60-55-45-45-80 20-20 35-25z" />
            <path opacity="0.05" d="M360 620c30-20 75-10 85 30s-25 70-65 65-65-30-55-65 20-20 35-30z" />
            <path opacity="0.03" d="M380 180c25-15 65-5 70 30s-25 60-55 55-50-30-45-60 15-15 30-25z" />
          </g>
        </svg>

        {/* Glow */}
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cocoa-500/20 blur-3xl" />

        {/* Floating icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[12%] top-[15%] animate-float">
            <Milk size={18} className="text-milk-300/20" />
          </div>
          <div className="absolute right-[15%] top-[20%] animate-float" style={{ animationDelay: '1.2s' }}>
            <Coffee size={16} className="text-milk-300/15" />
          </div>
          <div className="absolute bottom-[20%] left-[20%] animate-float" style={{ animationDelay: '2s' }}>
            <IceCreamCone size={22} className="text-milk-300/15" />
          </div>
          <div className="absolute bottom-[25%] right-[12%] animate-float" style={{ animationDelay: '0.6s' }}>
            <Croissant size={18} className="text-milk-300/12" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.5rem] bg-milk-50 shadow-2xl shadow-black/30 ring-4 ring-milk-200/20">
            <img src="/CasaMilksLogo.jpeg" alt="Casa Milks" className="h-16 w-16 object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-milk-50">Casa Milks</h1>
          <p className="mt-1 text-sm font-light text-milk-200/60">Sistema de Pedidos y Facturación</p>
          <div className="mx-auto mt-4 flex items-center justify-center gap-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-milk-300/40" />
            <span className="h-1 w-1 rounded-full bg-milk-300/50" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-milk-300/40" />
          </div>
        </div>

        {/* Curved divider at bottom */}
        <svg className="absolute -bottom-[1px] left-0 right-0 w-full" viewBox="0 0 800 60" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 55c200 30 400-30 600 5s150-10 200 8v12H0z" fill="#fdf9f2" />
        </svg>
      </div>

      {/* ===== MOBILE BOTTOM HALF: Form (solo < lg) ===== */}
      <div className="flex flex-1 items-start justify-center bg-milk-50 px-5 pt-8 pb-6 lg:hidden">
        <div className="w-full max-w-sm">
          {/* Form card */}
          <div className="rounded-3xl border border-milk-200/80 bg-white p-8 shadow-xl shadow-cocoa-900/5">
            <div className="mb-7">
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cocoa-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-500">Acceso</span>
              </div>
              <h2 className="text-lg font-semibold text-cocoa-900">¡Bienvenido de nuevo!</h2>
              <p className="mt-0.5 text-sm text-cocoa-400">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-cocoa-800">Nombre de usuario</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cocoa-300">
                    <User size={16} />
                  </span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="username"
                    className="block w-full rounded-xl border border-cocoa-200 bg-milk-50/60 py-2.5 pl-10 pr-3.5 text-sm text-cocoa-900 placeholder-cocoa-300 shadow-sm transition-all duration-200 focus:border-cocoa-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-cocoa-500/10"
                    placeholder="Tu nombre de usuario"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-cocoa-800">Contraseña</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cocoa-300">
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-cocoa-200 bg-milk-50/60 py-2.5 pl-10 pr-11 text-sm text-cocoa-900 placeholder-cocoa-300 shadow-sm transition-all duration-200 focus:border-cocoa-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-cocoa-500/10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-cocoa-300 transition-colors hover:text-cocoa-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex animate-shake items-start gap-3 rounded-xl border border-red-200/80 bg-red-50 p-3.5">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cocoa-600 to-cocoa-700 px-4 py-2.5 text-sm font-semibold text-milk-50 shadow-lg shadow-cocoa-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-cocoa-700 hover:to-cocoa-800 hover:shadow-xl hover:shadow-cocoa-600/30 focus:outline-none focus:ring-2 focus:ring-cocoa-500 focus:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 pb-2 text-center text-xs text-cocoa-300">
            Casa Milks © {new Date().getFullYear()} — Latacunga, Ecuador
          </p>
        </div>
      </div>

      {/* ===== DESKTOP: Brand panel (solo lg+) ===== */}
      <div className="relative z-10 hidden w-[52%] items-center justify-center overflow-hidden bg-gradient-to-br from-cocoa-950 via-cocoa-900 to-cocoa-800 lg:flex">
        {/* Cow spot pattern */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="#f3e0c3">
            <path opacity="0.06" d="M130 90c40-30 100-20 115 25s-15 85-60 90-80-20-85-60 5-40 30-55z" />
            <path opacity="0.05" d="M560 60c35-20 85-5 90 35s-30 70-70 65-60-35-50-70 15-20 30-30z" />
            <path opacity="0.07" d="M640 420c30-25 80-15 90 25s-20 75-60 75-70-30-65-65 20-25 35-35z" />
            <path opacity="0.06" d="M100 480c35-15 80 5 85 45s-35 70-75 60-55-45-45-80 20-20 35-25z" />
            <path opacity="0.05" d="M360 620c30-20 75-10 85 30s-25 70-65 65-65-30-55-65 20-20 35-30z" />
            <path opacity="0.03" d="M380 180c25-15 65-5 70 30s-25 60-55 55-50-30-45-60 15-15 30-25z" />
          </g>
        </svg>

        {/* Glow */}
        <div className="absolute left-1/2 top-1/3 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cocoa-500/20 blur-3xl" />

        {/* Floating icons desktop */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[18%] top-[22%] animate-float">
            <Milk size={26} className="text-milk-300/25" />
          </div>
          <div className="absolute right-[20%] top-[30%] animate-float" style={{ animationDelay: '1.2s' }}>
            <Coffee size={22} className="text-milk-300/20" />
          </div>
          <div className="absolute bottom-[28%] left-[26%] animate-float" style={{ animationDelay: '2s' }}>
            <IceCreamCone size={30} className="text-milk-300/20" />
          </div>
          <div className="absolute bottom-[36%] right-[16%] animate-float" style={{ animationDelay: '0.6s' }}>
            <Croissant size={24} className="text-milk-300/15" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-md px-12 text-center">
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-milk-50 shadow-2xl shadow-black/40 ring-4 ring-milk-200/15">
            <img src="/CasaMilksLogo.jpeg" alt="Casa Milks" className="h-24 w-24 object-contain" />
          </div>
          <h1 className="mb-3 text-5xl font-bold tracking-tight text-milk-50">Casa Milks</h1>
          <p className="text-lg font-light text-milk-200/75">Sistema de Pedidos y Facturación</p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-milk-300/50" />
            <Milk size={16} className="text-milk-300/70" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-milk-300/50" />
          </div>

          <p className="mt-8 flex items-center justify-center gap-1.5 text-sm text-milk-200/45">
            <MapPin size={14} />
            Latacunga, Ecuador
          </p>
        </div>
      </div>

      {/* ===== DESKTOP: Login form (solo lg+) ===== */}
      <div className="relative z-10 hidden flex-1 items-center justify-center bg-milk-50 p-6 lg:flex">
        <div className="absolute right-0 top-0 h-96 w-96 -translate-y-1/2 translate-x-1/2 rounded-full bg-gradient-to-bl from-milk-200/60 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 -translate-x-1/2 translate-y-1/2 rounded-full bg-gradient-to-tr from-cocoa-200/30 to-transparent blur-3xl" />

        <div className="w-full max-w-sm px-4">
          <div className="rounded-3xl border border-milk-200/90 bg-white p-8 shadow-xl shadow-cocoa-900/5">
            <div className="mb-7">
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cocoa-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-cocoa-500">Acceso</span>
              </div>
              <h2 className="text-lg font-semibold text-cocoa-900">¡Bienvenido de nuevo!</h2>
              <p className="mt-0.5 text-sm text-cocoa-400">Ingresa tus credenciales para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-cocoa-800">Nombre de usuario</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cocoa-300">
                    <User size={16} />
                  </span>
                  <input
                    id="name"
                    type="text"
                    autoComplete="username"
                    className="block w-full rounded-xl border border-cocoa-200 bg-milk-50/60 py-2.5 pl-10 pr-3.5 text-sm text-cocoa-900 placeholder-cocoa-300 shadow-sm transition-all duration-200 focus:border-cocoa-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-cocoa-500/10"
                    placeholder="Tu nombre de usuario"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-cocoa-800">Contraseña</label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-cocoa-300">
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-cocoa-200 bg-milk-50/60 py-2.5 pl-10 pr-11 text-sm text-cocoa-900 placeholder-cocoa-300 shadow-sm transition-all duration-200 focus:border-cocoa-400 focus:bg-white focus:outline-none focus:ring-[3px] focus:ring-cocoa-500/10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-cocoa-300 transition-colors hover:text-cocoa-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex animate-shake items-start gap-3 rounded-xl border border-red-200/80 bg-red-50 p-3.5">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cocoa-600 to-cocoa-700 px-4 py-2.5 text-sm font-semibold text-milk-50 shadow-lg shadow-cocoa-600/25 transition-all duration-200 hover:-translate-y-0.5 hover:from-cocoa-700 hover:to-cocoa-800 hover:shadow-xl hover:shadow-cocoa-600/30 focus:outline-none focus:ring-2 focus:ring-cocoa-500 focus:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 pb-4 text-center text-xs text-cocoa-300">
            Casa Milks © {new Date().getFullYear()} — Latacunga, Ecuador
          </p>
        </div>
      </div>
    </div>
  );
}
