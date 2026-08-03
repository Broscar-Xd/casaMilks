import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import {
  ShoppingCart, ChefHat, LayoutDashboard, Package, Layers,
  Users, ClipboardList, BarChart3, Settings, LogOut, Store,
  Menu, X, ChevronDown, Beef, ListChecks, Receipt, FileKey2,
} from 'lucide-react';
import { useState } from 'react';

const staffLinks = [
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/kitchen', label: 'Cocina', icon: ChefHat },
  { to: '/admin/inventory', label: 'Inventario', icon: ClipboardList },
  { to: '/admin/suppliers', label: 'Proveedores', icon: Users },
];

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/kitchen', label: 'Cocina', icon: ChefHat },
  { to: '/admin/products', label: 'Productos', icon: Package },
  { to: '/admin/categories', label: 'Categorías', icon: Layers },
  { to: '/admin/ingredients', label: 'Insumos', icon: Beef },
  { to: '/admin/inventory', label: 'Inventario', icon: ClipboardList },
  { to: '/admin/users', label: 'Usuarios', icon: Users },
  { to: '/admin/closes', label: 'Cierre de Caja', icon: ListChecks },
  { to: '/admin/suppliers', label: 'Proveedores', icon: Users },
  { to: '/admin/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/admin/orders', label: 'Pedidos', icon: Receipt },
  { to: '/admin/branches', label: 'Locales', icon: Store },
  { to: '/admin/tables', label: 'Mesas', icon: LayoutDashboard },
  { to: '/admin/signatures', label: 'Firma SRI', icon: FileKey2 },
  { to: '/admin/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const { currentBranch, branches, setCurrentBranch } = useBranch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const location = useLocation();

  const links = isAdmin ? adminLinks : staffLinks;

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden rounded-xl bg-cocoa-900 p-2.5 text-milk-200 shadow-lg shadow-cocoa-900/30 border border-cocoa-700"
        aria-label="Menú"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-cocoa-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 max-lg:w-full max-lg:max-w-xs bg-gradient-to-b from-cocoa-950 via-cocoa-900 to-cocoa-950 border-r border-cocoa-800/60 transform transition-transform duration-200
        lg:translate-x-0 lg:static lg:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Subtle cow-spot decoration */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" viewBox="0 0 300 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="#f3e0c3">
            <path opacity="0.03" d="M40 60c25-18 60-12 70 15s-10 50-36 54-48-12-51-36 4-24 17-33z" />
            <path opacity="0.03" d="M190 520c20-14 50-8 56 15s-14 42-38 40-36-20-30-40 8-10 12-15z" />
            <path opacity="0.02" d="M70 300c18-12 45-6 52 14s-10 38-34 36-34-18-28-36 6-10 10-14z" />
          </g>
        </svg>

        <div className="relative flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 px-5 border-b border-white/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-milk-50 shadow-lg shadow-black/30 overflow-hidden ring-2 ring-milk-200/20">
              <img src="/CasaMilksLogo.jpeg" alt="Casa Milks" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-milk-50 tracking-tight">Casa Milks</h1>
              <p className="text-[10px] text-milk-300/60 font-medium">Sistema POS</p>
            </div>
          </div>

          {/* Branch selector */}
          <div className="relative px-3 py-3 border-b border-white/10">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex w-full items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-milk-200 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Store size={15} className="shrink-0 text-milk-300/70" />
                <span className="truncate">{currentBranch?.name || 'Seleccionar local'}</span>
              </div>
              <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${branchOpen ? 'rotate-180' : ''}`} />
            </button>
            {branchOpen && (
              <div className="absolute left-3 right-3 top-full z-10 mt-1.5 rounded-xl border border-cocoa-700 bg-cocoa-900 shadow-2xl shadow-black/40 overflow-hidden">
                {branches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => { setCurrentBranch(branch); setBranchOpen(false); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors
                      ${currentBranch?.id === branch.id ? 'bg-white/10 text-milk-100 font-medium' : 'text-milk-300/80 hover:bg-white/5'}`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 relative ${
                  isActive(link.to)
                    ? 'bg-gradient-to-r from-cocoa-500/25 to-cocoa-500/10 text-milk-50 shadow-inner before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:rounded-r-full before:bg-milk-400'
                    : 'text-milk-300/70 hover:bg-white/5 hover:text-milk-100'
                }`}
              >
                <link.icon size={17} />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User info & logout */}
          <div className="border-t border-white/10 px-3 py-3">
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cocoa-500 to-cocoa-700 text-milk-50 font-semibold text-xs ring-2 ring-milk-300/20">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-milk-100 truncate">{user?.email}</p>
                <p className="text-[10px] text-milk-300/50 font-medium">{isAdmin ? 'Administrador' : 'Personal'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-milk-300/60 hover:bg-red-500/15 hover:text-red-300 transition-all duration-150"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
