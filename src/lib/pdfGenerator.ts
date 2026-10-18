import { jsPDF } from 'jspdf';
import { Inspection, InspectionItem } from '../types';

/**
 * CAST Inspect Professional PDF Report Generator
 * 
 * STRICT MANDATORY SPECIFICATIONS:
 * 1. Page Format: A4 (210mm x 297mm).
 * 2. Left margin: 10mm, Right margin: 10mm => Usable width = 190mm.
 * 3. Exact 5 vertical photos per row maximum!
 * 4. Fixed photo dimensions: width = 35.6mm, height = 47.47mm (~3:4 aspect ratio).
 * 5. Gap between photos: 3.0mm.
 *    Proof: 5 * 35.6mm + 4 * 3.0mm = 178mm + 12mm = 190.0mm (perfect fit!).
 * 6. Non-dynamic sizing: 1 photo stays 35.6mm x 47.47mm, 2 photos stay same, up to 5 photos.
 *    The 6th photo starts a new line below!
 * 7. Page break handling: Clean pagination so photos or blocks never clip at the page bottom.
 */

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 15;
const USABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 190mm

// Exact photo dimensions (5 per row)
export const PDF_PHOTO_WIDTH = 35.6; // mm
export const PDF_PHOTO_HEIGHT = 47.47; // mm (3:4 ratio)
export const PDF_PHOTO_GAP = 3.0; // mm
export const PDF_PHOTOS_PER_ROW = 5;

