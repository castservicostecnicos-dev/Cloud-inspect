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
 * Core Parser: Maps Column 1 -> Ambientes and Column 2 -> Itens from any 2D grid
 * Supports:
 * - Direct row-by-row mapping
 * - Header row detection and skipping
 * - Carry-over of previous environment when Column 1 is empty in subsequent rows
 * - Trimming and normalization
 */
export function parseSpreadsheetGrid(rows: any[][]): CsvParseResult {
  if (!rows || rows.length === 0) {
    return {
      success: false,
      error: 'A planilha selecionada está vazia.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
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
    };
  }

  let startIdx = 0;
  let envColIdx = 0;
  let itemColIdx = 1;
  let descColIdx = 2; // Coluna 3 por padrão (Descrição)
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

    const fEnv = normalizedCells.findIndex(
      (c) =>
        c.includes('ambiente') ||
        c.includes('local') ||
        c.includes('setor') ||
        c.includes('area') ||
        c.includes('comodo') ||
        c === 'coluna 1' ||
        c.startsWith('coluna 1')
    );
    const fItem = normalizedCells.findIndex(
      (c) =>
        c.includes('item') ||
        c.includes('elemento') ||
        c.includes('equipamento') ||
        c.includes('componente') ||
        c.includes('nome') ||
        c === 'coluna 2' ||
        c.startsWith('coluna 2')
    );
    const fDesc = normalizedCells.findIndex(
      (c) =>
        c.includes('descri') ||
        c.includes('observa') ||
        c.includes('detalhe') ||
        c.includes('escopo') ||
        c.includes('especific') ||
        c === 'coluna 3' ||
        c.startsWith('coluna 3')
    );

    if ((fEnv >= 0 && fItem >= 0) || (fItem >= 0 && fDesc >= 0)) {
      headerFound = true;
      startIdx = r + 1;
      if (fEnv >= 0) envColIdx = fEnv;
      if (fItem >= 0) itemColIdx = fItem;
      if (fDesc >= 0) {
        descColIdx = fDesc;
      } else {
        descColIdx = itemColIdx + 1;
      }
      break;
    }
  }

  // If no explicit header was found, check if Col 0 is an index/ID column
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

    if (isCol0Index && cleanRows[0].length >= 3) {
      envColIdx = 1;
      itemColIdx = 2;
      descColIdx = 3;
      startIdx = 1;
    } else {
      // If row 0 has only 1 column populated while row 1 has multiple, row 0 is a title banner
      const row0Filled = cleanRows[0].filter((c) => String(c).trim().length > 0).length;
      const row1Filled = cleanRows[1] ? cleanRows[1].filter((c) => String(c).trim().length > 0).length : 0;
      if (row0Filled === 1 && row1Filled >= 2) {
        startIdx = 1;
      }
    }
  }

  const envMap = new Map<string, TemplateItem[]>();
  const envOrder: string[] = [];
  const baseTime = Date.now();
  let itemCounter = 0;
  let itemsWithDescCounter = 0;
  let currentEnvName = '';

  for (let i = startIdx; i < cleanRows.length; i++) {
    const row = cleanRows[i];
    // Coluna 1 = Ambiente, Coluna 2 = Item, Coluna 3 = Descrição
    const colEnv = (row[envColIdx] !== undefined && row[envColIdx] !== null ? String(row[envColIdx]) : '').trim();
    const rawColItem = (row[itemColIdx] !== undefined && row[itemColIdx] !== null ? String(row[itemColIdx]) : '').trim();
    const rawColDesc = (descColIdx >= 0 && row[descColIdx] !== undefined && row[descColIdx] !== null ? String(row[descColIdx]) : '').trim();

    // Check if this row is accidentally another duplicate header line
    const normEnv = colEnv.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normItem = rawColItem.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if ((normEnv.includes('ambiente') || normEnv === 'coluna 1') && (normItem.includes('item') || normItem === 'coluna 2')) {
      continue;
    }

    // If Coluna Ambiente is present, update current environment in UPPERCASE
    if (colEnv) {
      currentEnvName = colEnv.replace(/\s+/g, ' ').trim().toUpperCase();
    }

    // If we have an environment (either from current row or carried over from previous row)
    // or if we have an item without environment name, fallback to "ÁREAS GERAIS"
    const effectiveEnvName = currentEnvName || (rawColItem ? 'ÁREAS GERAIS' : '');

    if (effectiveEnvName) {
      if (!envMap.has(effectiveEnvName)) {
        envMap.set(effectiveEnvName, []);
        envOrder.push(effectiveEnvName);
      }

      // If Coluna Item has an item name, format it in UPPERCASE with orthographic corrections
      if (rawColItem) {
        itemCounter++;
        const currentItems = envMap.get(effectiveEnvName)!;
        const formattedItemName = formatAndCorrectItemConcept(rawColItem);
        const formattedDescription = formatItemDescription(rawColDesc);

        if (formattedDescription) {
          itemsWithDescCounter++;
        }

        currentItems.push({
          id: `tit_${baseTime}_${itemCounter}`,
          name: formattedItemName,
          description: formattedDescription,
          order: currentItems.length + 1,
        });
      }
    }
  }

  if (envOrder.length === 0) {
    return {
      success: false,
      error:
        'Não foi possível extrair ambientes e itens. Certifique-se de preencher os Ambientes na Coluna 1 e os Itens na Coluna 2 da planilha.',
      environments: [],
      totalEnvironments: 0,
      totalItems: 0,
    };
  }

  const environments: TemplateEnvironment[] = envOrder.map((envName, eIdx) => ({
    id: `tenv_${baseTime}_${eIdx + 1}`,
    name: envName,
    order: eIdx + 1,
    items: envMap.get(envName) || [],
  }));

  const totalItems = environments.reduce((acc, env) => acc + env.items.length, 0);

  return {
    success: true,
    environments,
    totalEnvironments: environments.length,
    totalItems,
    totalWithDescription: itemsWithDescCounter,
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
  ['Ambiente', 'Item', 'Descrição'],
  ['HALL DE ENTRADA', 'PORTA DE ACESSO PRINCIPAL', 'Verificar fechadura, mola hidráulica, alinhamento e vedação'],
  ['HALL DE ENTRADA', 'INTERFONE E PAINEL DE SENHA', 'Testar comunicação com a portaria e conservação dos botões'],
  ['HALL DE ENTRADA', 'ILUMINAÇÃO E SENSORES DE PRESENÇA', 'Checar acendimento automático e estado das luminárias'],
  ['HALL DE ENTRADA', 'PISO E RODAPÉS', 'Inspecionar ausência de trincas, desníveis ou peças soltas'],
  ['GARAGEM E ESTACIONAMENTO', 'PORTÃO ELETRÔNICO E MOTORES', 'Verificar cremalheira, fim de curso, tração e fotocélulas'],
  ['GARAGEM E ESTACIONAMENTO', 'DEMARCAÇÃO DE VAGAS E SINALIZAÇÃO', 'Avaliar pintura reflexiva, faixas e limitadores de vaga'],
  ['GARAGEM E ESTACIONAMENTO', 'ILUMINAÇÃO DE EMERGÊNCIA', 'Testar blocos autônomos e autonomia das baterias'],
  ['GARAGEM E ESTACIONAMENTO', 'RALOS E GRELHAS PLUVIAIS', 'Checar desobstrução e estanqueidade das grelhas'],
  ['SISTEMA DE COMBATE A INCÊNDIO', 'EXTINTORES DE INCÊNDIO (CARGA E LACRE)', 'Checar lacre, manômetro na faixa verde e data de validade da carga'],
  ['SISTEMA DE COMBATE A INCÊNDIO', 'PORTAS CORTA-FOGO E FECHADURAS', 'Verificar fechamento autônomo, maçanetas antipânico e selo ABNT'],
  ['SISTEMA DE COMBATE A INCÊNDIO', 'ABRIGOS DE HIDRANTES E MANGUEIRAS', 'Inspecionar mangueiras enroladas, esguicho regulável e registro globo'],
  ['SISTEMA DE COMBATE A INCÊNDIO', 'SINALIZAÇÃO FOTOLUMINESCENTE E ROTAS', 'Checar placas fotoluminescentes nas rotas de fuga'],
  ['BARRILETE E CASA DE BOMBAS', 'BOMBAS DE RECALQUE DE ÁGUA POTÁVEL', 'Testar acionamento automático/manual e alternância de bombas'],
  ['BARRILETE E CASA DE BOMBAS', 'BOMBAS DE ESGOTO E DRENAGEM', 'Verificar boias de nível e ausência de ruídos ou vazamentos'],
  ['BARRILETE E CASA DE BOMBAS', 'QUADRO ELÉTRICO DE FORÇA E COMANDO', 'Inspecionar disjuntores, contatores, relés térmicos e barramento'],
  ['BARRILETE E CASA DE BOMBAS', 'TUBULAÇÕES, VÁLVULAS E REGISTROS', 'Verificar estanqueidade, ausência de gotejamentos e manômetros'],
  ['COBERTURA E FACHADAS', 'TELHADO, CALHAS E RUFOS METÁLICOS', 'Inspecionar vedação dos rufos, fixação de telhas e desobstrução de calhas'],
  ['COBERTURA E FACHADAS', 'PARA-RAIOS (SPDA) E ATERRAMENTO', 'Checar mastro, captores, conectores de medição e laudo de continuidade'],
  ['COBERTURA E FACHADAS', 'PINTURA E REVESTIMENTO DE FACHADA', 'Verificar ausência de fissuras, eflorescência ou destacamento de pastilhas'],
  ['ÁREA DE LAZER E SALÃO DE FESTAS', 'CHURRASQUEIRA E COIFA', 'Avaliar duto de exaustão, refratários e registros de gás'],
  ['ÁREA DE LAZER E SALÃO DE FESTAS', 'PISCINA E EQUIPAMENTOS DE FILTRAGEM', 'Inspecionar casa de bombas, skimmer, grelhas e ralos de fundo'],
  ['ÁREA DE LAZER E SALÃO DE FESTAS', 'MOBILIÁRIO E ESQUADRIAS', 'Checar conservação de mesas, cadeiras, portas e janelas'],
];

