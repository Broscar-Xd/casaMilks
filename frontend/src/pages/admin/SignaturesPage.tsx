import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Loader2, Upload, FileKey2, ShieldCheck, AlertTriangle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useBranch } from '@/contexts/BranchContext';
import type { DigitalSignature, ApiResponse } from '@/types';

export default function SignaturesPage() {
  const { currentBranch } = useBranch();
  const [signature, setSignature] = useState<DigitalSignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [p12File, setP12File] = useState<File | null>(null);
  const [p12Base64, setP12Base64] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [label, setLabel] = useState('');
  const [fileName, setFileName] = useState('');

  const fetchSignature = async () => {
    if (!currentBranch) return;
    try {
      const res = await api.get<ApiResponse<DigitalSignature | null>>(`/signatures/${currentBranch.id}`);
      if (res.success) setSignature(res.data ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSignature(); }, [currentBranch]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith('.p12') && !file.name.endsWith('.pfx')) {
      toast.error('El archivo debe ser .p12 o .pfx');
      return;
    }
    setP12File(file);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setP12Base64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!currentBranch) return;
    if (!p12Base64 || !password) {
      toast.error('Selecciona el archivo de firma y escribe su clave');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put<ApiResponse<DigitalSignature>>(`/signatures/${currentBranch.id}`, {
        p12Base64,
        password,
        label: label || undefined,
      });
      if (res.success) {
        toast.success('Firma electrónica guardada correctamente');
        setSignature(res.data ?? null);
        setP12File(null);
        setP12Base64('');
        setPassword('');
        setFileName('');
        setLabel('');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || 'Error al guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  const isExpiringSoon = signature?.validTo && new Date(signature.validTo).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
  const isExpired = signature?.validTo && new Date(signature.validTo).getTime() < Date.now();

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-cocoa-500" /></div>;
  if (!currentBranch) return <div className="flex h-64 items-center justify-center"><p className="text-cocoa-300">Selecciona un local</p></div>;

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Firma Electrónica SRI</h1>
        <p className="page-subtitle">{currentBranch.name} — Certificado digital para facturación electrónica</p>
      </div>

      {/* Estado actual */}
      {signature ? (
        <div className="card mb-6 overflow-hidden">
          <div className="border-b border-milk-200/70 bg-gradient-to-r from-emerald-50 to-transparent px-5 py-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <ShieldCheck size={22} />
            </span>
            <div>
              <p className="font-semibold text-cocoa-900">Firma configurada</p>
              <p className="text-xs text-cocoa-400">{signature.label}</p>
            </div>
            {isExpired ? (
              <span className="ml-auto badge-cancelled"><XCircle size={12} /> Expirada</span>
            ) : isExpiringSoon ? (
              <span className="ml-auto badge-pending"><AlertTriangle size={12} /> Vence pronto</span>
            ) : (
              <span className="ml-auto badge-ready"><CheckCircle2 size={12} /> Vigente</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 text-sm">
            <div>
              <p className="text-xs text-cocoa-300 mb-0.5">Titular del certificado</p>
              <p className="font-medium text-cocoa-800">{signature.certSubject}</p>
            </div>
            <div>
              <p className="text-xs text-cocoa-300 mb-0.5">Número de serie</p>
              <p className="font-medium text-cocoa-800 font-mono text-xs break-all">{signature.certSerial}</p>
            </div>
            <div>
              <p className="text-xs text-cocoa-300 mb-0.5">Válido desde</p>
              <p className="font-medium text-cocoa-800">
                {signature.validFrom ? new Date(signature.validFrom).toLocaleDateString('es-EC') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-cocoa-300 mb-0.5">Válido hasta</p>
              <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-cocoa-800'}`}>
                {signature.validTo ? new Date(signature.validTo).toLocaleDateString('es-EC') : '—'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-6 p-6 border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="font-semibold text-amber-800">No hay firma electrónica configurada</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Sube el certificado digital (.p12) emitido por el SRI para poder emitir facturas electrónicas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulario de carga */}
      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cocoa-100 text-cocoa-600">
            <FileKey2 size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-cocoa-900">{signature ? 'Reemplazar firma' : 'Subir firma electrónica'}</h2>
            <p className="text-xs text-cocoa-400">Certificado .p12 emitido por el SRI (antes Security Data)</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* File dropzone */}
          <div>
            <label className="label">Archivo de firma (.p12)</label>
            <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-all ${
              p12File ? 'border-emerald-300 bg-emerald-50/50' : 'border-cocoa-200 bg-milk-50/50 hover:border-cocoa-400 hover:bg-milk-100/50'
            }`}>
              <Upload size={24} className={`mb-2 ${p12File ? 'text-emerald-500' : 'text-cocoa-300'}`} />
              <p className="text-sm font-medium text-cocoa-700">
                {p12File ? fileName : 'Haz clic para seleccionar el certificado'}
              </p>
              <p className="text-xs text-cocoa-300 mt-1">{p12File ? 'Listo para subir' : 'Formato: .p12 o .pfx'}</p>
              <input
                type="file"
                accept=".p12,.pfx"
                className="hidden"
                onChange={e => handleFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="label">Clave del certificado</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-11"
                placeholder="Clave de la firma electrónica"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-cocoa-300 hover:text-cocoa-600"
                aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Etiqueta (opcional)</label>
            <input className="input" placeholder="Ej: Firma Casa Milks 2026" value={label} onChange={e => setLabel(e.target.value)} />
          </div>

          <button onClick={handleSave} disabled={saving || !p12Base64 || !password} className="btn-primary w-full">
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Validando y guardando...</>
            ) : (
              <><Upload size={16} /> {signature ? 'Reemplazar firma' : 'Guardar firma'}</>
            )}
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-cocoa-300">
        💡 La firma se valida al guardar: si el archivo o la clave son incorrectos, el sistema te avisará.
        El ambiente actual es <span className="font-semibold text-cocoa-500">PRUEBAS (celcer.sri.gob.ec)</span>.
        Para producción se debe cambiar la variable <code className="bg-milk-100 px-1 rounded">SRI_AMBIENTE=2</code>.
      </p>
    </div>
  );
}
