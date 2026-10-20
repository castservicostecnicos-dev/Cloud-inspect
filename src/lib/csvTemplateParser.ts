import * as XLSX from 'xlsx';
import { TemplateEnvironment, TemplateItem } from '../types';
import { formatAndCorrectItemConcept, formatItemDescription } from './itemTextFormatter';

export interface CsvParseResult {
  success: boolean;
  error?: string;
  environments: TemplateEnvironment[];
  totalEnvironments: number;
  totalItems: number;
  totalWithDescription?: number;
  towers?: string[];
  totalTowers?: number;
  warnings?: string[];
}

/**
 * Splits a CSV line taking quotes into account
 */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, '').trim());
  return result;
}

/**
 * Detects the most probable delimiter (; , \t |)
 */
function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r\n|\n|\r/).slice(0, 5).join('\n');
  const counts = {
    ';': (firstLines.match(/;/g) || []).length,
    ',': (firstLines.match(/,/g) || []).length,
    '\t': (firstLines.match(/\t/g) || []).length,
    '|': (firstLines.match(/\|/g) || []).length,
  };

  let best = ';';
  let maxCount = counts[';'];
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      best = delim;
    }
  }
  return best;
}

/**
 * Core Parser: Maps 4 columns in the requested sequence:
 * Coluna 1 -> Torre / Bloco
 * Coluna 2 -> Ambiente
 * Coluna 3 -> Item
 * Coluna 4 -> Descrição
 *
 * Supports:
 * - When there is more than 1 tower, creates and groups each tower,
 *   then creates the environments in each tower, and inside environments, the items with their descriptions.
 * - Header row detection and skipping.
 * - Carry-over of previous tower/environment when columns are empty in subsequent rows.
 * - Trimming, normalization and uppercase formatting.
 */
