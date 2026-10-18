import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  FileText,
  ExternalLink,
  Building,
  Search,
  Calendar,
  Share2,
  Camera,
  MapPin,
  Phone,
  User as UserIcon,
  AlertCircle,
  X,
  Maximize2,
  Eye,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardStats, Inspection, Condominium, InspectionItem, InspectionPhoto } from '../types';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { ShareModal } from '../components/ShareModal';
import { evaluateDateAlert, DateAlertEvaluation } from '../lib/dateAlertHelper';
import { getCachedInspectionsIDB } from '../lib/indexedDb';

interface DashboardProps {
  onNavigate: (view: string, param?: string) => void;
}

type ActiveDashboardView = 'main' | 'total' | 'completed' | 'in_progress' | 'maintenance';

export interface PendingMaintenanceRecord {
  id: string;
  inspectionId: string;
  inspectionDate: string; // Data da identificação formatada DD/MM/AAAA
  rawDate: string;
  inspectorName: string;
  inspectorRole?: string;
  condominiumId: string;
  condominiumName: string;
  condominiumAddress?: string;
  blockName: string;
  environmentName: string;
  itemName: string;
  description?: string;
  problem: string; // O problema / observações
  urgencyLevel: 'Crítica' | 'Alta' | 'Média' | 'Baixa'; // O grau de urgência
  alertBadgeText?: string | null;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
  daysUntilDue?: number;
  photos: InspectionPhoto[];
  rawInspection: Inspection;
}

