import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck2,
  Plus,
  Trash2,
  Edit2,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  X,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  Check,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InspectionTemplate, TemplateEnvironment, TemplateItem } from '../types';
import {
  parseTemplateCsv,
  parseTemplateSpreadsheet,
  generateSampleTemplateCsv,
  generateSampleTemplateXlsx,
  exportTemplateAsXlsx,
  CsvParseResult,
} from '../lib/csvTemplateParser';
import { formatAndCorrectItemConcept } from '../lib/itemTextFormatter';

interface TemplatesProps {
  onNavigate: (view: string, param?: string) => void;
}

export const Templates: React.FC<TemplatesProps> = ({ onNavigate }) => {
  const { company, user } = useAuth();
  const canManageTemplates = true;
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTmpl, setExpandedTmpl] = useState<string | null>(null);

  // Modal State for New / Edit Template
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [environments, setEnvironments] = useState<TemplateEnvironment[]>([]);

  // Spreadsheet / CSV Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  const [csvFeedback, setCsvFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    filename?: string;
  } | null>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedCsvText, setPastedCsvText] = useState('');

  // Manual addition inputs inside modal
  const [newEnvName, setNewEnvName] = useState('');
  const [newItemsByEnv, setNewItemsByEnv] = useState<{ [envId: string]: string }>({});

  // Deletion in-app confirmation state (avoids iframe window.confirm blocks)
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string; title: string } | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        headers: { 'x-company-id': company.id },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        if (data.length > 0 && !expandedTmpl) {
          setExpandedTmpl(data[0].id);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar modelos:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [company]);

  const toggleExpand = (id: string) => {
    setExpandedTmpl(expandedTmpl === id ? null : id);
  };

  // Helper to trigger sample Excel download
  const handleDownloadSampleXlsx = () => {
    const bytes = generateSampleTemplateXlsx();
    const blob = new Blob([bytes as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_vistoria_exemplo_cast.xlsx');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to trigger sample CSV download
  const handleDownloadSampleCsv = () => {
    const csvContent = generateSampleTemplateCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'modelo_vistoria_exemplo_cast.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to export an existing template as Excel (.xlsx)
  const handleExportTemplateAsXlsx = (tmpl: InspectionTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const bytes = exportTemplateAsXlsx(tmpl);
    const blob = new Blob([bytes as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanTitle = tmpl.title
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_');
    link.setAttribute('download', `modelo_${cleanTitle || 'vistoria'}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper to export an existing template as CSV
  const handleExportTemplateAsCsv = (tmpl: InspectionTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const rows = [['Ambiente', 'Item']];
    tmpl.environments.forEach((env) => {
      if (env.items && env.items.length > 0) {
        env.items.forEach((it) => {
          rows.push([env.name, it.name]);
        });
      } else {
        rows.push([env.name, '']);
      }
    });

    const csvContent = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const cleanTitle = tmpl.title
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_');
    const filename = `modelo_${cleanTitle || 'vistoria'}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Apply parsed spreadsheet/CSV result
  const applyParseResult = (parsed: CsvParseResult, filename?: string) => {
    if (!parsed.success) {
      setCsvFeedback({
        type: 'error',
        message: parsed.error || 'Erro ao processar a planilha.',
      });
      return;
    }

    // Convert all loaded spreadsheet environments and items to uppercase
    const upperEnvironments = (parsed.environments || []).map((env, eIdx) => ({
      ...env,
      name: String(env.name || '').trim().toUpperCase(),
      order: eIdx + 1,
      items: (env.items || []).map((it, iIdx) => ({
        ...it,
        name: String(it.name || '').trim().toUpperCase(),
        description: String(it.description || '').trim().toUpperCase(),
        order: iIdx + 1,
      })),
    }));

    setEnvironments(upperEnvironments);
    const descText = parsed.totalWithDescription
      ? ` e ${parsed.totalWithDescription} descrições na Coluna 3`
      : '';
    setCsvFeedback({
      type: 'success',
      message: `${parsed.totalEnvironments} ambientes (Coluna 1) e ${parsed.totalItems} itens em maiúsculas (Coluna 2)${descText}!`,
      filename,
    });

    // Auto set title and description from filename
    if (filename) {
      const cleanName = filename
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim()
        .toUpperCase();
      setTitle(cleanName);
      if (!description.trim()) {
        setDescription(`CHECKLIST COM ${parsed.totalEnvironments} AMBIENTES E ${parsed.totalItems} ITENS IMPORTADOS DA PLANILHA "${filename.toUpperCase()}".`);
      }
    }
  };

  // Process File Object (Spreadsheet or CSV)
  const processUploadedFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (buffer) {
          const parsed = parseTemplateSpreadsheet(buffer);
          applyParseResult(parsed, file.name);
          setIsModalOpen(true);
        }
      };
      reader.onerror = () => {
        alert('Não foi possível ler a planilha Excel selecionada.');
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseTemplateCsv(text);
        applyParseResult(parsed, file.name);
        setIsModalOpen(true);
      };
      reader.onerror = () => {
        alert('Não foi possível ler o arquivo selecionado.');
      };
      reader.readAsText(file);
    }
  };

  // Handle direct upload from header/dropzone
  const handleDirectSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
    if (directFileInputRef.current) directFileInputRef.current.value = '';
  };

  // Handle modal file selection
  const handleModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Drag & Drop of Spreadsheet
  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canManageTemplates) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Add an environment manually inside modal
  const handleAddManualEnvironment = () => {
    if (!newEnvName.trim()) return;
    const createdEnv: TemplateEnvironment = {
      id: `tenv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: newEnvName.trim().toUpperCase(),
      order: environments.length + 1,
      items: [],
    };
    setEnvironments((prev) => [...prev, createdEnv]);
    setNewEnvName('');
  };

  // Remove an environment inside modal
  const handleRemoveEnvironment = (index: number) => {
    setEnvironments((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Add an item manually to an environment inside modal
  const handleAddManualItem = (envIndex: number) => {
    const env = environments[envIndex];
    if (!env) return;
    const itemText = (newItemsByEnv[env.id] || '').trim();
    if (!itemText) return;

    const newItem: TemplateItem = {
      id: `tit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: formatAndCorrectItemConcept(itemText).toUpperCase(),
      description: '',
      order: env.items.length + 1,
    };

    setEnvironments((prev) => {
      const copy = [...prev];
      copy[envIndex] = {
        ...copy[envIndex],
        items: [...copy[envIndex].items, newItem],
      };
      return copy;
    });

    setNewItemsByEnv((prev) => ({ ...prev, [env.id]: '' }));
  };

  // Remove an item inside modal
  const handleRemoveItem = (envIndex: number, itemIndex: number) => {
    setEnvironments((prev) => {
      const copy = [...prev];
      copy[envIndex] = {
        ...copy[envIndex],
        items: copy[envIndex].items.filter((_, idx) => idx !== itemIndex),
      };
      return copy;
    });
  };

  // Clear modal and open for creation
  const handleOpenNewModal = () => {
    setTitle('');
    setDescription('');
    setEnvironments([]);
    setCsvFeedback(null);
    setIsPasteOpen(false);
    setPastedCsvText('');
    setNewEnvName('');
    setNewItemsByEnv({});
    setIsModalOpen(true);
  };

  // Prompt in-app deletion confirmation (no browser window.confirm blocking)
  const promptDeleteTemplate = (tmplId: string, tmplTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteError(null);
    setTemplateToDelete({ id: tmplId, title: tmplTitle });
  };

  // Execute deletion on server and update state
  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;
    setDeletingTemplate(true);
    setDeleteError(null);
    const tmplId = templateToDelete.id;

    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tmplId)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(company?.id ? { 'x-company-id': company.id } : {}),
        },
      });

      if (res.ok || res.status === 404) {
        setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
        if (expandedTmpl === tmplId) {
          setExpandedTmpl(null);
        }
        setTemplateToDelete(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || 'Erro ao excluir modelo.');
      }
    } catch (err: any) {
      console.error('[Templates] Erro ao excluir modelo:', err);
      // Remove locally so user is never stuck
      setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
      if (expandedTmpl === tmplId) {
        setExpandedTmpl(null);
      }
      setTemplateToDelete(null);
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Submit and create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !title.trim()) return;

    if (environments.length === 0) {
      alert('Adicione pelo menos um ambiente ao modelo de vistoria através da planilha (Excel/CSV) ou manualmente.');
      return;
    }

    setSaving(true);

    const newTemplate: InspectionTemplate = {
      id: `tmpl_${Date.now()}`,
      companyId: company.id,
      title: title.trim().toUpperCase(),
      description: description.trim().toUpperCase() || 'MODELO DE INSPEÇÃO PREDIAL',
      active: true,
      createdAt: new Date().toISOString(),
      environments: environments.map((env, eIdx) => ({
        ...env,
        name: env.name.trim().toUpperCase(),
        order: eIdx + 1,
        items: env.items.map((it, iIdx) => ({
          ...it,
          name: it.name.trim().toUpperCase(),
          description: (it.description || '').trim().toUpperCase(),
          order: iIdx + 1,
        })),
      })),
    };

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-company-id': company.id,
        },
        body: JSON.stringify(newTemplate),
      });

      if (res.ok) {
        const created: InspectionTemplate = await res.json();
        setIsModalOpen(false);
        fetchTemplates();
        setExpandedTmpl(created.id);
      } else {
        alert('Erro ao criar modelo.');
      }
    } catch (err) {
      console.error(err);
      alert('Falha ao comunicar com o servidor para criar modelo.');
    } finally {
      setSaving(false);
    }
  };

  const totalLoadedItems = environments.reduce((acc, env) => acc + env.items.length, 0);

  return (
    <div className="space-y-6 pb-16 w-full max-w-full">
      {/* Hidden input for direct header upload */}
      <input
        ref={directFileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleDirectSpreadsheetUpload}
        className="hidden"
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <FileCheck2 className="w-6 h-6 text-blue-600" />
            <span>Modelos de Vistoria</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick Download of Sample Spreadsheet */}
          <button
            type="button"
            onClick={handleDownloadSampleXlsx}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs"
            title="Baixar planilha Excel (.xlsx) de exemplo"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Planilha Exemplo (.xlsx)</span>
          </button>

          {canManageTemplates && (
            <>
              {/* PRIMARY ACTION: DIRECT SPREADSHEET UPLOAD */}
              <button
                type="button"
                onClick={() => directFileInputRef.current?.click()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all shrink-0"
                title="Carregar planilha Excel ou CSV para criar o modelo automaticamente"
              >
                <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
                <span>Enviar Planilha</span>
              </button>

              <button
                type="button"
                onClick={handleOpenNewModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition-all shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Novo Modelo</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Prominent Drag & Drop / Upload Card */}
      {canManageTemplates && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFile}
          onClick={() => directFileInputRef.current?.click()}
          className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 transition-all rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                  Enviar Planilha e Criar Modelo de Vistoria
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Excel (.xlsx) ou CSV
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-white border border-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-colors px-3.5 py-2 rounded-xl shadow-2xs">
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Clique ou Arraste a Planilha Aqui</span>
            </span>
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Carregando modelos de vistoria...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-3">Nenhum modelo cadastrado</h3>
          {canManageTemplates && (
            <button
              onClick={() => directFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>Enviar Planilha Agora</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((tmpl) => {
            const isExpanded = expandedTmpl === tmpl.id;
            const totalItems = tmpl.environments.reduce(
              (acc, e) => acc + (e.items?.length || 0),
              0
            );

            return (
              <div
                key={tmpl.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleExpand(tmpl.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {tmpl.title}
                        </h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                          {tmpl.environments.length} Ambientes
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 break-words line-clamp-2">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-wrap">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                      {totalItems} {totalItems === 1 ? 'Item' : 'Itens'}
                    </span>

                    {/* Export Template to Excel (.xlsx) */}
                    <button
                      type="button"
                      onClick={(e) => handleExportTemplateAsXlsx(tmpl, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                      title="Exportar checklist para planilha Excel (.xlsx)"
                    >
                      <Download className="w-3 h-3 text-emerald-600" />
                      <span>Excel</span>
                    </button>

                    {/* Export Template to CSV */}
                    <button
                      type="button"
                      onClick={(e) => handleExportTemplateAsCsv(tmpl, e)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                      title="Exportar checklist para CSV"
                    >
                      <Download className="w-3 h-3 text-slate-500" />
                      <span>CSV</span>
                    </button>

                    {/* Delete Template */}
                    {canManageTemplates && (
                      <button
                        type="button"
                        onClick={(e) => promptDeleteTemplate(tmpl.id, tmpl.title, e)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir este modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                    )}
                  </div>
                </div>

                {/* Accordion Content: Hierarchy of Environments & Items */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Estrutura do Checklist Predial
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500 font-medium">
                          Total de {tmpl.environments.length} ambientes cadastrados
                        </span>
                        {canManageTemplates && (
                          <button
                            type="button"
                            onClick={(e) => promptDeleteTemplate(tmpl.id, tmpl.title, e)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-lg transition-colors"
                            title="Excluir este modelo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Excluir Modelo</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {tmpl.environments.map((env, eIdx) => (
                        <div
                          key={env.id}
                          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs flex flex-col"
                        >
                          <div className="bg-slate-900 text-white px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                            <span className="truncate">
                              {eIdx + 1}. {env.name}
                            </span>
                            <span className="text-[10px] text-slate-300 font-normal shrink-0 ml-2">
                              {env.items.length} {env.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>

                          <div className="p-3 divide-y divide-slate-100 text-xs flex-1">
                            {env.items.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-1">
                                Nenhum item cadastrado neste ambiente
                              </p>
                            ) : (
                              env.items.map((it, iIdx) => (
                                <div
                                  key={it.id}
                                  className="py-1.5 first:pt-0 last:pb-0 flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <span className="font-semibold text-slate-800 break-words">
                                      {iIdx + 1}. {it.name}
                                    </span>
                                    {it.description ? (
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        {it.description}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Template Modal: Pre-filled from Spreadsheet or Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {environments.length > 0 ? 'Criar Modelo a partir da Planilha' : 'Novo Modelo de Vistoria'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleCreateTemplate} className="mt-4 space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Quick Save Bar when loaded from spreadsheet */}
              {environments.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                        Planilha Pronta: {environments.length} Ambientes e {totalLoadedItems} Itens
                      </h4>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !title.trim()}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all shrink-0"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 stroke-[3]" />
                    )}
                    <span>Salvar Modelo Agora</span>
                  </button>
                </div>
              )}

              {/* Basic Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Título do Modelo *
                  </label>
                  <input
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.toUpperCase())}
                    placeholder="EX: VISTORIA PREDIAL PERIÓDICA COMPLETA"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Descrição do Checklist
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value.toUpperCase())}
                    placeholder="OBJETIVO DA INSPEÇÃO, ESCOPO DAS ÁREAS INSPECIONADAS..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* Spreadsheet Upload Section */}
              <div className="bg-emerald-50/60 border-2 border-dashed border-emerald-200 hover:border-emerald-400 transition-colors rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Carregar Planilha (Excel ou CSV)
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleDownloadSampleXlsx}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xs shrink-0"
                      title="Baixar planilha Excel (.xlsx) de exemplo"
                    >
                      <Download className="w-3 h-3" />
                      <span>Exemplo Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className="flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xs shrink-0"
                      title="Baixar modelo em CSV"
                    >
                      <Download className="w-3 h-3" />
                      <span>Exemplo CSV</span>
                    </button>
                  </div>
                </div>

                {/* Upload action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleModalFileChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
                  >
                    <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{environments.length > 0 ? 'Trocar Planilha' : 'Selecionar Planilha (Excel ou CSV)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPasteOpen(!isPasteOpen)}
                    className="flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-2xs transition-all"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>{isPasteOpen ? 'Fechar Colar Texto' : 'Ou Colar Texto Copiado'}</span>
                  </button>

                  {environments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setEnvironments([]);
                        setCsvFeedback(null);
                      }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1 ml-auto"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpar lista</span>
                    </button>
                  )}
                </div>

                {/* Direct Paste Area */}
                {isPasteOpen && (
                  <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-2 animate-fadeIn">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Copie e cole as colunas (Coluna 1: Ambiente | Coluna 2: Item) de sua planilha:
                    </label>
                    <textarea
                      rows={4}
                      value={pastedCsvText}
                      onChange={(e) => setPastedCsvText(e.target.value)}
                      placeholder={'Ambiente;Item\nHall de Entrada;Porta de Acesso\nHall de Entrada;Interfone\nGaragem;Portão\nGaragem;Extintor...'}
                      className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseTemplateCsv(pastedCsvText);
                          applyParseResult(parsed, 'Texto colado');
                          setIsPasteOpen(false);
                          setPastedCsvText('');
                        }}
                        disabled={!pastedCsvText.trim()}
                        className="bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs"
                      >
                        Processar e Carregar
                      </button>
                    </div>
                  </div>
                )}

                {/* Spreadsheet Feedback Message */}
                {csvFeedback && (
                  <div
                    className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2.5 animate-fadeIn ${
                      csvFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-red-50 text-red-900 border border-red-200'
                    }`}
                  >
                    {csvFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold">
                        {csvFeedback.filename ? `${csvFeedback.filename}: ` : ''}
                      </span>
                      <span>{csvFeedback.message}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Environments and Items Preview / Editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span>Ambientes e Itens do Modelo ({environments.length} Ambientes &bull; {totalLoadedItems} Itens)</span>
                  </label>
                </div>

                {/* Add Environment Manually Input */}
                <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <input
                    type="text"
                    value={newEnvName}
                    onChange={(e) => setNewEnvName(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualEnvironment();
                      }
                    }}
                    placeholder="ADICIONAR NOVO AMBIENTE MANUALMENTE (EX: BARRILETE, SUBSOLO, COBERTURA...)"
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualEnvironment}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ambiente</span>
                  </button>
                </div>

                {/* Environments List in Modal */}
                {environments.length === 0 ? (
                  <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <Layers className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">Nenhum ambiente adicionado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {environments.map((env, envIdx) => {
                      const itemInputValue = newItemsByEnv[env.id] || '';

                      return (
                        <div
                          key={env.id}
                          className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                        >
                          {/* Environment header in modal */}
                          <div className="bg-slate-900 text-white px-3 py-2 text-xs font-bold flex items-center justify-between">
                            <span className="uppercase tracking-wider">
                              {envIdx + 1}. {env.name} ({env.items.length} itens)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveEnvironment(envIdx)}
                              className="text-slate-400 hover:text-red-400 p-0.5 transition-colors"
                              title="Remover este ambiente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Items in environment */}
                          <div className="p-2.5 space-y-2 bg-slate-50/40">
                            {/* Items chips */}
                            {env.items.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic px-1">
                                Nenhum item neste ambiente. Adicione abaixo:
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {env.items.map((it, itemIdx) => (
                                  <span
                                    key={it.id}
                                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-800 shadow-2xs"
                                  >
                                    <span>
                                      {itemIdx + 1}. {it.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(envIdx, itemIdx)}
                                      className="text-slate-400 hover:text-red-600"
                                      title="Remover item"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Add Item to this environment */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
                              <input
                                type="text"
                                value={itemInputValue}
                                onChange={(e) =>
                                  setNewItemsByEnv((prev) => ({
                                    ...prev,
                                    [env.id]: e.target.value.toUpperCase(),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddManualItem(envIdx);
                                  }
                                }}
                                placeholder={`+ ADICIONAR ITEM EM "${env.name}"...`}
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddManualItem(envIdx)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-2xs shrink-0"
                              >
                                + Item
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || environments.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Criando Modelo de Vistoria...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Criar Modelo de Vistoria ({environments.length} Ambientes)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (Avoids browser window.confirm blocking) */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Excluir Modelo de Vistoria
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              Deseja realmente excluir o modelo <strong>"{templateToDelete.title}"</strong> da biblioteca de modelos?
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deletingTemplate}
                onClick={() => {
                  setTemplateToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTemplate}
                onClick={confirmDeleteTemplate}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-all disabled:opacity-50"
              >
                {deletingTemplate ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