export function parseSpreadsheetGrid(rows: any[][]): CsvParseResult {
  if (!rows || rows.length === 0) {
    return {
      success: false,
      error: 'A planilha selecionada está vazia.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
      towers: [],
      totalTowers: 0,
    };
  }

  // Filter out empty rows
  const cleanRows = rows
    .map((r) =>
      Array.isArray(r)
        ? r.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : ''))
        : []
    )
    .filter((r) => r.some((cell) => cell.length > 0));

  if (cleanRows.length === 0) {
    return {
      success: false,
      error: 'Nenhum dado legível encontrado na planilha.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
      towers: [],
      totalTowers: 0,
    };
  }

  let startIdx = 0;
  let towerColIdx = 0;
  let envColIdx = 1;
  let itemColIdx = 2;
  let descColIdx = 3;
  let hasTowerCol = true;
  let headerFound = false;

  // Scan the first 5 non-empty rows for an explicit header row
  for (let r = 0; r < Math.min(cleanRows.length, 5); r++) {
    const row = cleanRows[r];
    const normalizedCells = row.map((cell) =>
      String(cell || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    );

    const fTower = normalizedCells.findIndex(
      (c) =>
        c.includes('torre') ||
        c.includes('bloco') ||
        c.includes('edificio') ||
        c.includes('predio') ||
        c === 'coluna 1' ||
        c.startsWith('coluna 1')
    );
    const fEnv = normalizedCells.findIndex(
      (c) =>
        c.includes('ambiente') ||
        c.includes('local') ||
        c.includes('setor') ||
        c.includes('area') ||
        c.includes('comodo') ||
        c === 'coluna 2' ||
        c.startsWith('coluna 2')
    );
    const fItem = normalizedCells.findIndex(
      (c) =>
        c.includes('item') ||
        c.includes('elemento') ||
        c.includes('equipamento') ||
        c.includes('componente') ||
        c.includes('nome') ||
        c === 'coluna 3' ||
        c.startsWith('coluna 3')
    );
    const fDesc = normalizedCells.findIndex(
      (c) =>
        c.includes('descri') ||
        c.includes('observa') ||
        c.includes('detalhe') ||
        c.includes('escopo') ||
        c.includes('especific') ||
        c.includes('orienta') ||
        c.includes('procedimento') ||
        c.includes('criterio') ||
        c === 'obs' ||
        c === 'desc' ||
        c === 'coluna 4' ||
        c.startsWith('coluna 4')
    );

    // If explicit Torre, Ambiente, Item columns exist
    if (fTower >= 0 && fEnv >= 0 && fItem >= 0) {
      headerFound = true;
      startIdx = r + 1;
      hasTowerCol = true;
      towerColIdx = fTower;
      envColIdx = fEnv;
      itemColIdx = fItem;
      descColIdx = fDesc >= 0 ? fDesc : (fItem !== 3 && normalizedCells.length >= 4 ? 3 : itemColIdx + 1);
      break;
    }

    // If only Ambiente and Item columns exist (legacy 2 or 3 column spreadsheet)
    if (fEnv >= 0 && fItem >= 0 && fTower === -1) {
      headerFound = true;
      startIdx = r + 1;
      hasTowerCol = false;
      envColIdx = fEnv;
      itemColIdx = fItem;
      descColIdx = fDesc >= 0 ? fDesc : itemColIdx + 1;
      break;
    }
  }

  // If no explicit header was found
  if (!headerFound) {
    const firstCol0 =
      cleanRows[0][0]?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
    const isCol0Index =
      firstCol0 === '#' ||
      firstCol0 === 'nº' ||
      firstCol0 === 'no' ||
      firstCol0 === 'id' ||
      firstCol0 === 'codigo' ||
      firstCol0 === 'seq' ||
      firstCol0 === 'ordem';

    if (isCol0Index && cleanRows[0].length >= 4) {
      // Index column, then Torre, Ambiente, Item, Descrição
      towerColIdx = 1;
      envColIdx = 2;
      itemColIdx = 3;
      descColIdx = 4;
      hasTowerCol = true;
      startIdx = 1;
    } else if (cleanRows[0].length >= 4) {
      // Direct 4-column layout as requested: Torre, Ambiente, Item, Descrição
      hasTowerCol = true;
      towerColIdx = 0;
      envColIdx = 1;
      itemColIdx = 2;
      descColIdx = 3;
      // If row 0 looks like a header label row, skip it
      const row0Words = cleanRows[0].map((c) =>
        String(c || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
      );
      const looksLikeHeaderRow = row0Words.some(
        (w) =>
          w.includes('torre') ||
          w.includes('bloco') ||
          w.includes('ambiente') ||
          w.includes('local') ||
          w.includes('item') ||
          w.includes('desc')
      );
      const row0Filled = cleanRows[0].filter((c) => String(c).trim().length > 0).length;
      const row1Filled = cleanRows[1] ? cleanRows[1].filter((c) => String(c).trim().length > 0).length : 0;
      if (looksLikeHeaderRow || (row0Filled <= 2 && row1Filled >= 3)) {
        startIdx = 1;
      }
    } else if (cleanRows[0].length === 3) {
      // 3 columns: check if first column contains "torre" or "bloco"
      const col0Sample = cleanRows.slice(0, 5).map((r) => String(r[0] || '').toLowerCase());
      const looksLikeTower = col0Sample.some((v) => v.includes('torre') || v.includes('bloco'));
      if (looksLikeTower) {
        hasTowerCol = true;
        towerColIdx = 0;
        envColIdx = 1;
        itemColIdx = 2;
        descColIdx = -1;
      } else {
        hasTowerCol = false;
        envColIdx = 0;
        itemColIdx = 1;
        descColIdx = 2;
      }
    } else {
      hasTowerCol = false;
      envColIdx = 0;
      itemColIdx = 1;
      descColIdx = -1;
    }
  }

  // Intermediate data map grouped by: `${tower}:::${environment}`
  interface GroupedEnv {
    tower?: string;
    envName: string;
    items: TemplateItem[];
  }

  const groupMap = new Map<string, GroupedEnv>();
  const groupOrder: string[] = [];
  const distinctTowersSet = new Set<string>();
  const baseTime = Date.now();
  let itemCounter = 0;
  let itemsWithDescCounter = 0;

  let currentTowerName = '';
  let currentEnvName = '';

  for (let i = startIdx; i < cleanRows.length; i++) {
    const row = cleanRows[i];

    const rawColTower = (hasTowerCol && towerColIdx >= 0 && row[towerColIdx] !== undefined && row[towerColIdx] !== null ? String(row[towerColIdx]) : '').trim();
    const rawColEnv = (envColIdx >= 0 && row[envColIdx] !== undefined && row[envColIdx] !== null ? String(row[envColIdx]) : '').trim();
    const rawColItem = (itemColIdx >= 0 && row[itemColIdx] !== undefined && row[itemColIdx] !== null ? String(row[itemColIdx]) : '').trim();
    const rawColDesc = (descColIdx >= 0 && row[descColIdx] !== undefined && row[descColIdx] !== null ? String(row[descColIdx]) : '').trim();

    // Skip duplicate headers if present in body
    const normTower = rawColTower.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normEnv = rawColEnv.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normItem = rawColItem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (
      (normTower.includes('torre') || normTower.includes('bloco')) &&
      (normEnv.includes('ambiente') || normEnv.includes('local')) &&
      (normItem.includes('item') || normItem.includes('elemento'))
    ) {
      continue;
    }

    // 1. TORRE: If column Torre is populated, update current tower
    if (hasTowerCol && rawColTower) {
      currentTowerName = rawColTower.replace(/\s+/g, ' ').trim().toUpperCase();
      // Reset current environment when a new tower starts without an environment specified in this cell
      if (!rawColEnv && currentEnvName) {
        currentEnvName = '';
      }
    }

    // 2. AMBIENTE: If column Ambiente is populated, update current environment
    if (rawColEnv) {
      currentEnvName = rawColEnv.replace(/\s+/g, ' ').trim().toUpperCase();
    }

    // Effective Tower and Environment (with carry-over)
    const effectiveTower = hasTowerCol ? (currentTowerName || (rawColItem ? 'TORRE 1' : '')) : '';
    const effectiveEnv = currentEnvName || (rawColItem ? 'ÁREAS GERAIS' : '');

    if (effectiveTower) {
      distinctTowersSet.add(effectiveTower);
    }

    if (effectiveEnv) {
      const groupKey = effectiveTower ? `${effectiveTower}:::${effectiveEnv}` : `:::${effectiveEnv}`;

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          tower: effectiveTower || undefined,
          envName: effectiveEnv,
          items: [],
        });
        groupOrder.push(groupKey);
      }

      // 3. ITEM & 4. DESCRIÇÃO: If column Item has content, format item and attach description
      if (rawColItem) {
        itemCounter++;
        const targetGroup = groupMap.get(groupKey)!;
        const formattedItemName = formatAndCorrectItemConcept(rawColItem);
        const formattedDescription = formatItemDescription(rawColDesc);

        if (formattedDescription) {
          itemsWithDescCounter++;
        }

        targetGroup.items.push({
          id: `tit_${baseTime}_${itemCounter}`,
          name: formattedItemName,
          description: formattedDescription,
          order: targetGroup.items.length + 1,
        });
      }
    }
  }

  if (groupOrder.length === 0) {
    return {
      success: false,
      error:
        'Não foi possível extrair os dados. Certifique-se de organizar a planilha nas colunas: Torre, Ambiente, Item e Descrição.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
      towers: [],
      totalTowers: 0,
    };
  }

  // Construct final TemplateEnvironment list in sequential order:
  // Torre -> Ambiente -> Itens -> Descrição
  const environments: TemplateEnvironment[] = groupOrder.map((groupKey, eIdx) => {
    const group = groupMap.get(groupKey)!;
    return {
      id: `tenv_${baseTime}_${eIdx + 1}`,
      name: group.envName,
      tower: group.tower,
      order: eIdx + 1,
      items: group.items,
    };
  });

  const totalItems = environments.reduce((acc, env) => acc + env.items.length, 0);
  const towers = Array.from(distinctTowersSet);

  return {
    success: true,
    environments,
    totalEnvironments: environments.length,
    totalItems,
    totalWithDescription: itemsWithDescCounter,
    towers,
    totalTowers: towers.length,
  };
}