/**
 * Generates sample CSV content ready for download
 */
export function generateSampleTemplateCsv(): string {
  return SAMPLE_TEMPLATE_ROWS.map((r) => r.map((c) => `"${c}"`).join(';')).join('\r\n');
}

/**
 * Generates sample Excel (.xlsx) file as Uint8Array ready for download
 */
export function generateSampleTemplateXlsx(): Uint8Array {
  const ws = XLSX.utils.aoa_to_sheet(SAMPLE_TEMPLATE_ROWS);
  ws['!cols'] = [{ wch: 34 }, { wch: 42 }, { wch: 54 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ambientes e Itens');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}

/**
 * Exports an InspectionTemplate to an Excel (.xlsx) file as Uint8Array
 */
export function exportTemplateAsXlsx(tmpl: { title: string; environments: TemplateEnvironment[] }): Uint8Array {
  const rows = [['Ambiente', 'Item', 'Descrição']];
  tmpl.environments.forEach((env) => {
    if (env.items && env.items.length > 0) {
      env.items.forEach((it) => {
        rows.push([env.name, it.name, it.description || '']);
      });
    } else {
      rows.push([env.name, '', '']);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 34 }, { wch: 42 }, { wch: 54 }];
  const wb = XLSX.utils.book_new();
  const sheetTitle = (tmpl.title || 'Checklist').replace(/[\\/?*[\]]/g, ' ').substring(0, 31).trim();
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle || 'Checklist');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}
