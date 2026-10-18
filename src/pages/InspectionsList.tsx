import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  FileText,
  Eye,
  Edit,
  Trash2,
  Share2,
  PlusCircle,
  Building,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  Loader2,
  WifiOff,
  ArrowLeft,
  ChevronRight,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Inspection, Condominium } from '../types';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { ShareModal } from '../components/ShareModal';
import {
  cacheInspectionsIDB,
  getCachedInspectionsIDB,
  getPendingInspectionsIDB,
} from '../lib/indexedDb';

interface InspectionsListProps {
  onNavigate: (view: string, param?: string) => void;
  initialCondominiumId?: string;
}

interface CondoGroup {
  id: string;
  name: string;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  syndicName?: string;
  syndicPhone?: string;
  inspectionsCount: number;
  completedCount: number;
  inProgressCount: number;
  criticalCount: number;
  latestInspectionDate?: string;
  inspections: Inspection[];
}

export const InspectionsList: React.FC<InspectionsListProps> = ({
  onNavigate,
  initialCondominiumId,
}) => {
  const { company, canExecuteInspection, canManageUsers } = useAuth();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [condos, setCondos] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected condominium (null = show all condominiums, string = show inspections for this condominium)
  const [selectedCondoId, setSelectedCondoId] = useState<string | null>(
    initialCondominiumId || null
  );

  // Filters for the Condominium list
  const [condoSearchTerm, setCondoSearchTerm] = useState('');

  // Filters for the Inspections list inside a Condominium
  const [inspectionSearchTerm, setInspectionSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Modals
  const [pdfInspection, setPdfInspection] = useState<Inspection | null>(null);
  const [shareInspection, setShareInspection] = useState<Inspection | null>(null);

  const fetchInspections = async () => {
    if (!company) return;
    setLoading(true);
    try {
      let list: Inspection[] = [];

      if (navigator.onLine) {
        try {
          const [resInsp, resCondos] = await Promise.all([
            fetch('/api/inspections', { headers: { 'x-company-id': company.id } }),
            fetch('/api/condominiums', { headers: { 'x-company-id': company.id } }),
          ]);

          if (resInsp.ok) {
            const data: Inspection[] = await resInsp.json();
            list = data;
            await cacheInspectionsIDB(data);
          }
          if (resCondos.ok) {
            const condosData = await resCondos.json();
            setCondos(Array.isArray(condosData) ? condosData : []);
          }
        } catch (netErr) {
          console.warn('Falha de rede em InspectionsList, recorrendo ao IndexedDB:', netErr);
        }
      }

      // If offline or fetch failed, load from IndexedDB cache
      if (list.length === 0) {
        list = await getCachedInspectionsIDB(company.id);
      }

      // Retrieve any pending offline inspections from IndexedDB
      const pending = await getPendingInspectionsIDB();
      const companyPending = pending.filter((p) => p.companyId === company.id);

      // Merge items
      const combinedMap = new Map<string, Inspection>();
      for (const item of list) {
        combinedMap.set(item.id, item);
      }
      for (const p of companyPending) {
        combinedMap.set(p.id, p);
      }

      setInspections(Array.from(combinedMap.values()));
    } catch (e) {
      console.error('Error loading inspections', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [company]);

  // Update selected condominium if initial prop changes
  useEffect(() => {
    if (initialCondominiumId) {
      setSelectedCondoId(initialCondominiumId);
    } else {
      setSelectedCondoId(null);
    }
  }, [initialCondominiumId]);

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Deseja realmente excluir a vistoria ${id}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/inspections/${id}`, {
        method: 'DELETE',
        headers: { 'x-company-id': company?.id || '' },
      });
      if (res.ok) {
        setInspections((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      alert('Erro ao excluir vistoria.');
    }
  };

  // Group inspections by Condominium
  const condoGroups: CondoGroup[] = useMemo(() => {
    const map = new Map<string, CondoGroup>();

    // 1. Initialize groups from all registered Condominiums
    condos.forEach((c) => {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        address: c.address || 'Endereço não cadastrado',
        neighborhood: c.neighborhood,
        city: c.city,
        state: c.state,
        syndicName: c.syndicName,
        syndicPhone: c.syndicPhone,
        inspectionsCount: 0,
        completedCount: 0,
        inProgressCount: 0,
        criticalCount: 0,
        latestInspectionDate: undefined,
        inspections: [],
      });
    });

    // 2. Associate each inspection to its condominium
    inspections.forEach((insp) => {
      const condoKey = insp.condominiumId || `cond_named_${insp.condominiumName}`;
      let group = map.get(condoKey);

      if (!group) {
        // Fallback for inspections belonging to an unregistered or custom typed condominium
        group = {
          id: condoKey,
          name: insp.condominiumName || 'Condomínio',
          address: insp.condominiumAddress || 'Local registrado em vistoria',
          inspectionsCount: 0,
          completedCount: 0,
          inProgressCount: 0,
          criticalCount: 0,
          latestInspectionDate: undefined,
          inspections: [],
        };
        map.set(condoKey, group);
      }

      group.inspections.push(insp);
      group.inspectionsCount++;

      if (insp.status === 'CONCLUIDA') {
        group.completedCount++;
      } else {
        group.inProgressCount++;
      }

      if (insp.criticalItemsCount && insp.criticalItemsCount > 0) {
        group.criticalCount += insp.criticalItemsCount;
      }

      // Track latest inspection date
      if (insp.date) {
        if (!group.latestInspectionDate || insp.date > group.latestInspectionDate) {
          group.latestInspectionDate = insp.date;
        }
      }
    });

    // Sort inspections inside each condominium by date descending
    map.forEach((g) => {
      g.inspections.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });

    // Return groups array sorted by: Condominiums with most recent inspections first, then alphabetical
    return Array.from(map.values()).sort((a, b) => {
      if (a.latestInspectionDate && b.latestInspectionDate) {
        return b.latestInspectionDate.localeCompare(a.latestInspectionDate);
      }
      if (a.latestInspectionDate) return -1;
      if (b.latestInspectionDate) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [condos, inspections]);

  // Filtered condominiums for the main view
  const filteredCondoGroups = useMemo(() => {
    if (!condoSearchTerm.trim()) return condoGroups;
    const term = condoSearchTerm.toLowerCase();
    return condoGroups.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term) ||
        (c.city && c.city.toLowerCase().includes(term))
    );
  }, [condoGroups, condoSearchTerm]);

  // Selected condominium object
  const activeCondoGroup = useMemo(() => {
    if (!selectedCondoId) return null;
    return condoGroups.find((c) => c.id === selectedCondoId) || null;
  }, [condoGroups, selectedCondoId]);

  // Filtered inspections inside the active condominium
  const filteredInspectionsForActiveCondo = useMemo(() => {
    if (!activeCondoGroup) return [];
    return activeCondoGroup.inspections.filter((insp) => {
      const matchesSearch =
        inspectionSearchTerm === '' ||
        insp.id.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
        insp.blockName.toLowerCase().includes(inspectionSearchTerm.toLowerCase()) ||
        insp.inspectorName.toLowerCase().includes(inspectionSearchTerm.toLowerCase());

      const matchesStatus = filterStatus === '' || insp.status === filterStatus;
      const matchesDate = filterDate === '' || insp.date === filterDate;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [activeCondoGroup, inspectionSearchTerm, filterStatus, filterDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <span className="text-xs font-semibold">Carregando vistorias e condomínios...</span>
      </div>
    );
  }

  // ==========================================
  // VIEW 1: CONDOMINIUM SELECTION VIEW
  // ==========================================
  if (!activeCondoGroup) {
    return (
      <div className="space-y-6 pb-16 w-full max-w-full">
        {/* Header and CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building className="w-6 h-6 text-blue-600" />
              <span>Vistorias por Condomínio</span>
            </h1>
          </div>

          {canExecuteInspection && (
            <button
              onClick={() => onNavigate('new-inspection')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Vistoria</span>
            </button>
          )}
        </div>

        {/* Search Bar for Condominiums */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={condoSearchTerm}
              onChange={(e) => setCondoSearchTerm(e.target.value.toUpperCase())}
              placeholder="BUSCAR CONDOMÍNIO POR NOME, ENDEREÇO OU CIDADE..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
            />
          </div>
        </div>

        {/* Condominium Cards Grid */}
        {filteredCondoGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <Building className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Nenhum condomínio encontrado</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCondoGroups.map((condo) => {
              const hasInspections = condo.inspectionsCount > 0;

              return (
                <div
                  key={condo.id}
                  onClick={() => setSelectedCondoId(condo.id)}
                  className="bg-white border border-slate-200 hover:border-blue-500 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md flex flex-col justify-between transition-all cursor-pointer group text-left"
                >
                  <div>
                    {/* Top Row: Icon + Count Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Building className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors tabular-nums">
                          {condo.inspectionsCount}{' '}
                          {condo.inspectionsCount === 1 ? 'vistoria salva' : 'vistorias salvas'}
                        </span>
                      </div>
                    </div>

                    {/* Condominium Name */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {condo.name}
                    </h3>

                    {/* Address */}
                    <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">
                        {condo.address}
                        {condo.neighborhood ? `, ${condo.neighborhood}` : ''}
                        {condo.city ? ` - ${condo.city}/${condo.state || ''}` : ''}
                      </span>
                    </div>

                    {/* Status Breakdown Badges */}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px]">
                      {hasInspections ? (
                        <>
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                            {condo.completedCount} concluída{condo.completedCount !== 1 ? 's' : ''}
                          </span>

                          {condo.inProgressCount > 0 && (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-medium">
                              {condo.inProgressCount} em andamento
                            </span>
                          )}

                          {condo.criticalCount > 0 && (
                            <span className="text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {condo.criticalCount} pendência{condo.criticalCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Nenhuma vistoria salva</span>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom: Latest Inspection & Access button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="text-[11px]">
                      {condo.latestInspectionDate ? (
                        <>Última em: <strong className="text-slate-700">{condo.latestInspectionDate}</strong></>
                      ) : (
                        'Sem histórico'
                      )}
                    </span>

                    <span className="font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1">
                      <span>Ver Vistorias</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: INSPECTIONS OF THE SELECTED CONDOMINIUM
  // ==========================================
  return (
    <div className="space-y-6 pb-16 w-full max-w-full">
      {/* Back button and Condo Header */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => setSelectedCondoId(null)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Todos os Condomínios</span>
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {activeCondoGroup.name}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 tabular-nums">
                  {activeCondoGroup.inspectionsCount}{' '}
                  {activeCondoGroup.inspectionsCount === 1 ? 'vistoria salva' : 'vistorias salvas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {activeCondoGroup.address}
                  {activeCondoGroup.neighborhood ? `, ${activeCondoGroup.neighborhood}` : ''}
                  {activeCondoGroup.city ? ` - ${activeCondoGroup.city}/${activeCondoGroup.state || ''}` : ''}
                </span>
                {activeCondoGroup.syndicName && (
                  <span> &bull; Síndico: {activeCondoGroup.syndicName}</span>
                )}
              </p>
            </div>
          </div>

          {canExecuteInspection && (
            <button
              onClick={() => onNavigate('new-inspection', selectedCondoId || undefined)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all active:scale-95 shrink-0 self-start md:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Vistoria</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar for this condominium's inspections */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={inspectionSearchTerm}
              onChange={(e) => setInspectionSearchTerm(e.target.value.toUpperCase())}
              placeholder="BUSCAR POR CÓDIGO, VISTORIADOR, BLOCO..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
            />
          </div>

          {/* Filter by Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Todos os Status</option>
              <option value="CONCLUIDA">Concluídas</option>
              <option value="EM_ANDAMENTO">Em Andamento</option>
            </select>
          </div>

          {/* Filter by Date */}
          <div>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {(inspectionSearchTerm || filterStatus || filterDate) && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>Filtros ativos ({filteredInspectionsForActiveCondo.length} resultados)</span>
            <button
              onClick={() => {
                setInspectionSearchTerm('');
                setFilterStatus('');
                setFilterDate('');
              }}
              className="text-blue-600 hover:underline font-semibold"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Inspections Grid for this condominium */}
      {filteredInspectionsForActiveCondo.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <ClipboardList className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nenhum laudo encontrado</h3>
          {canExecuteInspection && (
            <button
              onClick={() => onNavigate('new-inspection', selectedCondoId || undefined)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Criar Vistoria Agora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInspectionsForActiveCondo.map((insp) => {
            const isCompleted = insp.status === 'CONCLUIDA';
            const critical = insp.criticalItemsCount || 0;

            // Total photos in this inspection
            let totalPhotos = 0;
            insp.environments?.forEach((e) => {
              e.items?.forEach((i) => {
                totalPhotos += i.photos?.length || 0;
              });
            });

            return (
              <div
                key={insp.id}
                className="bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between transition-all group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-extrabold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                        {insp.id}
                      </span>
                      {insp.structureVersion && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          Versão {insp.structureVersion}
                        </span>
                      )}
                      {insp.syncStatus === 'pending_sync' && (
                        <span
                          className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs"
                          title="Vistoria salva localmente, aguardando sincronização"
                        >
                          <WifiOff className="w-2.5 h-2.5 text-amber-600" />
                          <span>Offline</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isCompleted ? 'Concluída' : 'Em Andamento'}
                    </span>
                  </div>

                  {/* Block / Torre & Environment count */}
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {insp.blockName || 'Bloco Geral'}
                  </h3>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">
                    {insp.environments?.length || 0} ambientes avaliados
                  </div>

                  {/* Details List */}
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-500">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Data da Inspeção:</span>
                      </span>
                      <span className="font-semibold text-slate-700">{insp.date}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>Vistoriador:</span>
                      </span>
                      <span className="font-semibold text-slate-700 truncate max-w-[130px]">
                        {insp.inspectorName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Registros Fotográficos:</span>
                      <span className="font-semibold text-slate-700">{totalPhotos} fotos</span>
                    </div>
                  </div>

                  {/* Status Summary Banner */}
                  <div className="mt-3 p-2 rounded-xl bg-slate-50 flex items-center justify-between text-xs">
                    {critical > 0 ? (
                      <span className="flex items-center gap-1 text-red-700 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        {critical} Manutenções a Agendar
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Conforme / Manutenção em Dia
                      </span>
                    )}

                    {insp.geolocation && (
                      <span
                        className="text-[10px] text-blue-700 font-semibold bg-blue-100/70 px-1.5 py-0.5 rounded flex items-center gap-0.5"
                        title="GPS confirmado no local"
                      >
                        <MapPin className="w-3 h-3" /> GPS
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onNavigate('inspection-detail', insp.id)}
                      className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="Abrir Detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {canExecuteInspection && (
                      <button
                        onClick={() => onNavigate('edit-inspection', insp.id)}
                        className="p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar Itens"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => setShareInspection(insp)}
                      className="p-2 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      title="Compartilhar"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>

                    {canManageUsers && (
                      <button
                        onClick={() => handleDelete(insp.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Excluir Vistoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Primary PDF Report Button */}
                  <button
                    onClick={() => setPdfInspection(insp)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm transition-colors shrink-0"
                    title="Visualizar e Baixar Relatório PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PDF Viewer Modal */}
      {pdfInspection && (
        <PdfViewerModal
          isOpen={!!pdfInspection}
          onClose={() => setPdfInspection(null)}
          inspection={pdfInspection}
        />
      )}

      {/* Share Modal */}
      {shareInspection && (
        <ShareModal
          isOpen={!!shareInspection}
          onClose={() => setShareInspection(null)}
          inspection={shareInspection}
        />
      )}
    </div>
  );
};
