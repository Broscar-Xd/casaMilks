import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { BranchProvider } from '@/contexts/BranchContext';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/LoginPage';
import POSPage from '@/pages/pos/POSPage';
import KitchenPage from '@/pages/kitchen/KitchenPage';
import DashboardPage from '@/pages/admin/DashboardPage';
import ProductsPage from '@/pages/admin/ProductsPage';
import CategoriesPage from '@/pages/admin/CategoriesPage';
import IngredientsPage from '@/pages/admin/IngredientsPage';
import InventoryPage from '@/pages/admin/InventoryPage';
import UsersPage from '@/pages/admin/UsersPage';
import BranchesPage from '@/pages/admin/BranchesPage';
import TablesAdminPage from '@/pages/admin/TablesAdminPage';
import OrdersHistoryPage from '@/pages/admin/OrdersHistoryPage';
import ClosesPage from '@/pages/admin/ClosesPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import SuppliersPage from '@/pages/admin/SuppliersPage';
import SettingsPage from '@/pages/admin/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BranchProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/pos" element={<POSPage />} />
              <Route path="/kitchen" element={<KitchenPage />} />
              <Route path="/admin/dashboard" element={<DashboardPage />} />
              <Route path="/admin/products" element={<ProductsPage />} />
              <Route path="/admin/categories" element={<CategoriesPage />} />
              <Route path="/admin/ingredients" element={<IngredientsPage />} />
              <Route path="/admin/inventory" element={<InventoryPage />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/branches" element={<BranchesPage />} />
              <Route path="/admin/tables" element={<TablesAdminPage />} />
              <Route path="/admin/orders" element={<OrdersHistoryPage />} />
              <Route path="/admin/closes" element={<ClosesPage />} />
              <Route path="/admin/reports" element={<ReportsPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/" element={<Navigate to="/pos" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '14px' },
            }}
          />
        </BranchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
