import fs from 'fs';
import path from 'path';
import { saveDocumentToFirestore, getDocumentFromFirestore } from './firestore.js';

const PHOTOS_DIR = path.join(process.cwd(), 'data', 'photos');

function ensurePhotosDir() {
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }
}

export interface StoredPhotoRecord {
  id: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
  takenAt?: string;
  isVertical?: boolean;
  inspectionId?: string;
  inspectionCode?: string;
  condominiumName?: string;
  tower?: string;
  environmentName?: string;
  itemName?: string;
  itemStatus?: string;
  companyId?: string;
  companyName?: string;
  inspectorName?: string;
  observations?: string;
  updatedAt?: string;
}

export async function storePhoto(record: StoredPhotoRecord): Promise<{ cloudUrl: string; viewerUrl: string }> {
  ensurePhotosDir();
  const photoId = String(record.id || '').trim();
  if (!photoId) throw new Error('ID da foto inválido.');

  const rawUrl = record.url || record.dataUrl || '';
  if (rawUrl.startsWith('data:image/')) {
    const matches = rawUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (matches && matches[2]) {
      const buffer = Buffer.from(matches[2], 'base64');
      const localFilePath = path.join(PHOTOS_DIR, `${photoId}.jpg`);
      fs.writeFileSync(localFilePath, buffer);
    }
  }

  // Persist to Cloud Firestore in collection 'photos'
  const firestoreRecord: StoredPhotoRecord = {
    ...record,
    id: photoId,
    updatedAt: new Date().toISOString(),
  };

  await saveDocumentToFirestore('photos', photoId, firestoreRecord);

  return {
    cloudUrl: `/api/photos/${photoId}`,
    viewerUrl: `/api/photos/${photoId}/view`,
  };
}

