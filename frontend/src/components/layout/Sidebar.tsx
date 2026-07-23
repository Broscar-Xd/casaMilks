import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import {
  ShoppingCart, ChefHat, LayoutDashboard, Package, Layers,
  Users, ClipboardList, BarChart3, Settings, LogOut, Store,
  Menu, X, ChevronDown, Beef, ListChecks, Receipt,
} from 'lucide-react';
import { useState } from 'react';

const staffLinks = [
  { to: '/pos', label: 'POS', icon: ShoppingCart },
  { to: '/kitchen', label: 'Cocina', icon: ChefHat },
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
  { to: '/admin/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/admin/orders', label: 'Pedidos', icon: Receipt },
  { to: '/admin/branches', label: 'Locales', icon: Store },
  { to: '/admin/tables', label: 'Mesas', icon: LayoutDashboard },
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
        className="fixed top-4 left-4 z-50 lg:hidden rounded-lg bg-white p-2 shadow-sm border"
        aria-label="Menú"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-surface-200 transform transition-transform duration-200
        lg:translate-x-0 lg:static lg:z-auto
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center gap-3 px-5 border-b border-surface-100">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft overflow-hidden">
              <img src="/CasaMilksLogo.jpeg" alt="Casa Milks" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-surface-900">Casa Milks</h1>
              <p className="text-[10px] text-surface-400 font-medium">Sistema POS</p>
            </div>
          </div>

          {/* Branch selector */}
          <div className="relative px-3 py-2.5 border-b border-surface-100">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex w-full items-center justify-between rounded-xl bg-surface-50 px-3 py-2 text-sm text-surface-600 hover:bg-surface-100 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Store size={15} className="shrink-0 text-surface-400" />
                <span className="truncate">{currentBranch?.name || 'Seleccionar local'}</span>
              </div>
              <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${branchOpen ? 'rotate-180' : ''}`} />
            </button>
            {branchOpen && (
              <div className="absolute left-3 right-3 top-full z-10 mt-1.5 rounded-xl border border-surface-200 bg-white shadow-elevated">
                {branches.map((branch, idx) => (
                  <button
                    key={branch.id}
                    onClick={() => { setCurrentBranch(branch); setBranchOpen(false); }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors
                      ${idx === 0 ? 'rounded-t-xl' : ''}
                      ${idx === branches.length - 1 ? 'rounded-b-xl' : ''}
                      ${currentBranch?.id === branch.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-surface-600 hover:bg-surface-50'}`}
                  >
                    {branch.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 relative ${
                  isActive(link.to)
                    ? 'bg-brand-50 text-brand-700 shadow-soft before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:rounded-r-full before:bg-brand-500'
                    : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                }`}
              >
                <link.icon size={17} />
                {link.label}
              </Link>
            ))}
          </nav>

          {/* User info & logout */}
          <div className="border-t border-surface-100 px-3 py-3">
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600 font-semibold text-xs">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-800 truncate">{user?.email}</p>
                <p className="text-[10px] text-surface-400 font-medium">{isAdmin ? 'Administrador' : 'Personal'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-surface-400 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
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
