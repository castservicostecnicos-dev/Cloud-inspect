import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Trash2, X, Check, Image as ImageIcon, Loader2, CloudUpload, ExternalLink, HardDrive, ShieldAlert } from 'lucide-react';
import { InspectionPhoto } from '../types';
import { processInspectionPhoto } from '../lib/imageProcessor';
import { useAuth } from '../context/AuthContext';
import {
  signInWithGoogleDrive,
  getCachedGoogleToken,
  setCachedGoogleToken,
  getGoogleUser,
  getDriveEmail,
  disconnectGoogleDrive,
  uploadFileToDrive,
  findOrCreateFolder,
  connectCompanyGoogleDrive,
  disconnectCompanyGoogleDrive,
} from '../services/driveService';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  environmentName: string;
  photos: InspectionPhoto[];
  onUpdatePhotos: (photos: InspectionPhoto[]) => void;
  inspectionId?: string;
  companyName?: string;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  itemName,
  environmentName,
  photos,
  onUpdatePhotos,
  inspectionId = 'Vistoria',
  companyName = 'CAST Inspect',
}) => {
  const { user, company, canManageCompanies, isDev } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [syncingDrive, setSyncingDrive] = useState(false);
  const [driveConnected, setDriveConnected] = useState(!!getCachedGoogleToken());
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(getDriveEmail());
  const [localPhotos, setLocalPhotos] = useState<InspectionPhoto[]>(photos);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Can this user connect/configure the corporate Google Drive?
  const canConfigureDrive = canManageCompanies || isDev;

  useEffect(() => {
    setLocalPhotos(photos);
  }, [photos]);

  useEffect(() => {
    // Check local token first
    const hasLocalToken = !!getCachedGoogleToken();
    if (hasLocalToken) {
      setDriveConnected(true);
      setDriveUserEmail(getDriveEmail());
    } else if (company?.googleDriveConfig?.connected) {
      // Company has configured Drive
      setDriveConnected(true);
      setDriveUserEmail(company.googleDriveConfig.email || 'Conta Corporativa');
      if (company.googleDriveConfig.accessToken) {
        setCachedGoogleToken(company.googleDriveConfig.accessToken, company.googleDriveConfig.email);
      }
    } else {
      setDriveConnected(false);
      setDriveUserEmail(null);
    }
  }, [isOpen, company]);

  if (!isOpen) return null;

  const handleConnectDrive = async () => {
    if (!canConfigureDrive) {
      alert('Acesso restrito: Apenas a administração da empresa ou desenvolvedores podem vincular a conta do Google Drive corporativo.');
      return;
    }

    try {
      setSyncingDrive(true);
      if (company && user) {
        const { config } = await connectCompanyGoogleDrive(company.id, {
          id: user.id,
          name: user.name,
        });
        setDriveConnected(true);
        setDriveUserEmail(config.email || 'Conta Corporativa');
        alert(`Conta corporativa do Google Drive (${config.email}) conectada com sucesso para a empresa ${company.name}!`);
      } else {
        const { user: gUser } = await signInWithGoogleDrive();
        setDriveConnected(true);
        setDriveUserEmail(gUser.email || getDriveEmail());
      }
    } catch (err: any) {
      console.error('Google Drive auth error:', err);
      alert(`Não foi possível conectar ao Google Drive: ${err.message || err}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleDisconnect = async () => {
    if (!canConfigureDrive) {
      alert('Acesso restrito: Apenas administradores podem desvincular o Google Drive da empresa.');
      return;
    }

    if (confirm('Deseja desconectar a conta do Google Drive da empresa?')) {
      if (company) {
        await disconnectCompanyGoogleDrive(company.id);
      } else {
        await disconnectGoogleDrive();
      }
      setDriveConnected(false);
      setDriveUserEmail(null);
    }
  };

  const handleSyncPhotosToDrive = async () => {
    if (!driveConnected) {
      await handleConnectDrive();
    }
    if (!getCachedGoogleToken()) return;

    setSyncingDrive(true);
    try {
      // 1. Company Folder -> 2. Inspection Folder
      const companyFolderId = await findOrCreateFolder(companyName);
      const inspectionFolderId = await findOrCreateFolder(inspectionId, companyFolderId);

      const updatedPhotos = [...localPhotos];
      let uploadedCount = 0;

      for (let i = 0; i < updatedPhotos.length; i++) {
        const photo = updatedPhotos[i];
        if (!photo.driveFileId) {
          const fileName = `${inspectionId}_${environmentName}_${itemName}_${i + 1}.jpg`
            .replace(/[/\\?%*:|"<>]/g, '_');

          const driveRes = await uploadFileToDrive({
            name: fileName,
            mimeType: 'image/jpeg',
            dataUrl: photo.url,
            parentFolderId: inspectionFolderId,
          });

          updatedPhotos[i] = {
            ...photo,
            driveFileId: driveRes.id,
            driveUrl: driveRes.webViewLink,
          };
          uploadedCount++;
        }
      }

      setLocalPhotos(updatedPhotos);
      onUpdatePhotos(updatedPhotos);
      alert(`${uploadedCount} foto(s) salvas com sucesso no Google Drive na pasta "${companyName} / ${inspectionId}"!`);
    } catch (err: any) {
      console.error('Falha ao enviar fotos para o Google Drive:', err);
      alert(`Erro no envio para o Google Drive: ${err.message || err}`);
    } finally {
      setSyncingDrive(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setProcessing(true);

    try {
      const newPhotos: InspectionPhoto[] = [...localPhotos];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Process to strict vertical 3:4 orientation
        const processed = await processInspectionPhoto(file);

        let driveFileId: string | undefined;
        let driveUrl: string | undefined;

        // Auto upload to Google Drive if already connected
        if (driveConnected && getCachedGoogleToken()) {
          try {
            const companyFolderId = await findOrCreateFolder(companyName);
            const inspectionFolderId = await findOrCreateFolder(inspectionId, companyFolderId);
            const fileName = `${inspectionId}_${environmentName}_${itemName}_${newPhotos.length + 1}.jpg`
              .replace(/[/\\?%*:|"<>]/g, '_');

            const driveRes = await uploadFileToDrive({
              name: fileName,
              mimeType: 'image/jpeg',
              dataUrl: processed.dataUrl,
              parentFolderId: inspectionFolderId,
            });
            driveFileId = driveRes.id;
            driveUrl = driveRes.webViewLink;
          } catch (driveErr) {
            console.warn('Upload automático para o Drive ignorado, mantido local:', driveErr);
          }
        }

        const photoId = `ph_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const newPhotoObj: InspectionPhoto = {
          id: photoId,
          url: processed.dataUrl,
          caption: `Registro #${newPhotos.length + 1}`,
          takenAt: new Date().toISOString(),
          isVertical: true,
          cloudUrl: `${origin}/api/photos/${photoId}`,
          cloudViewerUrl: `${origin}/api/photos/${photoId}/view`,
          driveFileId,
          driveUrl,
        };

        // Immediate background upload to Cloud Firestore & server
        fetch('/api/photos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: photoId,
            url: processed.dataUrl,
            caption: newPhotoObj.caption,
            takenAt: newPhotoObj.takenAt,
            isVertical: true,
            inspectionId,
            environmentName,
            itemName,
            companyId: company?.id,
            companyName: company?.name,
          }),
        }).catch((err) => console.warn('Background photo upload deferred:', err));

        newPhotos.push(newPhotoObj);
      }

      setLocalPhotos(newPhotos);
      onUpdatePhotos(newPhotos);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
      alert('Erro ao processar imagem. Certifique-se de que o arquivo é uma imagem válida.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    const updated = localPhotos.filter((p) => p.id !== photoId);
    setLocalPhotos(updated);
    onUpdatePhotos(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn w-full max-w-full overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                {localPhotos.length}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Fotografias do Item
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">{environmentName}</span> &rsaquo; {itemName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Drive Status Bar */}
        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">
              Google Drive da Empresa:
            </span>
            {driveConnected ? (
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Conectado ({driveUserEmail || 'Conta Corporativa'})
                </span>
                {canConfigureDrive && (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-slate-400 hover:text-red-600 underline text-[10px] ml-1 transition-colors"
                    title="Desconectar Google Drive da Empresa"
                  >
                    Desconectar
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 italic">
                  Não vinculado à empresa
                </span>
                {!canConfigureDrive && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Configuração restrita à administração
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {driveConnected ? (
              <button
                type="button"
                disabled={syncingDrive}
                onClick={handleSyncPhotosToDrive}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] shadow-xs transition-colors disabled:opacity-50"
              >
                {syncingDrive ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Enviando fotos...</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Salvar Fotos no Drive</span>
                  </>
                )}
              </button>
            ) : canConfigureDrive ? (
              <button
                type="button"
                disabled={syncingDrive}
                onClick={handleConnectDrive}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg font-semibold text-[11px] shadow-xs transition-colors disabled:opacity-50"
              >
                {syncingDrive ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Conectando...</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Vincular Drive da Empresa</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* Modal Body / Gallery */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {localPhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-slate-200/70 flex items-center justify-center text-slate-400 mb-3">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Nenhuma fotografia anexada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {localPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-100 shadow-sm flex flex-col"
                  style={{ aspectRatio: '3/4' }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || `Foto #${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    #{index + 1}
                  </div>

                  {photo.driveFileId && (
                    <div
                      className="absolute top-1.5 left-10 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-xs"
                      title="Salvo no Google Drive da Empresa"
                    >
                      <HardDrive className="w-2.5 h-2.5" />
                      <span>Drive</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(photo.id)}
                    className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-md shadow-sm transition-transform active:scale-95"
                    title="Excluir foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent p-1.5 text-white flex items-center justify-between">
                    <span className="text-[10px] truncate font-medium">
                      {photo.caption || `Registro ${index + 1}`}
                    </span>
                    <div className="flex items-center gap-1.5 ml-1 shrink-0">
                      <a
                        href={photo.cloudViewerUrl || `/api/photos/${photo.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white hover:text-cyan-300 p-0.5 rounded bg-black/40 hover:bg-black/60 transition-colors"
                        title="Abrir em Alta Resolução na Nuvem (Visualizador Interativo)"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {photo.driveUrl && (
                        <a
                          href={photo.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white hover:text-emerald-300 p-0.5 rounded bg-black/40 hover:bg-black/60 transition-colors"
                          title="Abrir no Google Drive"
                        >
                          <HardDrive className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {processing && (
            <div className="flex items-center justify-center gap-2 p-3 mt-4 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando e ajustando orientação vertical 3:4...</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Hidden native inputs */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            {/* Camera Button (optimised for mobile inspection on site) */}
            <button
              type="button"
              disabled={processing}
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl shadow-sm transition-colors active:scale-95 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>Fotografar</span>
            </button>

            {/* Gallery Upload Button */}
            <button
              type="button"
              disabled={processing}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              <span>Galeria</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
