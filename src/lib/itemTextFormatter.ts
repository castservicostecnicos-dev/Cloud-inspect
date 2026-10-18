/**
 * Utility for formatting and orthographically correcting inspection item concepts
 * Ensures all items loaded from spreadsheets are in UPPERCASE with correct Portuguese diacritics/accents.
 */

// Common multi-word terms in building inspections that need specific hyphenation or accents
const PHRASE_CORRECTIONS: [RegExp, string][] = [
  [/\bportas?\s+corta[\s-]fogos?\b/gi, 'PORTA CORTA-FOGO'],
  [/\bportas?\s+cortafogos?\b/gi, 'PORTA CORTA-FOGO'],
  [/\bpara[\s-]?r?raios?\b/gi, 'PARA-RAIOS (SPDA)'],
  [/\bspda\b/gi, 'SPDA'],
  [/\bguarda[\s-]corpos?\b/gi, 'GUARDA-CORPO'],
  [/\bguardacorpos?\b/gi, 'GUARDA-CORPO'],
  [/\bcaixas?\s+d['’\s]?aguas?\b/gi, "CAIXA D'ÁGUA"],
  [/\bar[\s-]condicionados?\b/gi, 'AR-CONDICIONADO'],
  [/\bbate[\s-]rodas?\b/gi, 'BATE-RODAS'],
  [/\bcurto[\s-]circuitos?\b/gi, 'CURTO-CIRCUITO'],
  [/\bmolas?\s+aereas?\b/gi, 'MOLA AÉREA'],
  [/\bpiso[\s-]tatil\b/gi, 'PISO TÁTIL'],
  [/\bpisos?\s+tatil\b/gi, 'PISO TÁTIL'],
  [/\bpisos?\s+tateis\b/gi, 'PISOS TÁTEIS'],
  [/\bcasa\s+de\s+maquinas?\b/gi, 'CASA DE MÁQUINAS'],
  [/\bcasa\s+de\s+bombas?\b/gi, 'CASA DE BOMBAS'],
  [/\bcentral\s+de\s+gas\b/gi, 'CENTRAL DE GÁS'],
  [/\bcentral\s+de\s+alarme\b/gi, 'CENTRAL DE ALARME'],
  [/\bvalvulas?\s+redutoras?\s+de\s+pressao\b/gi, 'VÁLVULA REDUTORA DE PRESSÃO (VRP)'],
  [/\bvrp\b/gi, 'VRP'],
  [/\bvga\b/gi, 'VGA'],
  [/\bcftv\b/gi, 'CFTV'],
  [/\bdps\b/gi, 'DPS'],
  [/\bavcb\b/gi, 'AVCB'],
  [/\bclcb\b/gi, 'CLCB'],
  [/\babnt\b/gi, 'ABNT'],
  [/\bnbr\b/gi, 'NBR'],
  [/\bco2\b/gi, 'CO2'],
  [/\bpqs\b/gi, 'PQS'],
  [/\bpó\s+abc\b/gi, 'PÓ ABC'],
  [/\bpo\s+abc\b/gi, 'PÓ ABC'],
  [/\bacionador(es)?\s+manuais?\b/gi, 'ACIONADOR MANUAL'],
  [/\bsirenes?\s+audiovisuais?\b/gi, 'SIRENE AUDIOVISUAL'],
  [/\bsinalizacao\s+de\s+emergencia\b/gi, 'SINALIZAÇÃO DE EMERGÊNCIA'],
  [/\biluminacao\s+de\s+emergencia\b/gi, 'ILUMINAÇÃO DE EMERGÊNCIA'],
  [/\bluz\s+de\s+emergencia\b/gi, 'LUZ DE EMERGÊNCIA'],
  [/\bbotoeiras?\s+de\s+emergencia\b/gi, 'BOTOEIRA DE EMERGÊNCIA'],
  [/\brotas?\s+de\s+fuga\b/gi, 'ROTA DE FUGA'],
  [/\bjuntas?\s+de\s+dilatacao\b/gi, 'JUNTA DE DILATAÇÃO'],
  [/\barmaduras?\s+expostas?\b/gi, 'ARMADURA EXPOSTA'],
  [/\bponto\s+quente\b/gi, 'PONTO QUENTE'],
  [/\bdiagrama\s+unifilar\b/gi, 'DIAGRAMA UNIFILAR'],
  [/\bquadros?\s+de\s+distribuicao\b/gi, 'QUADRO DE DISTRIBUIÇÃO'],
  [/\bquadros?\s+de\s+comando\b/gi, 'QUADRO DE COMANDO'],
  [/\bquadros?\s+eletricos?\b/gi, 'QUADRO ELÉTRICO'],
  [/\bmotobombas?\s+de\s+recalque\b/gi, 'MOTOBOMBA DE RECALQUE'],
  [/\bbombas?\s+de\s+recalque\b/gi, 'BOMBA DE RECALQUE'],
  [/\bbombas?\s+de\s+esgoto\b/gi, 'BOMBA DE ESGOTO'],
  [/\bbombas?\s+de\s+drenagem\b/gi, 'BOMBA DE DRENAGEM'],
  [/\bfossas?\s+septicas?\b/gi, 'FOSSA SÉPTICA'],
  [/\bfiltros?\s+anaerobios?\b/gi, 'FILTRO ANAERÓBIO'],
  [/\bcaixas?\s+de\s+gordura\b/gi, 'CAIXA DE GORDURA'],
  [/\bcaixas?\s+de\s+passagem\b/gi, 'CAIXA DE PASSAGEM'],
  [/\bcaixas?\s+de\s+inspecao\b/gi, 'CAIXA DE INSPEÇÃO'],
  [/\bfechaduras?\s+eletro[ií]m[aã]s?\b/gi, 'FECHADURA ELETROÍMÃ'],
  [/\bfechaduras?\s+digitais?\b/gi, 'FECHADURA DIGITAL'],
  [/\bportoes?\s+eletronicos?\b/gi, 'PORTÃO ELETRÔNICO'],
  [/\bportoes?\s+automaticos?\b/gi, 'PORTÃO AUTOMÁTICO'],
  [/\bchapas?\s+galvanizadas?\b/gi, 'CHAPA GALVANIZADA'],
  [/\btelhas?\s+metalicas?\b/gi, 'TELHA METÁLICA'],
  [/\btelhas?\s+sanduiches?\b/gi, 'TELHA SANDUÍCHE'],
  [/\btelhas?\s+de\s+fibrocimento\b/gi, 'TELHA DE FIBROCIMENTO'],
  [/\bmantas?\s+asfalticas?\b/gi, 'MANTA ASFÁLTICA'],
  [/\bargamassas?\s+polimericas?\b/gi, 'ARGAMASSA POLIMÉRICA'],
  [/\bpele\s+de\s+vidro\b/gi, 'PELE DE VIDRO'],
  [/\bglazing\b/gi, 'STRUCTURAL GLAZING'],
  [/\bmuros?\s+de\s+arrimo\b/gi, 'MURO DE ARRIMO'],
];

// Dictionary of Portuguese words without accents -> correct accented forms
// Key is lowercased unaccented word
const WORD_ACCENT_MAP: Record<string, string> = {
  // A
  abaco: 'ÁBACO',
  academico: 'ACADÊMICO',
  acrilica: 'ACRÍLICA',
  acrilico: 'ACRÍLICO',
  acrilicos: 'ACRÍLICOS',
  acrilicas: 'ACRÍLICAS',
  acustica: 'ACÚSTICA',
  acustico: 'ACÚSTICO',
  acusticos: 'ACÚSTICOS',
  acusticas: 'ACÚSTICAS',
  aerea: 'AÉREA',
  aereo: 'AÉREO',
  aereos: 'AÉREOS',
  aereas: 'AÉREAS',
  agua: 'ÁGUA',
  aguas: 'ÁGUAS',
  alvara: 'ALVARÁ',
  alvaras: 'ALVARÁS',
  aluminio: 'ALUMÍNIO',
  anaerobia: 'ANAERÓBIA',
  anaerobio: 'ANAERÓBIO',
  anaerobios: 'ANAERÓBIOS',
  angulo: 'ÂNGULO',
  angulos: 'ÂNGULOS',
  antipo: 'ANTIPÓ',
  apice: 'ÁPICE',
  area: 'ÁREA',
  areas: 'ÁREAS',
  asfaltica: 'ASFÁLTICA',
  asfaltico: 'ASFÁLTICO',
  asfalticos: 'ASFÁLTICOS',
  asfalticas: 'ASFÁLTICAS',
  atica: 'ÁTICA',
  atico: 'ÁTICO',
  atomico: 'ATÔMICO',
  automatica: 'AUTOMÁTICA',
  automatico: 'AUTOMÁTICO',
  automaticos: 'AUTOMÁTICOS',
  automaticas: 'AUTOMÁTICAS',
  autonomo: 'AUTÔNOMO',
  autonoma: 'AUTÔNOMA',
  autonomos: 'AUTÔNOMOS',
  autonomas: 'AUTÔNOMAS',
  
  // B
  balcao: 'BALCÃO',
  balcoes: 'BALCÕES',
  barbaca: 'BARBACÃ',
  barbacas: 'BARBACÃS',
  basica: 'BÁSICA',
  basico: 'BÁSICO',
  basicos: 'BÁSICOS',
  basicas: 'BÁSICAS',
  biometrica: 'BIOMÉTRICA',
  biometricas: 'BIOMÉTRICAS',
  biometrico: 'BIOMÉTRICO',
  biometricos: 'BIOMÉTRICOS',
  bocal: 'BOCAL',
  botoes: 'BOTÕES',
  botao: 'BOTÃO',

  // C
  caixa: 'CAIXA',
  camara: 'CÂMARA',
  camaras: 'CÂMARAS',
  camera: 'CÂMERA',
  cameras: 'CÂMERAS',
  ceramica: 'CERÂMICA',
  ceramico: 'CERÂMICO',
  ceramicos: 'CERÂMICOS',
  ceramicas: 'CERÂMICAS',
  chamine: 'CHAMINÉ',
  chamines: 'CHAMINÉS',
  climatizacao: 'CLIMATIZAÇÃO',
  codigo: 'CÓDIGO',
  codigos: 'CÓDIGOS',
  coifa: 'COIFA',
  combustivel: 'COMBUSTÍVEL',
  combustiveis: 'COMBUSTÍVEIS',
  comodo: 'CÔMODO',
  comodos: 'CÔMODOS',
  comunicacao: 'COMUNICAÇÃO',
  condominio: 'CONDOMÍNIO',
  condominios: 'CONDOMÍNIOS',
  conico: 'CÔNICO',
  construcao: 'CONSTRUÇÃO',
  contencao: 'CONTENÇÃO',
  coronario: 'CORONÁRIO',
  corrosao: 'CORROSÃO',
  corrimao: 'CORRIMÃO',
  corrimaos: 'CORRIMÃOS',
  corrimoes: 'CORRIMÃOS',
  cracha: 'CRACHÁ',
  critica: 'CRÍTICA',
  critico: 'CRÍTICO',
  criticos: 'CRÍTICOS',
  criticas: 'CRÍTICAS',

  // D
  dagua: "D'ÁGUA",
  demarcacao: 'DEMARCAÇÃO',
  deposito: 'DEPÓSITO',
  depositos: 'DEPÓSITOS',
  desobstrucao: 'DESOBSTRUÇÃO',
  diagnostica: 'DIAGNÓSTICA',
  diagnostico: 'DIAGNÓSTICO',
  dilatacao: 'DILATAÇÃO',
  disjuntor: 'DISJUNTOR',
  distribuicao: 'DISTRIBUIÇÃO',
  domestica: 'DOMÉSTICA',
  domestico: 'DOMÉSTICO',
  drenagem: 'DRENAGEM',
  duvida: 'DÚVIDA',

  // E
  edificacao: 'EDIFICAÇÃO',
  edificacoes: 'EDIFICAÇÕES',
  edificio: 'EDIFÍCIO',
  edificios: 'EDIFÍCIOS',
  eflorescencia: 'EFLORESCÊNCIA',
  eletrica: 'ELÉTRICA',
  eletrico: 'ELÉTRICO',
  eletricos: 'ELÉTRICOS',
  eletricas: 'ELÉTRICAS',
  eletroima: 'ELETROÍMÃ',
  eletroimas: 'ELETROÍMÃS',
  eletronica: 'ELETRÔNICA',
  eletronico: 'ELETRÔNICO',
  eletronicos: 'ELETRÔNICOS',
  eletronicas: 'ELETRÔNICAS',
  emergencia: 'EMERGÊNCIA',
  emergencias: 'EMERGÊNCIAS',
  eolico: 'EÓLICO',
  eolica: 'EÓLICA',
  epoxi: 'EPÓXI',
  esgoto: 'ESGOTO',
  espaco: 'ESPAÇO',
  espacos: 'ESPAÇOS',
  esquadria: 'ESQUADRIA',
  esquadrias: 'ESQUADRIAS',
  estacao: 'ESTAÇÃO',
  estacoes: 'ESTAÇÕES',
  estatica: 'ESTÁTICA',
  estatico: 'ESTÁTICO',
  estavel: 'ESTÁVEL',
  estaveis: 'ESTÁVEIS',
  estanqueidade: 'ESTANQUEIDADE',
  exaustao: 'EXAUSTÃO',
  extensao: 'EXTENSÃO',
  extintor: 'EXTINTOR',
  extintores: 'EXTINTORES',

  // F
  fachada: 'FACHADA',
  fachadas: 'FACHADAS',
  fibrocimento: 'FIBROCIMENTO',
  filtro: 'FILTRO',
  fissura: 'FISSURA',
  fissuras: 'FISSURAS',
  fixacao: 'FIXAÇÃO',
  fotoluminescente: 'FOTOLUMINESCENTE',
  fotoluminescentes: 'FOTOLUMINESCENTES',
  fotometrico: 'FOTOMÉTRICO',
  fumaca: 'FUMAÇA',

  // G
  gabiao: 'GABIÃO',
  gabioes: 'GABIÕES',
  galpao: 'GALPÃO',
  galpoes: 'GALPÕES',
  garagem: 'GARAGEM',
  garagens: 'GARAGENS',
  gas: 'GÁS',
  gases: 'GASES',
  gerador: 'GERADOR',
  geradores: 'GERADORES',
  gradil: 'GRADIL',
  gradis: 'GRADIS',
  grelha: 'GRELHA',
  grelhas: 'GRELHAS',

  // H
  hall: 'HALL',
  hermetica: 'HERMÉTICA',
  hermetico: 'HERMÉTICO',
  hidraulica: 'HIDRÁULICA',
  hidraulico: 'HIDRÁULICO',
  hidraulicos: 'HIDRÁULICOS',
  hidraulicas: 'HIDRÁULICAS',
  hidrante: 'HIDRANTE',
  hidrantes: 'HIDRANTES',
  hidrometro: 'HIDRÔMETRO',
  hidrometros: 'HIDRÔMETROS',
  hidrostatica: 'HIDROSTÁTICA',
  hidrostatico: 'HIDROSTÁTICO',

  // I
  ignicao: 'IGNIÇÃO',
  iluminacao: 'ILUMINAÇÃO',
  impermeabilizacao: 'IMPERMEABILIZAÇÃO',
  impermeavel: 'IMPERMEÁVEL',
  impermeaveis: 'IMPERMEÁVEIS',
  incendio: 'INCÊNDIO',
  incendios: 'INCÊNDIOS',
  indice: 'ÍNDICE',
  infiltracao: 'INFILTRAÇÃO',
  infiltracoes: 'INFILTRAÇÕES',
  inspecao: 'INSPEÇÃO',
  inspecoes: 'INSPEÇÕES',
  instalacao: 'INSTALAÇÃO',
  instalacoes: 'INSTALAÇÕES',
  interfonia: 'INTERFONIA',
  interfone: 'INTERFONE',
  interfones: 'INTERFONES',
  irrigacao: 'IRRIGAÇÃO',

  // J
  jardim: 'JARDIM',
  jardins: 'JARDINS',

  // L
  laboratorio: 'LABORATÓRIO',
  lampada: 'LÂMPADA',
  lampadas: 'LÂMPADAS',
  latex: 'LÁTEX',
  laudo: 'LAUDO',
  laudos: 'LAUDOS',
  ligacao: 'LIGAÇÃO',
  ligacoes: 'LIGAÇÕES',
  luminaria: 'LUMINÁRIA',
  luminarias: 'LUMINÁRIAS',

  // M
  macaneta: 'MAÇANETA',
  macanetas: 'MAÇANETAS',
  mancal: 'MANCAL',
  mangueira: 'MANGUEIRA',
  mangueiras: 'MANGUEIRAS',
  manometro: 'MANÔMETRO',
  manometros: 'MANÔMETROS',
  manutencao: 'MANUTENÇÃO',
  manutencoes: 'MANUTENÇÕES',
  maquina: 'MÁQUINA',
  maquinas: 'MÁQUINAS',
  marmore: 'MÁRMORE',
  marmores: 'MÁRMORES',
  mecanica: 'MECÂNICA',
  mecanico: 'MECÂNICO',
  mecanicos: 'MECÂNICOS',
  mecanicas: 'MECÂNICAS',
  medicao: 'MEDIÇÃO',
  medicoes: 'MEDIÇÕES',
  metalica: 'METÁLICA',
  metalico: 'METÁLICO',
  metalicos: 'METÁLICOS',
  metalicas: 'METÁLICAS',
  modulo: 'MÓDULO',
  modulos: 'MÓDULOS',

  // N
  nivel: 'NÍVEL',
  niveis: 'NÍVEIS',
  norma: 'NORMA',
  normas: 'NORMAS',
  numero: 'NÚMERO',
  numeros: 'NÚMEROS',

  // O
  obstrucao: 'OBSTRUÇÃO',
  obstrucoes: 'OBSTRUÇÕES',
  oleo: 'ÓLEO',
  oleos: 'ÓLEOS',
  optica: 'ÓPTICA',
  optico: 'ÓPTICO',
  oxigenio: 'OXIGÊNIO',
  oxidacao: 'OXIDAÇÃO',

  // P
  padrao: 'PADRÃO',
  padroes: 'PADRÕES',
  painel: 'PAINEL',
  paineis: 'PAINÉIS',
  pararraio: 'PARA-RAIOS',
  pararraios: 'PARA-RAIOS',
  periodica: 'PERIÓDICA',
  periodico: 'PERIÓDICO',
  periodicos: 'PERIÓDICOS',
  periodicas: 'PERIÓDICAS',
  piscina: 'PISCINA',
  piscinas: 'PISCINAS',
  pluvial: 'PLUVIAL',
  pluviais: 'PLUVIAIS',
  poco: 'POÇO',
  pocos: 'POÇOS',
  polimerica: 'POLIMÉRICA',
  polimerico: 'POLIMÉRICO',
  polimericos: 'POLIMÉRICOS',
  polimericas: 'POLIMÉRICAS',
  porcelanato: 'PORCELANATO',
  portao: 'PORTÃO',
  portoes: 'PORTÕES',
  potavel: 'POTÁVEL',
  potaveis: 'POTÁVEIS',
  precaucao: 'PRECAUÇÃO',
  predial: 'PREDIAL',
  prediais: 'PREDIAIS',
  presenca: 'PRESENÇA',
  pressao: 'PRESSÃO',
  pressoes: 'PRESSÕES',
  pressurizacao: 'PRESSURIZAÇÃO',
  prevencao: 'PREVENÇÃO',
  protecao: 'PROTEÇÃO',
  protecoes: 'PROTEÇÕES',
  provisoria: 'PROVISÓRIA',
  provisorio: 'PROVISÓRIO',

  // Q
  quadro: 'QUADRO',
  quadros: 'QUADROS',
  quimica: 'QUÍMICA',
  quimico: 'QUÍMICO',

  // R
  ralo: 'RALO',
  ralos: 'RALOS',
  rampa: 'RAMPA',
  rampas: 'RAMPAS',
  recalque: 'RECALQUE',
  reciclevel: 'RECICLÁVEL',
  reciclavel: 'RECICLÁVEL',
  reciclaveis: 'RECICLÁVEIS',
  refeitorio: 'REFEITÓRIO',
  registro: 'REGISTRO',
  registros: 'REGISTROS',
  relatorio: 'RELATÓRIO',
  relatorios: 'RELATÓRIOS',
  reservatorio: 'RESERVATÓRIO',
  reservatorios: 'RESERVATÓRIOS',
  resistencia: 'RESISTÊNCIA',
  retencao: 'RETENÇÃO',
  revestimento: 'REVESTIMENTO',
  revestimentos: 'REVESTIMENTOS',
  rodape: 'RODAPÉ',
  rodapes: 'RODAPÉS',
  roldana: 'ROLDANA',
  roldanas: 'ROLDANAS',
  ruido: 'RUÍDO',
  ruidos: 'RUÍDOS',

  // S
  sabao: 'SABÃO',
  saida: 'SAÍDA',
  saidas: 'SAÍDAS',
  salao: 'SALÃO',
  saloes: 'SALÕES',
  sanduiche: 'SANDUÍCHE',
  sanduiches: 'SANDUÍCHES',
  secao: 'SEÇÃO',
  secoes: 'SEÇÕES',
  seguranca: 'SEGURANÇA',
  sensor: 'SENSOR',
  sensores: 'SENSORES',
  septica: 'SÉPTICA',
  septico: 'SÉPTICO',
  servico: 'SERVIÇO',
  servicos: 'SERVIÇOS',
  sifao: 'SIFÃO',
  sifoes: 'SIFÕES',
  sifonado: 'SIFONADO',
  sifonados: 'SIFONADOS',
  sinalizacao: 'SINALIZAÇÃO',
  sistema: 'SISTEMA',
  sistemas: 'SISTEMAS',
  solucao: 'SOLUÇÃO',
  solucoes: 'SOLUÇÕES',
  subsolo: 'SUBSOLO',
  subsolos: 'SUBSOLOS',

  // T
  tanque: 'TANQUE',
  tanques: 'TANQUES',
  tatil: 'TÁTIL',
  tateis: 'TÁTEIS',
  tecnica: 'TÉCNICA',
  tecnico: 'TÉCNICO',
  tecnicos: 'TÉCNICOS',
  tecnicas: 'TÉCNICAS',
  termica: 'TÉRMICA',
  termico: 'TÉRMICO',
  termicos: 'TÉRMICOS',
  termicas: 'TÉRMICAS',
  termoacustica: 'TERMOACÚSTICA',
  termoacustico: 'TERMOACÚSTICO',
  termografia: 'TERMOGRAFIA',
  termometro: 'TERMÔMETRO',
  termometros: 'TERMÔMETROS',
  torre: 'TORRE',
  torres: 'TORRES',
  tracao: 'TRAÇÃO',
  transformador: 'TRANSFORMADOR',
  transformadores: 'TRANSFORMADORES',
  transito: 'TRÂNSITO',
  trinca: 'TRINCA',
  trincas: 'TRINCAS',
  tubulacao: 'TUBULAÇÃO',
  tubulacoes: 'TUBULAÇÕES',

  // U
  urgencia: 'URGÊNCIA',
  urgencias: 'URGÊNCIAS',
  util: 'ÚTIL',
  uteis: 'ÚTEIS',

  // V
  valvula: 'VÁLVULA',
  valvulas: 'VÁLVULAS',
  vazamento: 'VAZAMENTO',
  vazamentos: 'VAZAMENTOS',
  vedacao: 'VEDAÇÃO',
  vedacoes: 'VEDAÇÕES',
  veiculo: 'VEÍCULO',
  veiculos: 'VEÍCULOS',
  ventilacao: 'VENTILAÇÃO',
  vibracao: 'VIBRAÇÃO',
  vibracoes: 'VIBRAÇÕES',
  vidro: 'VIDRO',
  vidros: 'VIDROS',
  vistoria: 'VISTORIA',
  vistorias: 'VISTORIAS',
};

/**
 * Normalizes text, corrects spelling and terminology, and converts concept to UPPERCASE.
 */
export function formatAndCorrectItemConcept(rawText: string): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading bullet markers or numbers (e.g. "1. ", "01 - ", "- ", "* ")
  text = text.replace(/^(\d+[\.\-\)]\s*|[-*•]\s*)/, '').trim();

  // Apply multi-word phrase corrections first
  for (const [pattern, replacement] of PHRASE_CORRECTIONS) {
    text = text.replace(pattern, replacement);
  }

  // Split into tokens preserving punctuation and whitespace
  // Match words (\p{L}+) and non-word sequences
  const tokens = text.split(/([^\p{L}0-9_]+)/u);

  const correctedTokens = tokens.map((token) => {
    // If not a word, return as is
    if (!token || !/^[\p{L}0-9_]+$/u.test(token)) {
      return token;
    }

    // Keep numbers and alphanumeric codes (e.g. ABC, NBR16747, VRP01, 10KG) as UPPERCASE
    if (/\d/.test(token)) {
      return token.toUpperCase();
    }

    // Normalized lookup key (strip accents to match map)
    const normalizedKey = token
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // 1. Direct dictionary match
    if (WORD_ACCENT_MAP[normalizedKey]) {
      return WORD_ACCENT_MAP[normalizedKey];
    }

    // 2. Suffix heuristic rules
    if (normalizedKey.endsWith('cao') && normalizedKey.length > 4) {
      return (normalizedKey.slice(0, -3) + 'ção').toUpperCase();
    }
    if (normalizedKey.endsWith('coes') && normalizedKey.length > 5) {
      return (normalizedKey.slice(0, -4) + 'ções').toUpperCase();
    }
    if (normalizedKey.endsWith('sao') && normalizedKey.length > 4) {
      return (normalizedKey.slice(0, -3) + 'são').toUpperCase();
    }
    if (normalizedKey.endsWith('soes') && normalizedKey.length > 5) {
      return (normalizedKey.slice(0, -4) + 'sões').toUpperCase();
    }
    if (normalizedKey.endsWith('avel') && normalizedKey.length > 5) {
      return (normalizedKey.slice(0, -4) + 'ável').toUpperCase();
    }
    if (normalizedKey.endsWith('aveis') && normalizedKey.length > 6) {
      return (normalizedKey.slice(0, -5) + 'áveis').toUpperCase();
    }
    if (normalizedKey.endsWith('ivel') && normalizedKey.length > 5) {
      return (normalizedKey.slice(0, -4) + 'ível').toUpperCase();
    }
    if (normalizedKey.endsWith('iveis') && normalizedKey.length > 6) {
      return (normalizedKey.slice(0, -5) + 'íveis').toUpperCase();
    }

    // Fallback: uppercase
    return token.toUpperCase();
  });

  let result = correctedTokens.join('');

  // Final cleanup of extra spaces or mismatched quotes
  result = result
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim()
    .toUpperCase();

  return result;
}

/**
 * Normalizes description text from column 3
 */
export function formatItemDescription(rawDescription: string): string {
  if (!rawDescription || !rawDescription.trim()) return '';

  return rawDescription
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["']|["']$/g, '')
    .trim()
    .toUpperCase();
}
