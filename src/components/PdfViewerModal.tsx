import React, { useState, useEffect } from 'react';
import { X, Download, Share2, Printer, FileText, Loader2, CheckCircle, AlertTriangle, HardDrive, ExternalLink } from 'lucide-react';
import { Inspection } from '../types';
import { generateInspectionPdf } from '../lib/pdfGenerator';
import { ShareModal } from './ShareModal';
import { useAuth } from '../context/AuthContext';
import {
  getCachedGoogleToken,
  setCachedGoogleToken,
  findOrCreateFolder,
  uploadFileToDrive,
} from '../services/driveService';
import { FirestoreService } from '../lib/firestoreSync';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: Inspection;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  inspection,
}) => {
  const { company } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [drivePdfUrl, setDrivePdfUrl] = useState<string | undefined>(inspection.drivePdfUrl);
  const [driveSaveSuccess, setDriveSaveSuccess] = useState(false);

  useEffect(() => {
    setDrivePdfUrl(inspection.drivePdfUrl);
  }, [inspection.drivePdfUrl]);

  // Ensure Google token is synchronized with company config
  useEffect(() => {
    if (company?.googleDriveConfig?.accessToken && !getCachedGoogleToken()) {
      setCachedGoogleToken(company.googleDriveConfig.accessToken, company.googleDriveConfig.email);
    }
  }, [company]);

  useEffect(() => {
    let url: string | null = null;
    if (isOpen && inspection) {
      setLoading(true);
      (async () => {
        try {
          const blob = await generateInspectionPdf(inspection, {
            returnBlob: true,
            download: false,
          });
          if (blob) {
            setPdfBlob(blob);
            url = URL.createObjectURL(blob);
            setPdfUrl(url);
          }
        } catch (e) {
          console.error('Error rendering PDF preview:', e);
        } finally {
          setLoading(false);
        }
      })();
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, inspection]);

  if (!isOpen) return null;

  const handleDownload = async () => {
    await generateInspectionPdf(inspection, { download: true });
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      printWindow?.print();
    }
  };

  const handleSaveToGoogleDrive = async () => {
    if (!company?.googleDriveConfig?.connected && !getCachedGoogleToken()) {
      alert('O Google Drive corporativo não está configurado pela administração da empresa. Entre em contato com um Gerente ou acesse a Central Dev para vincular.');
      return;
    }

    try {
      setSavingToDrive(true);
      let blob = pdfBlob;
      if (!blob) {
        blob = await generateInspectionPdf(inspection, {
          returnBlob: true,
          download: false,
        });
      }

      if (!blob) {
        throw new Error('Falha ao compilar o arquivo PDF.');
      }

      const compName = company?.tradeName || company?.name || 'CAST Inspect';
      const companyFolderId = await findOrCreateFolder(compName);
      const inspectionFolderId = await findOrCreateFolder(inspection.id, companyFolderId);

      const fileName = `Relatorio_Vistoria_${inspection.id}_${inspection.condominiumName}.pdf`
        .replace(/[/\\?%*:|"<>]/g, '_');

      const driveRes = await uploadFileToDrive({
        name: fileName,
        mimeType: 'application/pdf',
        blob,
        parentFolderId: inspectionFolderId,
      });

      // Update inspection with drive file ID and URL
      const updatedData = {
        drivePdfFileId: driveRes.id,
        drivePdfUrl: driveRes.webViewLink,
      };

      setDrivePdfUrl(driveRes.webViewLink);
      setDriveSaveSuccess(true);

      // Persist to server / Firestore
      await fetch(`/api/inspections/${inspection.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': inspection.companyId || '',
        },
        body: JSON.stringify(updatedData),
      }).catch(console.error);

      await FirestoreService.saveInspectionToFirestore({
        ...inspection,
        ...updatedData,
      }).catch(console.error);

      setTimeout(() => setDriveSaveSuccess(false), 5000);
      alert('Relatório PDF salvo com sucesso no Google Drive corporativo da empresa!');
    } catch (err: any) {
      console.error('Falha ao salvar PDF no Google Drive:', err);
      alert(`Erro ao salvar PDF no Google Drive: ${err.message || err}`);
    } finally {
      setSavingToDrive(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-hidden">
        <div className="bg-white rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="px-3 py-2.5 sm:px-6 sm:py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-base font-bold text-white leading-tight truncate max-w-[160px] sm:max-w-md">
                  Vistoria — {inspection.id}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate max-w-[160px] sm:max-w-md">
                  {inspection.condominiumName} &bull; {inspection.blockName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {drivePdfUrl ? (
                <a
                  href={drivePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg border border-emerald-500/50 transition-colors shadow-xs"
                  title="Abrir arquivo diretamente no Google Drive da Empresa"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-300" />
                  <span className="hidden sm:inline">No Drive</span>
                  <ExternalLink className="w-3 h-3 text-emerald-300" />
                </a>
              ) : (
                <button
                  type="button"
                  disabled={savingToDrive || loading}
                  onClick={handleSaveToGoogleDrive}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  title="Salvar cópia deste relatório PDF diretamente no Google Drive da Empresa"
                >
                  {savingToDrive ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="hidden sm:inline">Salvando...</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Salvar no Drive</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => setShowShareModal(true)}
                className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Compartilhar</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar PDF</span>
              </button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Verification Bar */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Grade Regulamentar: 5 fotos verticais fixas por linha
              </span>
              <span className="hidden md:inline-block text-slate-400">&bull;</span>
              <span className="hidden md:inline-block text-slate-600">
                Padrão CAST Inspect &bull; Proporção 3:4 (35.6mm &times; 47.5mm)
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <button
                onClick={handlePrint}
                className="hover:text-slate-900 flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </button>
            </div>
          </div>

          {/* PDF Preview Content */}
          <div className="flex-1 bg-slate-200 relative overflow-hidden flex items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-3 text-slate-600">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-medium">Gerando relatório técnico em alta precisão...</span>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full border-none"
                title="Pré-visualização do Relatório PDF"
              />
            ) : (
              <div className="text-center p-6 text-slate-500">
                <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p>Falha ao renderizar a pré-visualização do documento.</p>
                <button
                  onClick={handleDownload}
                  className="mt-3 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                >
                  Tentar Download Direto
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          inspection={inspection}
        />
      )}
    </>
  );
};
