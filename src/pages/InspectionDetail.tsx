import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  FileText,
  Share2,
  Edit,
  Building,
  Calendar,
  UserCheck,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  PenTool,
  Clock,
  Sparkles,
  Loader2,
  Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Inspection, InspectionItem } from '../types';
import { PdfViewerModal } from '../components/PdfViewerModal';
import { ShareModal } from '../components/ShareModal';
import { generateInspectionPdf } from '../lib/pdfGenerator';
import { getCachedInspectionsIDB, getPendingInspectionsIDB } from '../lib/indexedDb';
import { evaluateDateAlert } from '../lib/dateAlertHelper';
import { WifiOff } from 'lucide-react';

interface InspectionDetailProps {
  inspectionId: string;
  onNavigate: (view: string, param?: string) => void;
}

export const InspectionDetail: React.FC<InspectionDetailProps> = ({
  inspectionId,
  onNavigate,
}) => {
  const { company, canExecuteInspection } = useAuth();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [testingPdf, setTestingPdf] = useState(false);
  const [selectedTowerFilter, setSelectedTowerFilter] = useState('TODAS');

  useEffect(() => {
    async function load() {
      if (!inspectionId) return;
      setLoading(true);

      // Attempt network fetch if online
      if (navigator.onLine && company) {
        try {
          const res = await fetch(`/api/inspections/${inspectionId}`, {
            headers: { 'x-company-id': company.id },
          });
          if (res.ok) {
            const data = await res.json();
            setInspection(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Network load failed, checking IndexedDB cache...', e);
        }
      }

      // Offline fallback: load from IndexedDB
      try {
        const pending = await getPendingInspectionsIDB();
        const foundPending = pending.find((i) => i.id === inspectionId);
        if (foundPending) {
          setInspection(foundPending);
          setLoading(false);
          return;
        }

        const cached = await getCachedInspectionsIDB();
        const foundCached = cached.find((i) => i.id === inspectionId);
        if (foundCached) {
          setInspection(foundCached);
          setLoading(false);
          return;
        }
      } catch (idbErr) {
        console.error('Error loading from IndexedDB', idbErr);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [company, inspectionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <span className="text-xs font-semibold">Carregando detalhes da vistoria...</span>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800">Vistoria não encontrada</h3>
        <button
          onClick={() => onNavigate('inspections')}
          className="mt-4 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-xl"
        >
          Voltar para Vistorias
        </button>
      </div>
    );
  }

  const isCompleted = inspection.status === 'CONCLUIDA';
  const critical = inspection.criticalItemsCount || 0;

  // Test generator helper with arbitrary photos count (to satisfy prompt requirement #32)
  const runPdfPhotosTest = async (photoCount: number) => {
    if (!inspection) return;
    setTestingPdf(true);

    // Deep clone inspection
    const clone: Inspection = JSON.parse(JSON.stringify(inspection));
    if (clone.environments.length > 0 && clone.environments[0].items.length > 0) {
      const targetItem = clone.environments[0].items[0];
      targetItem.photos = [];

      // Generate synthetic vertical 3:4 photos
      for (let i = 1; i <= photoCount; i++) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
          <rect width="300" height="400" fill="#1e293b"/>
          <rect x="15" y="15" width="270" height="370" fill="none" stroke="#3b82f6" stroke-width="4"/>
          <circle cx="150" cy="160" r="50" fill="#3b82f6" fill-opacity="0.3"/>
          <text x="150" y="240" fill="#ffffff" font-family="Arial" font-size="20" font-weight="bold" text-anchor="middle">FOTO #${i}</text>
          <text x="150" y="270" fill="#93c5fd" font-family="Arial" font-size="12" text-anchor="middle">PROPORÇÃO VERTICAL 3:4</text>
          <rect x="50" y="310" width="200" height="28" rx="4" fill="#0f172a"/>
          <text x="150" y="328" fill="#e2e8f0" font-family="Arial" font-size="10" text-anchor="middle">CAST INSPECT TESTE</text>
        </svg>`;
        targetItem.photos.push({
          id: `test_ph_${i}`,
          url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
          caption: `Foto de Teste #${i}`,
          takenAt: new Date().toISOString(),
          isVertical: true,
        });
      }
    }

    await generateInspectionPdf(clone, {
      download: true,
      fileName: `TESTE_${photoCount}_FOTOS_${clone.id}.pdf`,
    });
    setTestingPdf(false);
  };

  return (
    <div className="max-w-5xl w-full mx-auto space-y-6 pb-20">
      {/* Back button and quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => onNavigate('inspections')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Lista de Vistorias</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {canExecuteInspection && (
            <button
              onClick={() => onNavigate('edit-inspection', inspection.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Editar</span>
            </button>
          )}

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Compartilhar</span>
          </button>

          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Visualizar / Baixar PDF</span>
          </button>
        </div>
      </div>

      {/* Main Inspection Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                {inspection.id}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isCompleted ? 'Concluída' : 'Em Andamento'}
              </span>
              {inspection.syncStatus === 'pending_sync' && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Salvo no IndexedDB (Offline)</span>
                </span>
              )}
              <span className="text-xs text-slate-400 font-medium">
                {inspection.templateName}
              </span>
              {inspection.structureVersion && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Versão {inspection.structureVersion}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              {inspection.condominiumName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              {inspection.blockName} &bull; {inspection.condominiumAddress}
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs space-y-1 self-start sm:self-auto min-w-[200px]">
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              Dados da Inspeção
            </div>
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Data: {inspection.date}</span>
            </div>
            <div className="text-slate-600 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{inspection.inspectorName}</span>
            </div>
            {inspection.inspectorDoc && (
              <div className="text-slate-500 text-[11px] pl-5">
                {inspection.inspectorDoc}
              </div>
            )}
          </div>
        </div>

        {/* GPS Geolocation Banner */}
        {inspection.geolocation && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Presença no Condomínio Confirmada por GPS:</span>{' '}
                <span className="text-emerald-800">
                  Lat: {inspection.geolocation.latitude.toFixed(5)}, Long:{' '}
                  {inspection.geolocation.longitude.toFixed(5)}{' '}
                  {inspection.geolocation.accuracy
                    ? `(Precisão: ${inspection.geolocation.accuracy.toFixed(1)}m)`
                    : ''}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold shrink-0">
              Registro Auditável
            </span>
          </div>
        )}

        {/* Critical Maintenance Summary Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2">
            {critical > 0 ? (
              <span className="flex items-center gap-1.5 text-red-700 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                {critical} item(ns) com solicitação de agendamento de manutenção corretiva
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Todos os itens avaliados em perfeita conformidade (OK, MANUTENÇÃO EM DIA)
              </span>
            )}
          </div>
          {inspection.supervisorNotified && (
            <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">
              Gerente Notificado
            </span>
          )}
        </div>
      </div>

      {/* Environments and Items Breakdown */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <h2 className="text-base font-bold text-slate-900">
            Ambientes e Itens Inspecionados
          </h2>
          {(() => {
            const towersList = Array.from(
              new Set(inspection.environments.map((e) => e.tower).filter(Boolean) as string[])
            );
            if (towersList.length <= 1) return null;
            return (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedTowerFilter('TODAS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    selectedTowerFilter === 'TODAS'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Todas as Torres ({inspection.environments.length})
                </button>
                {towersList.map((tName) => {
                  const count = inspection.environments.filter((e) => (e.tower || 'TORRE ÚNICA') === tName).length;
                  return (
                    <button
                      key={tName}
                      type="button"
                      onClick={() => setSelectedTowerFilter(tName)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1 ${
                        selectedTowerFilter === tName
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>🏢 {tName}</span>
                      <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {(() => {
          const filteredEnvs = inspection.environments.filter(
            (e) => selectedTowerFilter === 'TODAS' || (e.tower || 'TORRE ÚNICA') === selectedTowerFilter
          );

          return filteredEnvs.map((env, eIdx) => {
            const isFirstOfTower =
              env.tower &&
              (eIdx === 0 || filteredEnvs[eIdx - 1]?.tower !== env.tower);

            return (
              <React.Fragment key={env.id}>
                {isFirstOfTower && (
                  <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-sm mt-4 first:mt-0">
                    <div className="flex items-center gap-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider">
                      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs flex items-center justify-center font-black">
                        🏢
                      </span>
                      <span>Torre: {env.tower}</span>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm uppercase tracking-wider">
                      <span className="w-5 h-5 rounded bg-blue-600 text-white text-[11px] flex items-center justify-center font-bold">
                        {eIdx + 1}
                      </span>
                      {env.tower && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/25 text-blue-300 border border-blue-400/30 shrink-0">
                          🏢 {env.tower}
                        </span>
                      )}
                      <span>{env.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {env.items.length} itens avaliados
                    </span>
                  </div>

            <div className="p-4 divide-y divide-slate-100 space-y-4">
              {env.items.map((item, iIdx) => {
                const isOk = item.status === 'OK, MANUTENÇÃO EM DIA';
                const isMaintenance = item.status === 'AGENDAR MANUTENÇÃO';
                const photos = item.photos || [];
                const photosCount = photos.length;
                const alertEval = evaluateDateAlert(item.description, item.alertDate, !!item.alertEnabled);

                return (
                  <div key={item.id} className="pt-4 first:pt-0 space-y-2.5">
                    {/* Item Name and Status (o que foi feito) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {iIdx + 1}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {item.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {isMaintenance && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded shadow-2xs ${
                              (item.urgencyLevel || 'Alta') === 'Crítica'
                                ? 'bg-red-600 text-white'
                                : (item.urgencyLevel || 'Alta') === 'Alta'
                                ? 'bg-amber-600 text-white'
                                : (item.urgencyLevel || 'Alta') === 'Média'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            Urgência: {item.urgencyLevel || 'Alta'}
                          </span>
                        )}
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-lg border shadow-2xs ${
                            isOk
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          {item.status || 'NÃO AVALIADO'}
                        </span>
                      </div>
                    </div>

                    {/* Descrição do Item com Alerta de Vencimento */}
                    {item.description && (
                      <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70 text-xs space-y-1">
                        <div>
                          <span className="font-bold text-slate-700">Descrição: </span>
                          <span className="text-slate-800">{item.description}</span>
                        </div>

                        {/* Alert Status Badge if enabled */}
                        {item.alertEnabled && alertEval.formattedDate && (
                          <div className="flex items-center gap-1.5 pt-1">
                            {alertEval.isExpired ? (
                              <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded shadow-2xs">
                                🚨 VENCIDO há {Math.abs(alertEval.daysRemaining || 0)} dias ({alertEval.formattedDate})
                              </span>
                            ) : alertEval.isExpiringSoon ? (
                              <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded">
                                ⚠️ Vence em {alertEval.daysRemaining} dias ({alertEval.formattedDate})
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                ✓ Em dia (vence em {alertEval.formattedDate})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fotografias Verticais */}
                    {photosCount > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                          <span>Fotografias ({photosCount}):</span>
                        </div>

                        {/* Strict 5-column grid: photos retain identical fixed size regardless of count */}
                        <div className="grid grid-cols-5 gap-2 max-w-2xl">
                          {photos.map((ph, pIdx) => (
                            <div
                              key={ph.id}
                              className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group"
                              style={{ aspectRatio: '3/4' }}
                            >
                              <img
                                src={ph.url}
                                alt={ph.caption || `Foto #${pIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                #{pIdx + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Campo Observação com as informações */}
                    {item.observations && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs text-slate-700">
                        <span className="font-bold text-slate-700">Observações: </span>
                        <span>{item.observations}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </React.Fragment>
      );
    });
  })()}
</div>

      {/* General Notes and Signatures Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <PenTool className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">
            Considerações Finais e Assinaturas Registradas
          </h2>
        </div>

        {inspection.generalNotes && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-800 block mb-1">Parecer Técnico:</span>
            {inspection.generalNotes}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Technician Signature Box */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center min-h-[160px]">
            <span className="text-xs font-bold text-slate-800">
              Responsável Técnico / Vistoriador
            </span>
            <div className="my-2 flex-1 flex items-center justify-center">
              {inspection.technicianSignature ? (
                <img
                  src={inspection.technicianSignature}
                  alt="Assinatura Técnica"
                  className="max-h-16 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Assinatura pendente
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">
                {inspection.technicianName || inspection.inspectorName}
              </div>
              <div className="text-[10px] text-slate-500">
                {inspection.inspectorDoc || 'Reg. Profissional'}
              </div>
            </div>
          </div>

          {/* Syndic Signature Box */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col items-center justify-between text-center min-h-[160px]">
            <span className="text-xs font-bold text-slate-800">
              Administração Predial / Síndico
            </span>
            <div className="my-2 flex-1 flex items-center justify-center">
              {inspection.syndicSignature ? (
                <img
                  src={inspection.syndicSignature}
                  alt="Assinatura Síndico"
                  className="max-h-16 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Assinatura pendente
                </span>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">
                {inspection.syndicName || 'Administração do Condomínio'}
              </div>
              <div className="text-[10px] text-slate-500">
                Ciência do Laudo Técnico
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {showPdfModal && (
        <PdfViewerModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          inspection={inspection}
        />
      )}

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          inspection={inspection}
        />
      )}
    </div>
  );
};