interface CondoMaintenanceGroup {
  condoId: string;
  condoName: string;
  condoAddress: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  syndicName?: string;
  syndicPhone?: string;
  syndicEmail?: string;
  items: PendingMaintenanceRecord[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  latestDate?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { company, user, isDev } = useAuth();

  const [activeView, setActiveView] = useState<ActiveDashboardView>('main');
  const [selectedCondoForMaintenance, setSelectedCondoForMaintenance] = useState<string | null>(null);

  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [condos, setCondos] = useState<Condominium[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters inside views
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<string>('TODAS');
  const [totalStatusFilter, setTotalStatusFilter] = useState<'TODAS' | 'CONCLUIDA' | 'EM_ANDAMENTO'>('TODAS');

  // Modals
  const [selectedInspectionForPdf, setSelectedInspectionForPdf] = useState<Inspection | null>(null);
  const [selectedInspectionForShare, setSelectedInspectionForShare] = useState<Inspection | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; caption?: string; date?: string } | null>(null);

  // Fetch stats, inspections, and condos
  const loadDashboardData = async () => {
    if (!company) return;
    setLoading(true);
    try {
      if (navigator.onLine) {
        try {
          const [resStats, resInspections, resCondos] = await Promise.all([
            fetch('/api/stats', {
              headers: {
                'x-company-id': company.id,
                'x-user-role': user?.role || '',
              },
            }),
            fetch('/api/inspections', {
              headers: {
                'x-company-id': company.id,
              },
            }),
            fetch('/api/condominiums', {
              headers: {
                'x-company-id': company.id,
              },
            }),
          ]);

          if (resStats.ok) {
            const dataStats = await resStats.json();
            setStats(dataStats);
          }
          if (resInspections.ok) {
            const dataInspections = await resInspections.json();
            setInspections(Array.isArray(dataInspections) ? dataInspections : []);
          }
          if (resCondos.ok) {
            const dataCondos = await resCondos.json();
            setCondos(Array.isArray(dataCondos) ? dataCondos : []);
          }
        } catch (netErr) {
          console.warn('[Dashboard] Rede indisponível, recorrendo ao cache:', netErr);
        }
      }

      // Offline fallback
      if (inspections.length === 0) {
        const cached = await getCachedInspectionsIDB(company.id);
        if (cached && cached.length > 0) {
          setInspections(cached);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [company]);

  // Format date helper (YYYY-MM-DD -> DD/MM/YYYY)
  const formatDateBR = (dateStr?: string): string => {
    if (!dateStr) return 'Não informada';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Determine urgency level for an item
  const determineItemUrgency = (
    item: InspectionItem,
    alertEval: DateAlertEvaluation
  ): 'Crítica' | 'Alta' | 'Média' | 'Baixa' => {
    if (item.urgencyLevel) {
      return item.urgencyLevel;
    }
    if (alertEval.isExpired) {
      return 'Crítica';
    }
    if (alertEval.isExpiringSoon) {
      if (alertEval.daysRemaining !== null && alertEval.daysRemaining <= 7) {
        return 'Alta';
      }
      return 'Média';
    }
    const combined = `${item.name} ${item.description || ''} ${item.observations || ''}`.toLowerCase();
    if (
      combined.includes('vazamento') ||
      combined.includes('curto') ||
      combined.includes('risco') ||
      combined.includes('quebrado') ||
      combined.includes('perigo') ||
      combined.includes('grave') ||
      combined.includes('parada') ||
      combined.includes('urgente')
    ) {
      return 'Crítica';
    }
    if (item.status === 'AGENDAR MANUTENÇÃO') {
      return 'Alta';
    }
    return 'Média';
  };

  // Extract all pending maintenance records from all inspections
  const allPendingMaintenanceRecords: PendingMaintenanceRecord[] = useMemo(() => {
    const records: PendingMaintenanceRecord[] = [];

    inspections.forEach((insp) => {
      insp.environments?.forEach((env) => {
        env.items?.forEach((item) => {
          const alertEval = evaluateDateAlert(item.description, item.alertDate, !!item.alertEnabled);
          const isMaintenanceStatus = item.status === 'AGENDAR MANUTENÇÃO';

          if (isMaintenanceStatus || alertEval.isAlertTriggered) {
            const urgency = determineItemUrgency(item, alertEval);
            records.push({
              id: `${insp.id}_${env.id}_${item.id}`,
              inspectionId: insp.id,
              inspectionDate: formatDateBR(insp.date),
              rawDate: insp.date || '',
              inspectorName: insp.inspectorName,
              inspectorRole: insp.inspectorRole,
              condominiumId: insp.condominiumId || `cond_name_${insp.condominiumName}`,
              condominiumName: insp.condominiumName || 'Condomínio',
              condominiumAddress: insp.condominiumAddress,
              blockName: insp.blockName || 'Geral',
              environmentName: env.name,
              itemName: item.name,
              description: item.description,
              problem:
                item.observations && item.observations.trim()
                  ? item.observations
                  : alertEval.isAlertTriggered
                  ? alertEval.alertBadgeText || 'Alerta de vencimento/manutenção'
                  : 'Manutenção necessária identificada na vistoria.',
              urgencyLevel: urgency,
              alertBadgeText: alertEval.alertBadgeText,
              isExpired: alertEval.isExpired,
              isExpiringSoon: alertEval.isExpiringSoon,
              daysUntilDue: alertEval.daysRemaining !== null ? alertEval.daysRemaining : undefined,
              photos: item.photos || [],
              rawInspection: insp,
            });
          }
        });
      });
    });

    // Sort by urgency: Crítica first, then Alta, Média, Baixa, then most recent date
    const urgencyOrder: Record<string, number> = {
      Crítica: 1,
      Alta: 2,
      Média: 3,
      Baixa: 4,
    };

    records.sort((a, b) => {
      const uA = urgencyOrder[a.urgencyLevel] || 5;
      const uB = urgencyOrder[b.urgencyLevel] || 5;
      if (uA !== uB) return uA - uB;
      return (b.rawDate || '').localeCompare(a.rawDate || '');
    });

    return records;
  }, [inspections]);

  // Group pending maintenance by Condominium
  const condoMaintenanceGroups: CondoMaintenanceGroup[] = useMemo(() => {
    const map = new Map<string, CondoMaintenanceGroup>();

    // Seed from registered condominiums to ensure full address and syndic data
    condos.forEach((c) => {
      map.set(c.id, {
        condoId: c.id,
        condoName: c.name,
        condoAddress: c.address || 'Endereço não cadastrado',
        neighborhood: c.neighborhood,
        city: c.city,
        state: c.state,
        syndicName: c.syndicName,
        syndicPhone: c.syndicPhone,
        syndicEmail: c.syndicEmail,
        items: [],
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        latestDate: undefined,
      });
    });

    // Associate pending maintenance records to condominiums
    allPendingMaintenanceRecords.forEach((record) => {
      let group = map.get(record.condominiumId);
      if (!group) {
        // Fallback for custom or name-only condo key
        group = {
          condoId: record.condominiumId,
          condoName: record.condominiumName,
          condoAddress: record.condominiumAddress || 'Endereço registrado na vistoria',
          items: [],
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          latestDate: undefined,
        };
        map.set(record.condominiumId, group);
      }

      group.items.push(record);

      if (record.urgencyLevel === 'Crítica') group.criticalCount++;
      else if (record.urgencyLevel === 'Alta') group.highCount++;
      else if (record.urgencyLevel === 'Média') group.mediumCount++;
      else if (record.urgencyLevel === 'Baixa') group.lowCount++;

      if (!group.latestDate || (record.rawDate && record.rawDate > group.latestDate)) {
        group.latestDate = record.rawDate;
      }
    });

    // Filter to ONLY condominiums that actually have pending maintenance!
    const withPendencies = Array.from(map.values()).filter((g) => g.items.length > 0);

    // Sort condominiums: most critical items first, then most recent date
    withPendencies.sort((a, b) => {
      if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
      if (b.highCount !== a.highCount) return b.highCount - a.highCount;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return (b.latestDate || '').localeCompare(a.latestDate || '');
    });

    return withPendencies;
  }, [allPendingMaintenanceRecords, condos]);

  // Completed inspections
  const completedInspections = useMemo(() => {
    return inspections.filter((i) => i.status === 'CONCLUIDA');
  }, [inspections]);

  // In-progress inspections
  const inProgressInspections = useMemo(() => {
    return inspections.filter((i) => i.status === 'EM_ANDAMENTO');
  }, [inspections]);

  // Filtered completed inspections for 'completed' view
  const filteredCompleted = useMemo(() => {
    if (!searchTerm.trim()) return completedInspections;
    const term = searchTerm.toLowerCase();
    return completedInspections.filter(
      (i) =>
        i.condominiumName.toLowerCase().includes(term) ||
        i.blockName.toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term) ||
        i.inspectorName.toLowerCase().includes(term)
    );
  }, [completedInspections, searchTerm]);

  // Filtered in-progress inspections for 'in_progress' view
  const filteredInProgress = useMemo(() => {
    if (!searchTerm.trim()) return inProgressInspections;
    const term = searchTerm.toLowerCase();
    return inProgressInspections.filter(
      (i) =>
        i.condominiumName.toLowerCase().includes(term) ||
        i.blockName.toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term) ||
        i.inspectorName.toLowerCase().includes(term)
    );
  }, [inProgressInspections, searchTerm]);

  // Filtered total inspections for 'total' view
  const filteredTotal = useMemo(() => {
    let list = inspections;
    if (totalStatusFilter !== 'TODAS') {
      list = list.filter((i) => i.status === totalStatusFilter);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(
      (i) =>
        i.condominiumName.toLowerCase().includes(term) ||
        i.blockName.toLowerCase().includes(term) ||
        i.id.toLowerCase().includes(term) ||
        i.inspectorName.toLowerCase().includes(term)
    );
  }, [inspections, totalStatusFilter, searchTerm]);

  // Filtered condo groups for 'maintenance' view (Screen 1)
  const filteredCondoMaintenanceGroups = useMemo(() => {
    if (!searchTerm.trim()) return condoMaintenanceGroups;
    const term = searchTerm.toLowerCase();
    return condoMaintenanceGroups.filter(
      (g) =>
        g.condoName.toLowerCase().includes(term) ||
        g.condoAddress.toLowerCase().includes(term) ||
        (g.city && g.city.toLowerCase().includes(term))
    );
  }, [condoMaintenanceGroups, searchTerm]);

  // Active condominium group when selected for maintenance (Screen 2)
  const activeCondoForMaintenance = useMemo(() => {
    if (!selectedCondoForMaintenance) return null;
    return condoMaintenanceGroups.find((g) => g.condoId === selectedCondoForMaintenance) || null;
  }, [condoMaintenanceGroups, selectedCondoForMaintenance]);

  // Filtered items inside selected condominium
  const filteredActiveCondoItems = useMemo(() => {
    if (!activeCondoForMaintenance) return [];
    let items = activeCondoForMaintenance.items;

    if (selectedUrgencyFilter !== 'TODAS') {
      items = items.filter((it) => it.urgencyLevel === selectedUrgencyFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (it) =>
          it.itemName.toLowerCase().includes(term) ||
          (it.description && it.description.toLowerCase().includes(term)) ||
          it.problem.toLowerCase().includes(term) ||
          it.environmentName.toLowerCase().includes(term) ||
          it.blockName.toLowerCase().includes(term)
      );
    }

    return items;
  }, [activeCondoForMaintenance, selectedUrgencyFilter, searchTerm]);

  // Navigation handlers
  const handleOpenBlock = (view: ActiveDashboardView) => {
    setSearchTerm('');
    setSelectedUrgencyFilter('TODAS');
    setTotalStatusFilter('TODAS');
    setSelectedCondoForMaintenance(null);
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToMainDashboard = () => {
    setSearchTerm('');
    setSelectedCondoForMaintenance(null);
    setActiveView('main');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Urgency badge helper
  const renderUrgencyBadge = (urgency: 'Crítica' | 'Alta' | 'Média' | 'Baixa') => {
    switch (urgency) {
      case 'Crítica':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span>Urgência: Crítica</span>
          </span>
        );
      case 'Alta':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span>Urgência: Alta</span>
          </span>
        );
      case 'Média':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-800 border border-yellow-300">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Urgência: Média</span>
          </span>
        );
      case 'Baixa':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Urgência: Baixa</span>
          </span>
        );
    }
  };

  // =========================================================================
  // VIEW: COMPLETED INSPECTIONS ("VISTORIAS CONCLUÍDAS")
  // =========================================================================
  if (activeView === 'completed') {
    return (
      <div className="space-y-6 pb-16 w-full max-w-full">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToMainDashboard}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Vistorias Concluídas
                </h1>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shrink-0 self-start sm:self-center">
            <CheckCircle2 className="w-4 h-4" />
            <span>{completedInspections.length} laudo(s) concluído(s)</span>
          </span>
        </div>

        {/* Search input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            placeholder="BUSCAR POR CONDOMÍNIO, BLOCO, CÓDIGO OU VISTORIADOR..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 outline-none transition-colors shadow-2xs uppercase"
          />
        </div>

        {/* List of Completed Inspections */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {filteredCompleted.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Nenhuma vistoria concluída encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCompleted.map((insp) => (
                <div
                  key={insp.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {insp.condominiumName}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Concluída
                      </span>
                      {insp.structureVersion && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Versão {insp.structureVersion}
                        </span>
                      )}
                      {insp.criticalItemsCount && insp.criticalItemsCount > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                          {insp.criticalItemsCount} manutenção(ões) pendente(s)
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                      <span><strong>Bloco:</strong> {insp.blockName}</span>
                      <span>&bull;</span>
                      <span><strong>Código:</strong> {insp.id}</span>
                      <span>&bull;</span>
                      <span><strong>Data:</strong> {formatDateBR(insp.date)}</span>
                      <span>&bull;</span>
                      <span><strong>Vistoriador:</strong> {insp.inspectorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    <button
                      onClick={() => onNavigate('inspection-detail', insp.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes</span>
                    </button>

                    <button
                      onClick={() => setSelectedInspectionForPdf(insp)}
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                      title="Visualizar laudo técnico em PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Laudo PDF</span>
                    </button>

                    <button
                      onClick={() => setSelectedInspectionForShare(insp)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
                      title="Compartilhar laudo"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PDF and Share Modals */}
        {selectedInspectionForPdf && (
          <PdfViewerModal
            isOpen={!!selectedInspectionForPdf}
            onClose={() => setSelectedInspectionForPdf(null)}
            inspection={selectedInspectionForPdf}
          />
        )}
        {selectedInspectionForShare && (
          <ShareModal
            isOpen={!!selectedInspectionForShare}
            onClose={() => setSelectedInspectionForShare(null)}
            inspection={selectedInspectionForShare}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: IN-PROGRESS INSPECTIONS ("VISTORIAS EM ANDAMENTO")
  // =========================================================================
  if (activeView === 'in_progress') {
    return (
      <div className="space-y-6 pb-16 w-full max-w-full">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToMainDashboard}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Vistorias Em Andamento
                </h1>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shrink-0 self-start sm:self-center">
            <Clock className="w-4 h-4" />
            <span>{inProgressInspections.length} vistoria(s) em andamento</span>
          </span>
        </div>

        {/* Search input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            placeholder="BUSCAR POR CONDOMÍNIO, BLOCO, CÓDIGO OU VISTORIADOR..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-amber-500 outline-none transition-colors shadow-2xs uppercase"
          />
        </div>

        {/* List of In-Progress Inspections */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {filteredInProgress.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Nenhuma vistoria em andamento no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInProgress.map((insp) => (
                <div
                  key={insp.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {insp.condominiumName}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Em Andamento
                      </span>
                      {insp.structureVersion && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Versão {insp.structureVersion}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                      <span><strong>Bloco:</strong> {insp.blockName}</span>
                      <span>&bull;</span>
                      <span><strong>Código:</strong> {insp.id}</span>
                      <span>&bull;</span>
                      <span><strong>Data de Início:</strong> {formatDateBR(insp.date)}</span>
                      <span>&bull;</span>
                      <span><strong>Vistoriador:</strong> {insp.inspectorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    <button
                      onClick={() => onNavigate('edit-inspection', insp.id)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Continuar Vistoria</span>
                    </button>

                    <button
                      onClick={() => onNavigate('inspection-detail', insp.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: TOTAL INSPECTIONS ("TODAS AS VISTORIAS")
  // =========================================================================
  if (activeView === 'total') {
    return (
      <div className="space-y-6 pb-16 w-full max-w-full">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToMainDashboard}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Todas as Vistorias
                </h1>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold shrink-0 self-start sm:self-center">
            <ClipboardCheck className="w-4 h-4" />
            <span>{inspections.length} vistoria(s) no total</span>
          </span>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
              placeholder="BUSCAR POR CONDOMÍNIO, BLOCO, CÓDIGO OU VISTORIADOR..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none transition-colors shadow-2xs uppercase"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl shrink-0">
            {(['TODAS', 'CONCLUIDA', 'EM_ANDAMENTO'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setTotalStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  totalStatusFilter === st
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'TODAS'
                  ? 'Todas'
                  : st === 'CONCLUIDA'
                  ? 'Concluídas'
                  : 'Em Andamento'}
              </button>
            ))}
          </div>
        </div>

        {/* List of All Inspections */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {filteredTotal.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              Nenhuma vistoria encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTotal.map((insp) => (
                <div
                  key={insp.id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {insp.condominiumName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          insp.status === 'CONCLUIDA'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {insp.status === 'CONCLUIDA' ? 'Concluída' : 'Em Andamento'}
                      </span>
                      {insp.structureVersion && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Versão {insp.structureVersion}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-slate-500">
                      <span><strong>Bloco:</strong> {insp.blockName}</span>
                      <span>&bull;</span>
                      <span><strong>Código:</strong> {insp.id}</span>
                      <span>&bull;</span>
                      <span><strong>Data:</strong> {formatDateBR(insp.date)}</span>
                      <span>&bull;</span>
                      <span><strong>Vistoriador:</strong> {insp.inspectorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                    {insp.status === 'EM_ANDAMENTO' && (
                      <button
                        onClick={() => onNavigate('edit-inspection', insp.id)}
                        className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Continuar</span>
                      </button>
                    )}

                    <button
                      onClick={() => onNavigate('inspection-detail', insp.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhes</span>
                    </button>

                    {insp.status === 'CONCLUIDA' && (
                      <button
                        onClick={() => setSelectedInspectionForPdf(insp)}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                        title="Visualizar laudo técnico em PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PDF Modal */}
        {selectedInspectionForPdf && (
          <PdfViewerModal
            isOpen={!!selectedInspectionForPdf}
            onClose={() => setSelectedInspectionForPdf(null)}
            inspection={selectedInspectionForPdf}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAINTENANCE DRILLDOWN ("MANUTENÇÕES PENDENTES")
  // =========================================================================
  if (activeView === 'maintenance') {
    // -----------------------------------------------------------------------
    // SCREEN 2: A CONDOMINIUM IS SELECTED -> SHOW PENDING ITEMS FOR IT
    // "e ao clicar no condomínio, deve aparecer as manutenções pendentes com
    //  os dados importantes, como data da identificação, o problema e o grau de urgência."
    // -----------------------------------------------------------------------
    if (activeCondoForMaintenance) {
      return (
        <div className="space-y-6 pb-16 w-full max-w-full">
          {/* Header & Back to Condos List */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCondoForMaintenance(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs text-xs font-bold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Lista de Condomínios</span>
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {activeCondoForMaintenance.condoName}
                  </h1>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeCondoForMaintenance.condoAddress}</span>
                    {activeCondoForMaintenance.city && (
                      <span> - {activeCondoForMaintenance.city}/{activeCondoForMaintenance.state}</span>
                    )}
                  </span>
                  {activeCondoForMaintenance.syndicName && (
                    <>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Síndico: {activeCondoForMaintenance.syndicName}</span>
                        {activeCondoForMaintenance.syndicPhone && (
                          <span className="text-slate-400">({activeCondoForMaintenance.syndicPhone})</span>
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Total pending badge */}
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold shrink-0 self-start">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{activeCondoForMaintenance.items.length} pendência(s) de manutenção</span>
            </span>
          </div>

          {/* Filter Bar (Search + Urgency Tabs) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                placeholder="FILTRAR POR ITEM, PROBLEMA, AMBIENTE OU BLOCO..."
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-red-500 outline-none transition-colors shadow-2xs uppercase"
              />
            </div>

            {/* Urgency Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl shrink-0 overflow-x-auto">
              {(['TODAS', 'Crítica', 'Alta', 'Média', 'Baixa'] as const).map((urg) => (
                <button
                  key={urg}
                  onClick={() => setSelectedUrgencyFilter(urg)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedUrgencyFilter === urg
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {urg === 'TODAS' ? 'Todas' : urg}
                </button>
              ))}
            </div>
          </div>

          {/* Pending Maintenance Items List */}
          {filteredActiveCondoItems.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-xs text-slate-400 shadow-xs">
              Nenhuma pendência encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredActiveCondoItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-5 shadow-xs transition-all space-y-4 ${
                    item.urgencyLevel === 'Crítica'
                      ? 'border-red-300 ring-1 ring-red-100 bg-red-50/20'
                      : item.urgencyLevel === 'Alta'
                      ? 'border-amber-200 bg-amber-50/10'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Item Header: Name, Environment and Urgency Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {item.itemName}
                        </h3>
                      </div>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        <span><strong>Ambiente:</strong> {item.environmentName}</span>
                        <span className="mx-2">&bull;</span>
                        <span><strong>Bloco:</strong> {item.blockName}</span>
                      </div>
                    </div>

                    {/* DADO IMPORTANTE: O GRAU DE URGÊNCIA */}
                    <div className="shrink-0">
                      {renderUrgencyBadge(item.urgencyLevel)}
                    </div>
                  </div>

                  {/* DADOS IMPORTANTES: O PROBLEMA & DATA DA IDENTIFICAÇÃO */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Left: O Problema & Descrição */}
                    <div className="md:col-span-8 space-y-2.5">
                      {/* O Problema */}
                      <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 block">
                          Problema Identificado:
                        </span>
                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {item.problem}
                        </p>
                      </div>

                      {/* Descrição do item se existir */}
                      {item.description && item.description !== item.problem && (
                        <div className="bg-slate-50/60 border border-slate-200/60 rounded-xl p-3 space-y-1">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                            Descrição do Item:
                          </span>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      )}

                      {/* Alerta de data/vencimento se houver */}
                      {item.alertBadgeText && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>{item.alertBadgeText}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Data da Identificação & Vistoriador */}
                    <div className="md:col-span-4 bg-slate-50/70 border border-slate-200 rounded-xl p-3 space-y-2 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Data da Identificação
                        </span>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 mt-0.5 text-sm">
                          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{item.inspectionDate}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/70">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Vistoria de Origem
                        </span>
                        <span className="font-semibold text-slate-800 block mt-0.5">
                          {item.inspectionId}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          Vistoriador: {item.inspectorName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fotografias registradas do item */}
                  {item.photos && item.photos.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-slate-500" />
                          <span>Fotografias Registradas ({item.photos.length}):</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Clique na foto para ampliar
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        {item.photos.map((ph) => (
                          <div
                            key={ph.id}
                            onClick={() =>
                              setPreviewPhoto({
                                url: ph.url,
                                caption: ph.caption || item.itemName,
                                date: ph.takenAt ? formatDateBR(ph.takenAt.split('T')[0]) : item.inspectionDate,
                              })
                            }
                            className="relative w-20 h-24 rounded-lg overflow-hidden border border-slate-300 bg-slate-100 shadow-2xs group cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all shrink-0"
                          >
                            <img
                              src={ph.url}
                              alt={ph.caption || item.itemName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      Laudo associado: {item.inspectionId} ({item.condominiumName})
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onNavigate('inspection-detail', item.inspectionId)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Vistoria Completa</span>
                      </button>

                      <button
                        onClick={() => setSelectedInspectionForPdf(item.rawInspection)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Laudo PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Photo Modal */}
          {previewPhoto && (
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setPreviewPhoto(null)}
            >
              <div
                className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-3 p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {previewPhoto.caption || 'Fotografia da Pendência'}
                    </h4>
                    {previewPhoto.date && (
                      <span className="text-[11px] text-slate-500">
                        Registrada em: {previewPhoto.date}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewPhoto(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="max-h-[75vh] flex items-center justify-center overflow-hidden bg-slate-950 rounded-xl">
                  <img
                    src={previewPhoto.url}
                    alt={previewPhoto.caption || 'Foto'}
                    className="max-h-[75vh] w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PDF Modal */}
          {selectedInspectionForPdf && (
            <PdfViewerModal
              isOpen={!!selectedInspectionForPdf}
              onClose={() => setSelectedInspectionForPdf(null)}
              inspection={selectedInspectionForPdf}
            />
          )}
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // SCREEN 1: LIST OF CONDOMINIUMS WITH PENDING MAINTENANCE
    // "Sempre que abrir essa manutenção, deve vir a lista de condomínios com manutenções pendentes"
    // -----------------------------------------------------------------------
    return (
      <div className="space-y-6 pb-16 w-full max-w-full">
        {/* Header & Back to Dashboard */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackToMainDashboard}
              className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Dashboard</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Manutenções Pendentes
                </h1>
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold shrink-0 self-start sm:self-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>{condoMaintenanceGroups.length} condomínio(s) com pendências</span>
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            placeholder="BUSCAR CONDOMÍNIO POR NOME, ENDEREÇO OU CIDADE..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-red-500 outline-none transition-colors shadow-2xs uppercase"
          />
        </div>

        {/* Condominium Cards List */}
        {filteredCondoMaintenanceGroups.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500 shadow-xs space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">
              Nenhuma pendência de manutenção encontrada
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCondoMaintenanceGroups.map((group) => (
              <div
                key={group.condoId}
                onClick={() => setSelectedCondoForMaintenance(group.condoId)}
                className="bg-white border border-slate-200 hover:border-red-400 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group space-y-4"
              >
                <div className="space-y-3">
                  {/* Top: Condominium Name & Total Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-500 shrink-0 group-hover:text-red-600 transition-colors" />
                        <h2 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                          {group.condoName}
                        </h2>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{group.condoAddress}</span>
                      </div>
                    </div>

                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-200 shrink-0">
                      {group.items.length} pendência{group.items.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Urgency breakdown chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {group.criticalCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-600 text-white shadow-2xs">
                        {group.criticalCount} Crítica{group.criticalCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {group.highCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-white">
                        {group.highCount} Alta{group.highCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {group.mediumCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300">
                        {group.mediumCount} Média{group.mediumCount === 1 ? '' : 's'}
                      </span>
                    )}
                    {group.lowCount > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                        {group.lowCount} Baixa{group.lowCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {/* Síndico details if available */}
                  {group.syndicName && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-100">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Síndico: {group.syndicName}</span>
                      {group.syndicPhone && <span>&bull; {group.syndicPhone}</span>}
                    </div>
                  )}
                </div>

                {/* Card CTA Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {group.latestDate
                      ? `Última identificação: ${formatDateBR(group.latestDate)}`
                      : 'Pendências registradas'}
                  </span>
                  <div className="font-bold text-red-600 group-hover:text-red-700 flex items-center gap-1 transition-colors">
                    <span>Ver pendências</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN DASHBOARD ("DASHBOARD INICIAL")
  // "Na dashboard inicial do gerente e técnico baixos dos blocos
  //  não teve ter informações. Apenas os menus na parte de cima e os blocos no
  //  corpo da DASHBOARD. Ao clicar nos blocos, os mesmos devem abrir para mostrar
  //  o que o bloco destaca."
  // =========================================================================
  const totalCount = stats?.totalInspections || inspections.length;
  const completedCount = stats?.completedInspections || completedInspections.length;
  const inProgressCount = stats?.inProgressInspections || inProgressInspections.length;
  const pendingCount = allPendingMaintenanceRecords.length || stats?.criticalMaintenanceCount || 0;
  const condosWithPendenciesCount = condoMaintenanceGroups.length;

  return (
    <div className="space-y-6 pb-12 w-full max-w-full">
      {/* Header Clean */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate('templates')}
            className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-800 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs"
            title="Enviar planilha (Excel ou CSV) para criar modelo de vistoria"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Criar Modelo via Planilha</span>
          </button>

          {user && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Perfil: <strong className="text-slate-700">{user.role}</strong> ({user.name})
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards Grid (Compact 2x2 Grid: 2 linhas com 2 blocos pequenos) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-4xl">
        {/* BLOCO 1: TOTAL */}
        <div
          onClick={() => handleOpenBlock('total')}
          className="bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          title="Clique para abrir todas as vistorias"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-blue-600 transition-colors">
              Total
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors flex items-center justify-center">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {totalCount}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Vistorias registradas</p>
          </div>
        </div>

        {/* BLOCO 2: CONCLUÍDAS */}
        <div
          onClick={() => handleOpenBlock('completed')}
          className="bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          title="Clique para abrir vistorias concluídas"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              Concluídas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              {completedCount}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Laudos prontos</p>
          </div>
        </div>

        {/* BLOCO 3: EM ANDAMENTO */}
        <div
          onClick={() => handleOpenBlock('in_progress')}
          className="bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          title="Clique para abrir vistorias em andamento"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
              Em Andamento
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              {inProgressCount}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Em vistoria</p>
          </div>
        </div>

        {/* BLOCO 4: MANUTENÇÕES */}
        <div
          onClick={() => handleOpenBlock('maintenance')}
          className="bg-white border border-red-200 hover:border-red-400 hover:shadow-md rounded-2xl p-4 sm:p-5 shadow-xs transition-all cursor-pointer group"
          title="Clique para abrir condomínios com manutenções pendentes"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
              Manutenções
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-red-700">
              {pendingCount}
            </span>
            <p className="text-xs text-red-500 mt-0.5">
              {condosWithPendenciesCount > 0
                ? `Em ${condosWithPendenciesCount} condomínio(s)`
                : 'Alertas e manutenções prioritárias'}
            </p>
          </div>
        </div>
      </div>

      {/* 
        NO EXTRA TABLES OR INFORMATION BELOW THE BLOCKS ON MAIN DASHBOARD!
        As explicitly requested by the user:
        "Na dashboard inicial do gerente e técnico baixos dos blocos não teve ter informações.
         Apenas os menus na parte de cima e os blocos no corpo da DASHBOARD."
      */}
    </div>
  );
};