/**
 * Parses raw CSV or text into grouped TemplateEnvironments and TemplateItems
 * (Coluna 1 = Ambiente, Coluna 2 = Item)
 */
export function parseTemplateCsv(csvContent: string): CsvParseResult {
  if (!csvContent || !csvContent.trim()) {
    return {
      success: false,
      error: 'O arquivo CSV está vazio.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
    };
  }

  const cleanText = csvContent.replace(/^\uFEFF/, '');
  const lines = cleanText
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      success: false,
      error: 'Nenhuma linha válida encontrada no CSV.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
    };
  }

  const delimiter = detectDelimiter(lines.join('\n'));
  const rows = lines.map((l) => splitCsvLine(l, delimiter));
  return parseSpreadsheetGrid(rows);
}

/**
 * Parses binary spreadsheet (.xlsx or .xls) using SheetJS
 * (Coluna 1 = Ambiente, Coluna 2 = Item)
 */
export function parseTemplateSpreadsheet(arrayBuffer: ArrayBuffer): CsvParseResult {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        error: 'A planilha selecionada não possui abas com dados.',
        environments: [],
        totalEnvironments: 0,
        totalItems: 0,
      };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    // Extract full 2D grid with Column 1 = index 0, Column 2 = index 1
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
    return parseSpreadsheetGrid(rows);
  } catch (err: any) {
    return {
      success: false,
      error: `Erro ao processar planilha Excel: ${err?.message || 'Arquivo inválido ou corrompido.'}`,
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
    };
  }
}

