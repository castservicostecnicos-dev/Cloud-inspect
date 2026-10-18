import React, { useState } from 'react';
import { X, MessageSquare, Mail, Copy, Share, Check } from 'lucide-react';
import { Inspection } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection: Inspection;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  inspection,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const inspectionLink = `${appUrl}/#inspection-${inspection.id}`;

  const messageText = `*CAST INSPECT — Relatório Técnico de Vistoria Periódica*
*ID:* ${inspection.id}
*Condomínio:* ${inspection.condominiumName}
*Bloco/Torre:* ${inspection.blockName}
*Data:* ${inspection.date}
*Status:* ${inspection.status === 'CONCLUIDA' ? 'Concluída' : 'Em Andamento'}
*Itens com Manutenção Pendente:* ${inspection.criticalItemsCount || 0}
*Responsável Técnico:* ${inspection.inspectorName} (${inspection.inspectorDoc || 'Reg. Técnico'})

O relatório técnico completo em PDF está disponível para consulta e download.`;

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText + `\n\nAcesse: ${inspectionLink}`)}`;
    window.open(url, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Relatório de Vistoria Técnica — ${inspection.condominiumName} (${inspection.id})`);
    const body = encodeURIComponent(messageText + `\n\nLink de acesso:\n${inspectionLink}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText + `\n\nLink: ${inspectionLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Relatório de Vistoria ${inspection.id}`,
          text: messageText,
          url: inspectionLink,
        });
      } catch (err) {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn w-full max-w-full overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 my-auto">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Share className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-800">Compartilhar Relatório</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-600">
            Envie a notificação e resumo do relatório técnico diretamente para o síndico, conselho ou zeladoria.
          </p>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-3 w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold">WhatsApp</div>
                <div className="text-[11px] text-emerald-700 font-normal">Enviar resumo e link via WhatsApp</div>
              </div>
            </button>

            <button
              onClick={handleEmail}
              className="flex items-center gap-3 w-full p-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold">E-mail para Síndico / Condomínio</div>
                <div className="text-[11px] text-blue-700 font-normal">Enviar dados completos por correio eletrônico</div>
              </div>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center gap-3 w-full p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0">
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </div>
              <div className="text-left flex-1">
                <div className="font-bold">{copied ? 'Copiado para Área de Transferência!' : 'Copiar Texto e Link'}</div>
                <div className="text-[11px] text-slate-500 font-normal">Copiar mensagem formatada para colar onde quiser</div>
              </div>
            </button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors mt-2"
              >
                <Share className="w-3.5 h-3.5" />
                <span>Outros Aplicativos do Dispositivo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
