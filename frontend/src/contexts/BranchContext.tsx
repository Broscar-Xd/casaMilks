import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '@/services/api';
import type { Branch, ApiResponse } from '@/types';

interface BranchContextType {
  currentBranch: Branch | null;
  branches: Branch[];
  setCurrentBranch: (branch: Branch) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(api.getToken());

  // Escucha cambios en el token para recargar cuando inicie sesión
  useEffect(() => {
    const interval = setInterval(() => {
      const current = api.getToken();
      setToken((prev) => (prev !== current ? current : prev));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const fetchBranches = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<ApiResponse<Branch[]>>('/branches');
      if (res.success && res.data) {
        setBranches(res.data);
        const stored = localStorage.getItem('currentBranch');
        const selected = stored
          ? res.data.find((b) => b.id === stored)
          : res.data[0];
        if (selected) {
          setCurrentBranch(selected);
        }
      }
    } catch {
      // Si no hay sesión, se ignora
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleSetBranch = (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('currentBranch', branch.id);
  };

  return (
    <BranchContext.Provider value={{ currentBranch, branches, setCurrentBranch: handleSetBranch, loading }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch debe usarse dentro de BranchProvider');
  return context;
}