const SAMPLE_TEMPLATE_ROWS = [
  ['Torre', 'Ambiente', 'Item', 'Descrição'],
  ['TORRE 1', 'HALL DE ENTRADA', 'PORTA DE ACESSO PRINCIPAL', 'Verificar fechadura, mola hidráulica, alinhamento e vedação'],
  ['TORRE 1', 'HALL DE ENTRADA', 'INTERFONE E PAINEL DE SENHA', 'Testar comunicação com a portaria e conservação dos botões'],
  ['TORRE 1', 'HALL DE ENTRADA', 'ILUMINAÇÃO E SENSORES DE PRESENÇA', 'Checar acendimento automático e estado das luminárias'],
  ['TORRE 1', 'HALL DE ENTRADA', 'PISO E RODAPÉS', 'Inspecionar ausência de trincas, desníveis ou peças soltas'],
  ['TORRE 1', 'ELEVADORES', 'CABINE E BOTOEIRA', 'Testar botoeira, interfone de emergência, ventilador e espelhos'],
  ['TORRE 1', 'ELEVADORES', 'PORTAS DE PAVIMENTO', 'Checar abertura, fechamento suave e alinhamento do piso'],
  ['TORRE 2', 'HALL DE ENTRADA', 'PORTA DE ACESSO PRINCIPAL', 'Verificar fechadura, mola hidráulica, alinhamento e vedação'],
  ['TORRE 2', 'HALL DE ENTRADA', 'INTERFONE E PAINEL DE SENHA', 'Testar comunicação com a portaria e conservação dos botões'],
  ['TORRE 2', 'HALL DE ENTRADA', 'ILUMINAÇÃO E SENSORES DE PRESENÇA', 'Checar acendimento automático e estado das luminárias'],
  ['TORRE 2', 'ELEVADORES', 'CABINE E BOTOEIRA', 'Testar botoeira, interfone de emergência, ventilador e espelhos'],
  ['ÁREA COMUM', 'GARAGEM E ESTACIONAMENTO', 'PORTÃO ELETRÔNICO E MOTORES', 'Verificar cremalheira, fim de curso, tração e fotocélulas'],
  ['ÁREA COMUM', 'GARAGEM E ESTACIONAMENTO', 'DEMARCAÇÃO DE VAGAS E SINALIZAÇÃO', 'Avaliar pintura reflexiva, faixas e limitadores de vaga'],
  ['ÁREA COMUM', 'GARAGEM E ESTACIONAMENTO', 'ILUMINAÇÃO DE EMERGÊNCIA', 'Testar blocos autônomos e autonomia das baterias'],
  ['ÁREA COMUM', 'GARAGEM E ESTACIONAMENTO', 'RALOS E GRELHAS PLUVIAIS', 'Checar desobstrução e estanqueidade das grelhas'],
  ['ÁREA COMUM', 'SISTEMA DE COMBATE A INCÊNDIO', 'EXTINTORES DE INCÊNDIO (CARGA E LACRE)', 'Checar lacre, manômetro na faixa verde e data de validade da carga'],
  ['ÁREA COMUM', 'SISTEMA DE COMBATE A INCÊNDIO', 'PORTAS CORTA-FOGO E FECHADURAS', 'Verificar fechamento autônomo, maçanetas antipânico e selo ABNT'],
  ['ÁREA COMUM', 'SISTEMA DE COMBATE A INCÊNDIO', 'ABRIGOS DE HIDRANTES E MANGUEIRAS', 'Inspecionar mangueiras enroladas, esguicho regulável e registro globo'],
  ['ÁREA COMUM', 'SISTEMA DE COMBATE A INCÊNDIO', 'SINALIZAÇÃO FOTOLUMINESCENTE E ROTAS', 'Checar placas fotoluminescentes nas rotas de fuga'],
  ['ÁREA COMUM', 'BARRILETE E CASA DE BOMBAS', 'BOMBAS DE RECALQUE DE ÁGUA POTÁVEL', 'Testar acionamento automático/manual e alternância de bombas'],
  ['ÁREA COMUM', 'BARRILETE E CASA DE BOMBAS', 'BOMBAS DE ESGOTO E DRENAGEM', 'Verificar boias de nível e ausência de ruídos ou vazamentos'],
  ['ÁREA COMUM', 'BARRILETE E CASA DE BOMBAS', 'QUADRO ELÉTRICO DE FORÇA E COMANDO', 'Inspecionar disjuntores, contatores, relés térmicos e barramento'],
  ['ÁREA COMUM', 'BARRILETE E CASA DE BOMBAS', 'TUBULAÇÕES, VÁLVULAS E REGISTROS', 'Verificar estanqueidade, ausência de gotejamentos e manômetros'],
  ['ÁREA COMUM', 'COBERTURA E FACHADAS', 'TELHADO, CALHAS E RUFOS METÁLICOS', 'Inspecionar vedação dos rufos, fixação de telhas e desobstrução de calhas'],
  ['ÁREA COMUM', 'COBERTURA E FACHADAS', 'PARA-RAIOS (SPDA) E ATERRAMENTO', 'Checar mastro, captores, conectores de medição e laudo de continuidade'],
  ['ÁREA COMUM', 'COBERTURA E FACHADAS', 'PINTURA E REVESTIMENTO DE FACHADA', 'Verificar ausência de fissuras, eflorescência ou destacamento de pastilhas'],
  ['ÁREA COMUM', 'ÁREA DE LAZER E SALÃO DE FESTAS', 'CHURRASQUEIRA E COIFA', 'Avaliar duto de exaustão, refratários e registros de gás'],
  ['ÁREA COMUM', 'ÁREA DE LAZER E SALÃO DE FESTAS', 'PISCINA E EQUIPAMENTOS DE FILTRAGEM', 'Inspecionar casa de bombas, skimmer, grelhas e ralos de fundo'],
  ['ÁREA COMUM', 'ÁREA DE LAZER E SALÃO DE FESTAS', 'MOBILIÁRIO E ESQUADRIAS', 'Checar conservação de mesas, cadeiras, portas e janelas'],
];