export async function generateInspectionPdf(
  inspection: Inspection,
  options: { returnBlob?: boolean; download?: boolean; fileName?: string } = { download: true }
): Promise<Blob | null> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let currentY = MARGIN_TOP;

  // Helper to add new page and render header/footer
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      currentY = MARGIN_TOP;
      drawPageHeader(true);
    }
  };

  // Draw Page Header
  const drawPageHeader = (isContinuation = false) => {
    // Top banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 14, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('CAST INSPECT', MARGIN_LEFT + 4, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    const subTitle = isContinuation
      ? `Relatório Técnico de Vistoria Periódica (Cont.) — ID: ${inspection.id}`
      : 'Relatório Técnico de Vistoria Periódica em Condomínios';
    doc.text(subTitle, MARGIN_LEFT + 36, currentY + 9);

    // Date tag on top right
    doc.setFontSize(8);
    doc.text(`Data: ${formatDate(inspection.date)}`, MARGIN_LEFT + USABLE_WIDTH - 4, currentY + 9, {
      align: 'right',
    });

    currentY += 18;
  };

  // Format date helper
  function formatDate(iso: string) {
    if (!iso) return '-';
    const parts = iso.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  }

  // Draw First Page Header
  drawPageHeader(false);

  // Metadata Box (Condomínio, Bloco, Técnico, etc.)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 34, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Column 1
  doc.text('EMPRESA VISTORIADORA:', MARGIN_LEFT + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(inspection.companyName || 'CAST Inspeções Técnicas', MARGIN_LEFT + 4, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('CONDOMÍNIO:', MARGIN_LEFT + 4, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(inspection.condominiumName, MARGIN_LEFT + 4, currentY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('BLOCO / TORRE:', MARGIN_LEFT + 4, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(inspection.blockName, MARGIN_LEFT + 34, currentY + 28);

  // Column 2 (Middle)
  const col2X = MARGIN_LEFT + 95;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('VISTORIADOR / TÉCNICO:', col2X, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const inspectorInfo = inspection.inspectorName + (inspection.inspectorDoc ? ` (${inspection.inspectorDoc})` : '');
  doc.text(inspectorInfo, col2X, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('MODELO DE VISTORIA:', col2X, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(inspection.templateName || 'Vistoria Geral', col2X, currentY + 22);

  // Geolocation confirmation
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('LOCALIZAÇÃO GPS:', col2X, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const geoText = inspection.geolocation
    ? `Lat: ${inspection.geolocation.latitude.toFixed(5)}, Long: ${inspection.geolocation.longitude.toFixed(5)} (Presença Confirmada)`
    : 'Localização não registrada';
  doc.text(geoText, col2X + 34, currentY + 28);

  // Inspection ID Badge (Top right of box)
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(MARGIN_LEFT + USABLE_WIDTH - 42, currentY + 3, 38, 8, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175);
  doc.text(inspection.id, MARGIN_LEFT + USABLE_WIDTH - 23, currentY + 8.5, { align: 'center' });

  if (inspection.structureVersion) {
    doc.setFillColor(238, 242, 255);
    doc.setDrawColor(199, 210, 254);
    doc.rect(MARGIN_LEFT + USABLE_WIDTH - 42, currentY + 13, 38, 7, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(67, 56, 202);
    doc.text(`VERSÃO ${inspection.structureVersion}`, MARGIN_LEFT + USABLE_WIDTH - 23, currentY + 17.5, { align: 'center' });
  }

  currentY += 38;

  // Executive Summary Bar
  let okCount = 0;
  let maintenanceCount = 0;
  inspection.environments.forEach((env) => {
    env.items.forEach((item) => {
      if (item.status === 'OK, MANUTENÇÃO EM DIA') okCount++;
      if (item.status === 'AGENDAR MANUTENÇÃO') maintenanceCount++;
    });
  });

  checkPageBreak(14);
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`TOTAL DE ITENS VISTORIADOS: ${okCount + maintenanceCount}`, MARGIN_LEFT + 4, currentY + 6);

  // OK pill
  doc.setFillColor(220, 252, 231);
  doc.rect(MARGIN_LEFT + 80, currentY + 1.5, 46, 6, 'F');
  doc.setTextColor(22, 101, 52);
  doc.text(`OK, EM DIA: ${okCount}`, MARGIN_LEFT + 83, currentY + 5.7);

  // Agendar pill
  doc.setFillColor(254, 226, 226);
  doc.rect(MARGIN_LEFT + 130, currentY + 1.5, 56, 6, 'F');
  doc.setTextColor(185, 28, 28);
  doc.text(`AGENDAR MANUTENÇÃO: ${maintenanceCount}`, MARGIN_LEFT + 133, currentY + 5.7);

  currentY += 13;

  // Render Environments and Items
  for (let envIndex = 0; envIndex < inspection.environments.length; envIndex++) {
    const env = inspection.environments[envIndex];

    // Environment Title Header
    checkPageBreak(18);
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 7.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `AMBIENTE ${envIndex + 1}: ${env.name.toUpperCase()}`,
      MARGIN_LEFT + 4,
      currentY + 5.2
    );
    currentY += 10;

    // Render Items of this environment
    for (let itemIndex = 0; itemIndex < env.items.length; itemIndex++) {
      const item = env.items[itemIndex];
      const photosCount = item.photos ? item.photos.length : 0;
      const photoRowsCount = Math.ceil(photosCount / PDF_PHOTOS_PER_ROW);
      
      // Calculate needed height for this item: item info (15mm) + observations if any + photo rows
      const photosHeight = photoRowsCount > 0 ? photoRowsCount * (PDF_PHOTO_HEIGHT + 4) : 0;
      const obsHeight = item.observations ? 10 : 0;
      const estimatedItemHeight = 16 + obsHeight + photosHeight;

      checkPageBreak(Math.min(estimatedItemHeight, 45));

      // Item box container top
      const itemTopY = currentY;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      
      // Draw item line banner
      doc.setFillColor(248, 250, 252);
      doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 8, 'F');
      doc.line(MARGIN_LEFT, currentY, MARGIN_LEFT + USABLE_WIDTH, currentY);

      // Item Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${itemIndex + 1}. ${item.name}`,
        MARGIN_LEFT + 3,
        currentY + 5.5
      );

      // Status Badge
      const status = item.status || 'OK, MANUTENÇÃO EM DIA';
      const isOk = status === 'OK, MANUTENÇÃO EM DIA';

      const badgeWidth = isOk ? 48 : 46;
      const badgeX = MARGIN_LEFT + USABLE_WIDTH - badgeWidth - 3;
      const badgeY = currentY + 1.2;

      if (isOk) {
        doc.setFillColor(220, 252, 231); // green-100
        doc.setDrawColor(187, 247, 208);
        doc.rect(badgeX, badgeY, badgeWidth, 5.5, 'FD');
        doc.setTextColor(22, 101, 52); // green-800
      } else {
        doc.setFillColor(254, 226, 226); // red-100
        doc.setDrawColor(254, 202, 202);
        doc.rect(badgeX, badgeY, badgeWidth, 5.5, 'FD');
        doc.setTextColor(185, 28, 28); // red-700
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(status, badgeX + badgeWidth / 2, badgeY + 4, { align: 'center' });

      currentY += 10;

      // Description text (informação para explicar o que é o item)
      if (item.description && item.description.trim().length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Descrição:', MARGIN_LEFT + 3, currentY + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const splitDesc = doc.splitTextToSize(item.description, USABLE_WIDTH - 28);
        doc.text(splitDesc, MARGIN_LEFT + 25, currentY + 3.5);
        currentY += Math.max(6, splitDesc.length * 4 + 2);
      }

      // Observations text
      if (item.observations && item.observations.trim().length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('Observações:', MARGIN_LEFT + 3, currentY + 3.5);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const splitObs = doc.splitTextToSize(item.observations, USABLE_WIDTH - 28);
        doc.text(splitObs, MARGIN_LEFT + 25, currentY + 3.5);
        currentY += Math.max(7, splitObs.length * 4 + 2);
      }

      // Render item photos in chunks of 5
      if (photosCount > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Registros Fotográficos (${photosCount}):`, MARGIN_LEFT + 3, currentY + 3);
        currentY += 5;

        // Iterate through photos in chunks of 5
        for (let rowIdx = 0; rowIdx < photoRowsCount; rowIdx++) {
          // Check if photo row fits on page, else create new page
          checkPageBreak(PDF_PHOTO_HEIGHT + 6);

          const startPhotoIdx = rowIdx * PDF_PHOTOS_PER_ROW;
          const endPhotoIdx = Math.min(startPhotoIdx + PDF_PHOTOS_PER_ROW, photosCount);

          for (let colIdx = 0; colIdx < PDF_PHOTOS_PER_ROW; colIdx++) {
            const photoIdx = startPhotoIdx + colIdx;
            const photoX = MARGIN_LEFT + colIdx * (PDF_PHOTO_WIDTH + PDF_PHOTO_GAP);
            const photoY = currentY;

            if (photoIdx < endPhotoIdx) {
              const photo = item.photos[photoIdx];
              try {
                // Add fixed size vertical image: exactly PDF_PHOTO_WIDTH x PDF_PHOTO_HEIGHT
                doc.addImage(
                  photo.url,
                  'JPEG',
                  photoX,
                  photoY,
                  PDF_PHOTO_WIDTH,
                  PDF_PHOTO_HEIGHT,
                  undefined,
                  'FAST'
                );

                // Draw photo border
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.2);
                doc.rect(photoX, photoY, PDF_PHOTO_WIDTH, PDF_PHOTO_HEIGHT);

                // Small index tag on corner of photo
                doc.setFillColor(15, 23, 42);
                doc.rect(photoX, photoY + PDF_PHOTO_HEIGHT - 3.8, 8.5, 3.8, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6);
                doc.setTextColor(255, 255, 255);
                doc.text(
                  `#${photoIdx + 1}`,
                  photoX + 4.25,
                  photoY + PDF_PHOTO_HEIGHT - 1.2,
                  { align: 'center' }
                );
              } catch (imgErr) {
                console.error('Error rendering image to PDF:', imgErr);
                // Fallback box if image failed to load
                doc.setFillColor(241, 245, 249);
                doc.setDrawColor(203, 213, 225);
                doc.rect(photoX, photoY, PDF_PHOTO_WIDTH, PDF_PHOTO_HEIGHT, 'FD');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(148, 163, 184);
                doc.text('[Foto]', photoX + PDF_PHOTO_WIDTH / 2, photoY + PDF_PHOTO_HEIGHT / 2, {
                  align: 'center',
                });
              }
            } else {
              // Slots 2, 3, 4 or 5 remain strictly empty! No photo drawn here!
              // Size does NOT stretch or expand!
            }
          }

          currentY += PDF_PHOTO_HEIGHT + 4;
        }
      }

      // Separator line between items
      currentY += 2;
      doc.setDrawColor(226, 232, 240);
      doc.line(MARGIN_LEFT, currentY, MARGIN_LEFT + USABLE_WIDTH, currentY);
      currentY += 4;
    }

    currentY += 3;
  }

  // Signatures and Legal Statement Section
  checkPageBreak(50);

  // General Notes if present
  if (inspection.generalNotes && inspection.generalNotes.trim().length > 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 14, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text('CONSIDERAÇÕES FINAIS DO VISTORIADOR:', MARGIN_LEFT + 3, currentY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const notesSplit = doc.splitTextToSize(inspection.generalNotes, USABLE_WIDTH - 6);
    doc.text(notesSplit, MARGIN_LEFT + 3, currentY + 9.5);
    currentY += 18;
  }

  // Signatures Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.rect(MARGIN_LEFT, currentY, USABLE_WIDTH, 34, 'FD');

  const halfWidth = (USABLE_WIDTH - 8) / 2;

  // Box 1: Technician Signature
  const sig1X = MARGIN_LEFT + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('RESPONSÁVEL TÉCNICO / VISTORIADOR', sig1X + halfWidth / 2, currentY + 5, {
    align: 'center',
  });

  if (inspection.technicianSignature) {
    try {
      doc.addImage(
        inspection.technicianSignature,
        'PNG',
        sig1X + halfWidth / 2 - 25,
        currentY + 7,
        50,
        15
      );
    } catch (e) {
      // ignore
    }
  } else {
    // Empty line for manual signing
    doc.setDrawColor(148, 163, 184);
    doc.line(sig1X + 10, currentY + 22, sig1X + halfWidth - 10, currentY + 22);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${inspection.technicianName || inspection.inspectorName} ${inspection.inspectorDoc ? `— ${inspection.inspectorDoc}` : ''}`,
    sig1X + halfWidth / 2,
    currentY + 27,
    { align: 'center' }
  );
  doc.setFontSize(6.5);
  doc.text(
    `Vistoria concluída em: ${inspection.completedAt ? new Date(inspection.completedAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}`,
    sig1X + halfWidth / 2,
    currentY + 31,
    { align: 'center' }
  );

  // Box 2: Syndic / Building Manager Signature
  const sig2X = MARGIN_LEFT + halfWidth + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('CIÊNCIA DA ADMINISTRAÇÃO PREDIAL / SÍNDICO', sig2X + halfWidth / 2, currentY + 5, {
    align: 'center',
  });

  if (inspection.syndicSignature) {
    try {
      doc.addImage(
        inspection.syndicSignature,
        'PNG',
        sig2X + halfWidth / 2 - 25,
        currentY + 7,
        50,
        15
      );
    } catch (e) {
      // ignore
    }
  } else {
    // Empty line for manual signing
    doc.setDrawColor(148, 163, 184);
    doc.line(sig2X + 10, currentY + 22, sig2X + halfWidth - 10, currentY + 22);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    inspection.syndicName || 'Administração / Síndico do Condomínio',
    sig2X + halfWidth / 2,
    currentY + 27,
    { align: 'center' }
  );
  doc.setFontSize(6.5);
  doc.text(
    'Assinatura digital capturada via tela sensível ao toque',
    sig2X + halfWidth / 2,
    currentY + 31,
    { align: 'center' }
  );

  currentY += 38;

  // Add Page Numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN_LEFT, PAGE_HEIGHT - 9, MARGIN_LEFT + USABLE_WIDTH, PAGE_HEIGHT - 9);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `CAST Inspect — Sistema de Vistorias Técnicas Periódicas`,
      MARGIN_LEFT,
      PAGE_HEIGHT - 5
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      MARGIN_LEFT + USABLE_WIDTH,
      PAGE_HEIGHT - 5,
      { align: 'right' }
    );
  }

  const defaultFileName = `Vistoria_${inspection.id}_${inspection.condominiumName.replace(/\s+/g, '_')}.pdf`;
  const fileName = options.fileName || defaultFileName;

  if (options.download) {
    doc.save(fileName);
  }

  if (options.returnBlob) {
    return doc.output('blob');
  }

  return null;
}