export async function getPhotoBuffer(photoId: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  ensurePhotosDir();
  const cleanId = String(photoId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const localPath = path.join(PHOTOS_DIR, `${cleanId}.jpg`);

  if (fs.existsSync(localPath)) {
    return {
      buffer: fs.readFileSync(localPath),
      contentType: 'image/jpeg',
    };
  }

  // Fallback: load from Cloud Firestore
  try {
    const docData = await getDocumentFromFirestore<StoredPhotoRecord>('photos', cleanId);
    if (docData && (docData.url || docData.dataUrl)) {
      const rawUrl = docData.url || docData.dataUrl || '';
      const matches = rawUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (matches && matches[2]) {
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(localPath, buffer);
        return {
          buffer,
          contentType: `image/${matches[1] || 'jpeg'}`,
        };
      }
    }
  } catch (err) {
    console.warn(`[Photos] Erro ao recuperar foto ${cleanId} do Firestore:`, err);
  }

  return null;
}

export async function getPhotoMetadata(photoId: string): Promise<StoredPhotoRecord | null> {
  const cleanId = String(photoId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  try {
    const docData = await getDocumentFromFirestore<StoredPhotoRecord>('photos', cleanId);
    if (docData) return docData;
  } catch (e) {
    // ignore
  }

  // If on disk, return minimal metadata
  const localPath = path.join(PHOTOS_DIR, `${cleanId}.jpg`);
  if (fs.existsSync(localPath)) {
    return {
      id: cleanId,
      takenAt: new Date().toISOString(),
    };
  }

  return null;
}

export function generatePhotoViewerHtml(photoId: string, meta: StoredPhotoRecord | null, host: string): string {
  const isOk = meta?.itemStatus === 'OK, MANUTENÇÃO EM DIA';
  const isMaintenance = meta?.itemStatus === 'AGENDAR MANUTENÇÃO';
  const statusLabel = meta?.itemStatus || 'REGISTRO DE VISTORIA';
  const condName = meta?.condominiumName || 'Condomínio Inspecionado';
  const towerName = meta?.tower ? `Torre: ${meta.tower}` : '';
  const envName = meta?.environmentName || 'Ambiente';
  const itemName = meta?.itemName || 'Item Inspecionado';
  const caption = meta?.caption || '';
  const obs = meta?.observations || '';
  const inspectionCode = meta?.inspectionCode || meta?.inspectionId || 'LAUDO TÉCNICO';
  const takenDate = meta?.takenAt ? new Date(meta.takenAt).toLocaleString('pt-BR') : 'Data não informada';
  const rawImageUrl = `/api/photos/${photoId}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <title>${condName} - Foto em Alta Resolução | CAST Inspect</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b1120;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
    }
    header {
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #1e293b;
      padding: 12px 16px;
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      background: #2563eb;
      color: #fff;
      font-weight: 900;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .title-block h1 {
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.2;
    }
    .title-block p {
      font-size: 11px;
      color: #94a3b8;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
    }
    .status-ok {
      background: rgba(22, 163, 74, 0.15);
      color: #4ade80;
      border: 1px solid rgba(74, 222, 128, 0.3);
    }
    .status-warn {
      background: rgba(220, 38, 38, 0.15);
      color: #f87171;
      border: 1px solid rgba(248, 113, 113, 0.3);
    }
    .viewer-container {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      background: radial-gradient(circle at center, #1e293b 0%, #0b1120 100%);
      overflow: hidden;
      cursor: grab;
      user-select: none;
      min-height: 55vh;
    }
    .viewer-container:active {
      cursor: grabbing;
    }
    #photoImg {
      max-width: 88vw;
      max-height: 75vh;
      object-fit: contain;
      transform-origin: center center;
      transition: transform 0.1s ease-out;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .controls-overlay {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(10px);
      border: 1px solid #334155;
      border-radius: 14px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      z-index: 40;
    }
    .btn-ctrl {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .btn-ctrl:hover {
      background: #334155;
      border-color: #64748b;
    }
    .btn-primary {
      background: #2563eb;
      border-color: #3b82f6;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .zoom-indicator {
      font-size: 11px;
      font-weight: 800;
      color: #38bdf8;
      min-width: 45px;
      text-align: center;
    }
    .info-footer {
      background: #0f172a;
      border-top: 1px solid #1e293b;
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      font-size: 12px;
    }
    .info-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 12px 14px;
    }
    .info-card strong {
      color: #38bdf8;
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-card span {
      color: #f1f5f9;
      font-size: 13px;
      line-height: 1.4;
    }
    @media (max-width: 640px) {
      .controls-overlay {
        bottom: 10px;
        padding: 4px 6px;
        gap: 4px;
      }
      .btn-ctrl {
        padding: 6px 8px;
        font-size: 11px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-section">
      <div class="brand-badge">CAST INSPECT</div>
      <div class="title-block">
        <h1>${condName} ${towerName ? `• ${towerName}` : ''}</h1>
        <p>${envName} &rsaquo; <strong>${itemName}</strong></p>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <div class="status-badge ${isMaintenance ? 'status-warn' : 'status-ok'}">
        <span>${isMaintenance ? '⚠️' : '✓'}</span>
        <span>${statusLabel}</span>
      </div>
      <a href="${rawImageUrl}" download="foto_${photoId}.jpg" class="btn-ctrl btn-primary" style="text-decoration: none;">
        <span>📥 Baixar Foto</span>
      </a>
    </div>
  </header>

  <div class="viewer-container" id="container">
    <img id="photoImg" src="${rawImageUrl}" alt="${itemName}" draggable="false" />

    <div class="controls-overlay">
      <button class="btn-ctrl" id="btnZoomOut" title="Afastar (Zoom -)">🔍 -</button>
      <div class="zoom-indicator" id="zoomText">100%</div>
      <button class="btn-ctrl" id="btnZoomIn" title="Aproximar (Zoom +)">🔍 +</button>
      <button class="btn-ctrl" id="btnReset" title="Ajustar à Tela">🔄 Ajustar</button>
      <button class="btn-ctrl" id="btn100" title="Tamanho Real 100%">1:1</button>
    </div>
  </div>

  <div class="info-footer">
    <div class="info-card">
      <strong>Item & Localização</strong>
      <span>${condName} ${towerName ? `<br>🏢 ${towerName}` : ''}<br>📍 ${envName} &rsaquo; ${itemName}</span>
    </div>

    ${obs ? `
    <div class="info-card">
      <strong>Observações Registradas</strong>
      <span>${obs}</span>
    </div>
    ` : ''}

    ${caption ? `
    <div class="info-card">
      <strong>Legenda da Fotografia</strong>
      <span>${caption}</span>
    </div>
    ` : ''}

    <div class="info-card">
      <strong>Detalhes do Laudo</strong>
      <span>Código: <strong>${inspectionCode}</strong><br>Data da Foto: ${takenDate}<br>Registro em Nuvem: Protegido por link criptografado</span>
    </div>
  </div>

  <script>
    const img = document.getElementById('photoImg');
    const container = document.getElementById('container');
    const zoomText = document.getElementById('zoomText');

    let scale = 1;
    let posX = 0;
    let posY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function updateTransform() {
      img.style.transform = \`translate(\${posX}px, \${posY}px) scale(\${scale})\`;
      zoomText.textContent = \`\${Math.round(scale * 100)}%\`;
    }

    function setScale(newScale) {
      scale = Math.min(Math.max(0.5, newScale), 5);
      if (scale === 1) {
        posX = 0;
        posY = 0;
      }
      updateTransform();
    }

    document.getElementById('btnZoomIn').addEventListener('click', () => setScale(scale + 0.3));
    document.getElementById('btnZoomOut').addEventListener('click', () => setScale(scale - 0.3));
    document.getElementById('btnReset').addEventListener('click', () => {
      scale = 1;
      posX = 0;
      posY = 0;
      updateTransform();
    });
    document.getElementById('btn100').addEventListener('click', () => {
      scale = 1;
      posX = 0;
      posY = 0;
      updateTransform();
    });

    // Mouse drag
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - posX;
      startY = e.clientY - posY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      posX = e.clientX - startX;
      posY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Wheel zoom
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY * -0.0015;
      setScale(scale + delta);
    }, { passive: false });

    // Double click to zoom in/out
    img.addEventListener('dblclick', () => {
      if (scale > 1.2) {
        setScale(1);
      } else {
        setScale(2.2);
      }
    });

    // Touch support (pinch and drag)
    let initialTouchDist = null;
    let initialScale = 1;

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - posX;
        startY = e.touches[0].clientY - posY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        initialTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = scale;
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        posX = e.touches[0].clientX - startX;
        posY = e.touches[0].clientY - startY;
        updateTransform();
      } else if (e.touches.length === 2 && initialTouchDist) {
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDist / initialTouchDist;
        setScale(initialScale * factor);
      }
    }, { passive: true });

    container.addEventListener('touchend', () => {
      isDragging = false;
      initialTouchDist = null;
    });
  </script>
</body>
</html>`;
}