/**
 * Generates sample CSV content ready for download
 */
export function generateSampleTemplateCsv(): string {
  return SAMPLE_TEMPLATE_ROWS.map((r) => r.map((c) => `"${c}"`).join(';')).join('\r\n');
}

/**
 * Generates sample Excel (.xlsx) file as Uint8Array ready for download (4 columns)
 */
export function generateSampleTemplateXlsx(): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(SAMPLE_TEMPLATE_ROWS);
  ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 42 }, { wch: 58 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist 4 Colunas');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Exports an InspectionTemplate to an Excel (.xlsx) file as Uint8Array (4 columns)
 */
export function exportTemplateAsXlsx(tmpl: { title: string; environments: TemplateEnvironment[] }): Uint8Array {
  const rows = [['Torre', 'Ambiente', 'Item', 'Descrição']];
  tmpl.environments.forEach((env) => {
    const towerName = env.tower || 'TORRE ÚNICA';
    if (env.items && env.items.length > 0) {
      env.items.forEach((it) => {
        rows.push([towerName, env.name, it.name, it.description || '']);
      });
    } else {
      rows.push([towerName, env.name, '', '']);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 18 }, { wch: 34 }, { wch: 42 }, { wch: 58 }];
  const wb = XLSX.utils.book_new();
  const sheetTitle = (tmpl.title || 'Checklist').replace(/[\\/?*[\]]/g, ' ').substring(0, 31).trim();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle || 'Checklist');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}
