import fs from 'fs';
import path from 'path';
import {
  Company,
  User,
  Condominium,
  InspectionTemplate,
  Inspection,
  SupervisorNotification,
  DashboardStats,
} from '../src/types';
import {
  saveDocumentToFirestore,
  deleteDocumentFromFirestore,
  loadCollectionFromFirestore,
} from './firestore.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cast_inspect_db.json');

interface DatabaseSchema {
  companies: Company[];
  users: User[];
  condominiums: Condominium[];
  templates: InspectionTemplate[];
  inspections: Inspection[];
  notifications: SupervisorNotification[];
}

// Sample initial seed data
function getInitialSeedData(): DatabaseSchema {
  const company1: Company = {
    id: 'emp_cast_01',
    name: 'CAST Inspeções & Engenharia Diagnóstica',
    tradeName: 'CAST Inspect',
    cnpj: '34.892.110/0001-45',
    email: 'contato@castinspect.com.br',
    phone: '(11) 3456-7890',
    address: 'Av. Paulista, 1500, Sala 1402',
    city: 'São Paulo',
    state: 'SP',
    active: true,
    createdAt: '2025-01-10T08:00:00.000Z',
  };

  const company2: Company = {
    id: 'emp_alpha_02',
    name: 'Alpha Engenharia e Perícias Técnicas',
    tradeName: 'Alpha Vistorias',
    cnpj: '18.234.901/0001-90',
    email: 'contato@alphavistorias.com.br',
    phone: '(21) 2234-5678',
    address: 'Av. Rio Branco, 240, 10º Andar',
    city: 'Rio de Janeiro',
    state: 'RJ',
    active: true,
    createdAt: '2025-02-15T10:00:00.000Z',
  };

  const users: User[] = [
    {
      id: 'usr_dev_cast',
      companyId: '',
      companyName: '',
      name: 'Dev Carlos (CAST)',
      email: 'cast.servicostecnicos@gmail.com',
      role: 'DEV',
      password: 'Cast@2468',
      active: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'usr_dev_ale',
      companyId: '',
      companyName: '',
      name: 'Carlos Alessandro',
      email: 'ale11062@gmail.com',
      role: 'DEV',
      password: 'Cast@2468',
      active: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'usr_dev_01',
      companyId: '',
      companyName: '',
      name: 'Equipe de Desenvolvimento',
      email: 'dev@castinspect.com.br',
      role: 'DEV',
      password: 'dev',
      active: true,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'usr_gerente_01',
      companyId: 'emp_cast_01',
      companyName: company1.name,
      name: 'Eng. Carlos Eduardo Castilho',
      email: 'gerente@cast.com.br',
      role: 'GERENTE',
      docRegistration: 'CREA-SP 5069213890/D',
      phone: '(11) 98765-4321',
      active: true,
      createdAt: '2025-01-10T08:00:00.000Z',
    },
    {
      id: 'usr_supervisor_01',
      companyId: 'emp_cast_01',
      companyName: company1.name,
      name: 'Engª. Mariana Souza Ramos',
      email: 'mariana@cast.com.br',
      role: 'GERENTE',
      docRegistration: 'CREA-SP 5078129910/D',
      phone: '(11) 97654-3210',
      active: true,
      createdAt: '2025-01-12T09:00:00.000Z',
    },
    {
      id: 'usr_tecnico_01',
      companyId: 'emp_cast_01',
      companyName: company1.name,
      name: 'Téc. Lucas Silva Ferreira',
      email: 'tecnico@cast.com.br',
      role: 'TECNICO',
      docRegistration: 'CFT-SP 209381920',
      phone: '(11) 96543-2109',
      active: true,
      createdAt: '2025-01-15T10:00:00.000Z',
    },
    {
      id: 'usr_adm_01',
      companyId: 'emp_cast_01',
      companyName: company1.name,
      name: 'Roberto Andrade (Síndico)',
      email: 'adm@cast.com.br',
      role: 'ADM_PREDIAL',
      phone: '(11) 95432-1098',
      active: true,
      createdAt: '2025-01-20T11:00:00.000Z',
    },
    // User from company 2 (to demonstrate isolation)
    {
      id: 'usr_alpha_01',
      companyId: 'emp_alpha_02',
      companyName: company2.name,
      name: 'Eng. Rodrigo Alencar',
      email: 'gerente@alpha.com.br',
      role: 'GERENTE',
      docRegistration: 'CREA-RJ 2019481230',
      phone: '(21) 99876-5432',
      active: true,
      createdAt: '2025-02-15T10:00:00.000Z',
    },
  ];

  const templateCast1: InspectionTemplate = {
    id: 'tmpl_completa_01',
    companyId: 'emp_cast_01',
    title: 'Vistoria Predial Periódica Completa',
    description: 'Inspeção predial técnica periódica contemplando barrilete, casa de máquinas, subsolo, fachada, áreas comuns e prevenção contra incêndio.',
    active: true,
    createdAt: '2025-01-10T10:00:00.000Z',
    environments: [
      {
        id: 'env_tmpl_01',
        name: 'Barrilete e Reservatórios Superiores',
        order: 1,
        items: [
          { id: 'it_tmpl_01', name: 'Estanqueidade e Ausência de Infiltrações', description: 'Verificar laje de fundo e paredes do reservatório superior', order: 1 },
          { id: 'it_tmpl_02', name: 'Boias, Registros e Válvulas de Retenção', description: 'Checar fechamento mecânico e vedação dos registros', order: 2 },
          { id: 'it_tmpl_03', name: 'Válvulas Redutoras de Pressão (VRP)', description: 'Verificar manômetros e regulagem de pressão estática', order: 3 },
          { id: 'it_tmpl_04', name: 'Pintura Impermeabilizante e Tampas de Inspeção', description: 'Vedação hermética e tela contra insetos no extravasor', order: 4 },
        ],
      },
      {
        id: 'env_tmpl_02',
        name: 'Casa de Máquinas dos Elevadores',
        order: 2,
        items: [
          { id: 'it_tmpl_05', name: 'Limpeza, Desobstrução e Acesso Seguro', description: 'Porta corta-fogo com mola e chave restrita', order: 1 },
          { id: 'it_tmpl_06', name: 'Cabos de Tração, Polias e Limitadores de Velocidade', description: 'Inspeção visual contra desgastes excessivos e lubrificação', order: 2 },
          { id: 'it_tmpl_07', name: 'Iluminação, Ventilação e Extintor CO2', description: 'Ventilação natural ou mecânica permanente e extintor válido', order: 3 },
          { id: 'it_tmpl_08', name: 'Quadros de Comando e Aterramento', description: 'Identificação dos disjuntores e ausência de aquecimento anormal', order: 4 },
        ],
      },
      {
        id: 'env_tmpl_03',
        name: 'Subsolo, Garagens e Bombas de Recalque',
        order: 3,
        items: [
          { id: 'it_tmpl_09', name: 'Bombas de Recalque de Águas Pluviais e Esgoto', description: 'Painel de comando automático/manual e alternância de bombas', order: 1 },
          { id: 'it_tmpl_10', name: 'Elementos Estruturais (Pilares, Vigas e Lajes)', description: 'Ausência de fissuras ativas, armadura exposta ou corrosão', order: 2 },
          { id: 'it_tmpl_11', name: 'Iluminação de Emergência e Sinalização', description: 'Blocos autônomos com autonomia testada e rota de fuga', order: 3 },
          { id: 'it_tmpl_12', name: 'Tubulações Hidráulicas e Ralos de Escoamento', description: 'Grelhas desobstruídas e ausência de vazamentos suspensos', order: 4 },
        ],
      },
      {
        id: 'env_tmpl_04',
        name: 'Fachadas, Envelopamento e Esquadrias',
        order: 4,
        items: [
          { id: 'it_tmpl_13', name: 'Revestimento Cerâmico / Pastilhas / Argamassa', description: 'Teste de percussão/aderência e ausência de destacamento', order: 1 },
          { id: 'it_tmpl_14', name: 'Juntas de Dilatação e Selamento de Fachada', description: 'Flexibilidade e aderência do mastique de poliuretano', order: 2 },
          { id: 'it_tmpl_15', name: 'Guarda-Corpos, Parapeitos e Rufos Metálicos', description: 'Fixação firme e componentes metálicos sem oxidação', order: 3 },
        ],
      },
      {
        id: 'env_tmpl_05',
        name: 'Prevenção Contra Incêndio (AVCB / SPDA)',
        order: 5,
        items: [
          { id: 'it_tmpl_16', name: 'Extintores de Incêndio (Carga e Validade)', description: 'Pressurização na faixa verde e anel plástico do ano vigente', order: 1 },
          { id: 'it_tmpl_17', name: 'Abrigos de Hidrantes, Mangueiras e Esguichos', description: 'Mangueiras aduchadas e teste hidrostático anual em dia', order: 2 },
          { id: 'it_tmpl_18', name: 'Sinalização Fotoluminescente e Portas Corta-Fogo', description: 'Fechamento automático eficaz e desobstrução das escadas', order: 3 },
          { id: 'it_tmpl_19', name: 'SPDA - Para-raios e Malha de Aterramento', description: 'Descidas íntegras, conectores de medição e laudo ôhmico', order: 4 },
        ],
      },
    ],
  };

  const cond1: Condominium = {
    id: 'cond_jardins_01',
    companyId: 'emp_cast_01',
    name: 'Condomínio Residencial Jardins do Parque',
    cnpj: '12.345.678/0001-99',
    address: 'Rua das Palmeiras, 450',
    neighborhood: 'Vila Mariana',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '04010-000',
    syndicName: 'Roberto Andrade',
    syndicEmail: 'sindico.jardins@gmail.com',
    syndicPhone: '(11) 95432-1098',
    active: true,
    defaultTemplateId: templateCast1.id,
    createdAt: '2025-01-20T10:00:00.000Z',
    blocks: [
      { id: 'blk_jardins_a', companyId: 'emp_cast_01', condominiumId: 'cond_jardins_01', name: 'Torre A - Acácia', floorsCount: 18, active: true },
      { id: 'blk_jardins_b', companyId: 'emp_cast_01', condominiumId: 'cond_jardins_01', name: 'Torre B - Ipê Roxo', floorsCount: 18, active: true },
      { id: 'blk_jardins_c', companyId: 'emp_cast_01', condominiumId: 'cond_jardins_01', name: 'Área Comum / Garagens / Lazer', floorsCount: 3, active: true },
    ],
  };

  const cond2: Condominium = {
    id: 'cond_boulevard_02',
    companyId: 'emp_cast_01',
    name: 'Edifício Grand Boulevard Corporate',
    cnpj: '98.765.432/0001-11',
    address: 'Av. Faria Lima, 2800',
    neighborhood: 'Itaim Bibi',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '04538-132',
    syndicName: 'Fernanda Meirelles',
    syndicEmail: 'administracao@grandboulevard.com.br',
    syndicPhone: '(11) 94321-0987',
    active: true,
    defaultTemplateId: templateCast1.id,
    createdAt: '2025-02-01T14:00:00.000Z',
    blocks: [
      { id: 'blk_blvd_01', companyId: 'emp_cast_01', condominiumId: 'cond_boulevard_02', name: 'Torre Commercial Tower', floorsCount: 24, active: true },
      { id: 'blk_blvd_02', companyId: 'emp_cast_01', condominiumId: 'cond_boulevard_02', name: 'Centro de Convenções & Garagem', floorsCount: 4, active: true },
    ],
  };

  // Realistic vertical photos (in 3:4 ratio) with placeholder SVGs encoded as data URLs
  // This allows real inspection rendering and immediate PDF generation test!
  const createVerticalSamplePhoto = (label: string, color: string, badgeText: string) => {
    // 300x400 (3:4 ratio vertical image)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
      <rect width="300" height="400" fill="${color}"/>
      <rect x="15" y="15" width="270" height="370" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="6,4"/>
      <circle cx="150" cy="140" r="45" fill="#ffffff" fill-opacity="0.25"/>
      <circle cx="150" cy="140" r="30" fill="#ffffff" fill-opacity="0.4"/>
      <rect x="40" y="220" width="220" height="36" rx="6" fill="#0f172a" fill-opacity="0.8"/>
      <text x="150" y="244" fill="#ffffff" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle">${label}</text>
      <rect x="60" y="270" width="180" height="24" rx="4" fill="${badgeText.includes('MANUTENÇÃO') ? '#dc2626' : '#16a34a'}"/>
      <text x="150" y="287" fill="#ffffff" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle">${badgeText}</text>
      <text x="150" y="340" fill="#ffffff" fill-opacity="0.75" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">CAST INSPECT — FOTO VERTICAL</text>
      <text x="150" y="356" fill="#ffffff" fill-opacity="0.6" font-family="Arial, sans-serif" font-size="9" text-anchor="middle">PROPORÇÃO 3:4 VERTICAL</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  const samplePhoto1 = createVerticalSamplePhoto('Barrilete - VRP 01', '#1e3a8a', 'OK, EM DIA');
  const samplePhoto2 = createVerticalSamplePhoto('Barrilete - VRP 02', '#0369a1', 'OK, EM DIA');
  const samplePhoto3 = createVerticalSamplePhoto('Válvula com Vazamento', '#b91c1c', 'AGENDAR MANUTENÇÃO');
  const samplePhoto4 = createVerticalSamplePhoto('Manômetro Descalibrado', '#c2410c', 'AGENDAR MANUTENÇÃO');
  const samplePhoto5 = createVerticalSamplePhoto('Elevador - Polia Principal', '#15803d', 'OK, EM DIA');
  const samplePhoto6 = createVerticalSamplePhoto('Quadro de Comando', '#334155', 'OK, EM DIA');

  // Realistic Completed Inspection VIS-2026-001
  const inspection1: Inspection = {
    id: 'VIS-2026-001',
    companyId: 'emp_cast_01',
    companyName: company1.name,
    condominiumId: cond1.id,
    condominiumName: cond1.name,
    condominiumAddress: `${cond1.address}, ${cond1.neighborhood} - ${cond1.city}/${cond1.state}`,
    blockId: cond1.blocks[0].id,
    blockName: cond1.blocks[0].name,
    templateId: templateCast1.id,
    templateName: templateCast1.title,
    inspectorId: users[2].id,
    inspectorName: users[2].name,
    inspectorRole: 'TECNICO',
    inspectorDoc: users[2].docRegistration,
    date: '2026-03-10',
    startedAt: '2026-03-10T09:15:00.000Z',
    completedAt: '2026-03-10T12:30:00.000Z',
    status: 'CONCLUIDA',
    geolocation: {
      latitude: -23.58742,
      longitude: -46.64319,
      accuracy: 8.5,
      address: 'Rua das Palmeiras, 450 - Vila Mariana, São Paulo - SP',
      timestamp: '2026-03-10T09:16:12.000Z',
    },
    criticalItemsCount: 2,
    supervisorNotified: true,
    supervisorNotifiedAt: '2026-03-10T12:31:00.000Z',
    generalNotes: 'Vistoria periódica semestral realizada no condomínio. Foram identificados pontos pontuais de atenção nas válvulas de alívio do barrilete e nos manômetros das bombas de recalque no subsolo, requerendo intervenção corretiva programada.',
    technicianName: 'Lucas Silva Ferreira',
    technicianSignature: createVerticalSamplePhoto('Assinatura Técnica', '#0f172a', 'ASSINADO DIGITALMENTE'),
    syndicName: 'Roberto Andrade',
    syndicSignature: createVerticalSamplePhoto('Assinatura Síndico', '#1e293b', 'CIÊNCIA SÍNDICO'),
    environments: [
      {
        id: 'env_exec_01',
        name: 'Barrilete e Reservatórios Superiores',
        order: 1,
        items: [
          {
            id: 'item_exec_01',
            name: 'Estanqueidade e Ausência de Infiltrações',
            order: 1,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Lajes e paredes externas do reservatório impermeabilizadas, sem sinais de umidade ou manchas de eflorescência.',
            photos: [
              { id: 'ph_01', url: samplePhoto1, caption: 'Laje superior seca', takenAt: '2026-03-10T09:30:00.000Z', isVertical: true },
              { id: 'ph_02', url: samplePhoto2, caption: 'Parede lateral reservatório', takenAt: '2026-03-10T09:32:00.000Z', isVertical: true },
            ],
          },
          {
            id: 'item_exec_02',
            name: 'Boias, Registros e Válvulas de Retenção',
            order: 2,
            status: 'AGENDAR MANUTENÇÃO',
            observations: 'Válvula gaveta de 2.1/2 polegadas da prumada 02 apresenta gotejamento constante pelo gaxeta. Necessária substituição do reparo com urgência.',
            photos: [
              { id: 'ph_03', url: samplePhoto3, caption: 'Válvula com vazamento na haste', takenAt: '2026-03-10T09:40:00.000Z', isVertical: true },
              { id: 'ph_04', url: samplePhoto4, caption: 'Acúmulo de água na canaleta', takenAt: '2026-03-10T09:42:00.000Z', isVertical: true },
              { id: 'ph_05', url: samplePhoto1, caption: 'Registro geral adjacente', takenAt: '2026-03-10T09:45:00.000Z', isVertical: true },
            ],
          },
          {
            id: 'item_exec_03',
            name: 'Válvulas Redutoras de Pressão (VRP)',
            order: 3,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Pressão a jusante aferida em 28 m.c.a., perfeitamente calibrada conforme projeto original.',
            photos: [
              { id: 'ph_06', url: samplePhoto2, caption: 'Manômetro de entrada e saída', takenAt: '2026-03-10T09:50:00.000Z', isVertical: true },
            ],
          },
        ],
      },
      {
        id: 'env_exec_02',
        name: 'Casa de Máquinas dos Elevadores',
        order: 2,
        items: [
          {
            id: 'item_exec_04',
            name: 'Limpeza, Desobstrução e Acesso Seguro',
            order: 1,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Ambiente higienizado, porta corta-fogo com fechamento operante e chave guardada na zeladoria.',
            photos: [
              { id: 'ph_07', url: samplePhoto6, caption: 'Acesso e porta corta-fogo', takenAt: '2026-03-10T10:10:00.000Z', isVertical: true },
            ],
          },
          {
            id: 'item_exec_05',
            name: 'Cabos de Tração, Polias e Limitadores de Velocidade',
            order: 2,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Cabos de aço sem fios partidos visíveis, lubrificação adequada realizada pela empresa conservadora credenciada.',
            photos: [
              { id: 'ph_08', url: samplePhoto5, caption: 'Polia de tração elevador social', takenAt: '2026-03-10T10:15:00.000Z', isVertical: true },
              { id: 'ph_09', url: samplePhoto1, caption: 'Limitador de velocidade', takenAt: '2026-03-10T10:18:00.000Z', isVertical: true },
            ],
          },
        ],
      },
      {
        id: 'env_exec_03',
        name: 'Subsolo, Garagens e Bombas de Recalque',
        order: 3,
        items: [
          {
            id: 'item_exec_06',
            name: 'Bombas de Recalque de Águas Pluviais e Esgoto',
            order: 1,
            status: 'AGENDAR MANUTENÇÃO',
            observations: 'Bomba pluvial secundária (reserva) não armou no modo automático durante simulação com boia de nível. Requer visita da empresa de bombas.',
            photos: [
              { id: 'ph_10', url: samplePhoto3, caption: 'Painel de comando subsolo', takenAt: '2026-03-10T11:00:00.000Z', isVertical: true },
            ],
          },
          {
            id: 'item_exec_07',
            name: 'Elementos Estruturais (Pilares, Vigas e Lajes)',
            order: 2,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Sem evidências de fissuração térmica grave ou recalque diferencial nos pilares inspecionados.',
            photos: [
              { id: 'ph_11', url: samplePhoto5, caption: 'Pilar P-14 subsolo 1', takenAt: '2026-03-10T11:20:00.000Z', isVertical: true },
            ],
          },
        ],
      },
    ],
  };

  // Ongoing Inspection VIS-2026-002
  const inspection2: Inspection = {
    id: 'VIS-2026-002',
    companyId: 'emp_cast_01',
    companyName: company1.name,
    condominiumId: cond2.id,
    condominiumName: cond2.name,
    condominiumAddress: `${cond2.address}, ${cond2.neighborhood} - ${cond2.city}/${cond2.state}`,
    blockId: cond2.blocks[0].id,
    blockName: cond2.blocks[0].name,
    templateId: templateCast1.id,
    templateName: templateCast1.title,
    inspectorId: users[2].id,
    inspectorName: users[2].name,
    inspectorRole: 'TECNICO',
    inspectorDoc: users[2].docRegistration,
    date: '2026-03-12',
    startedAt: '2026-03-12T14:00:00.000Z',
    status: 'EM_ANDAMENTO',
    geolocation: {
      latitude: -23.57891,
      longitude: -46.68923,
      accuracy: 5.2,
      address: 'Av. Faria Lima, 2800 - Itaim Bibi, São Paulo - SP',
      timestamp: '2026-03-12T14:01:45.000Z',
    },
    criticalItemsCount: 1,
    environments: [
      {
        id: 'env_exec_04',
        name: 'Barrilete e Reservatórios Superiores',
        order: 1,
        items: [
          {
            id: 'item_exec_08',
            name: 'Estanqueidade e Ausência de Infiltrações',
            order: 1,
            status: 'OK, MANUTENÇÃO EM DIA',
            observations: 'Nenhuma anomalia.',
            photos: [{ id: 'ph_12', url: samplePhoto1, caption: 'Barrilete Torre Comercial', takenAt: '2026-03-12T14:15:00.000Z', isVertical: true }],
          },
          {
            id: 'item_exec_09',
            name: 'Boias, Registros e Válvulas de Retenção',
            order: 2,
            status: 'AGENDAR MANUTENÇÃO',
            observations: 'Válvula de alívio com ruído excessivo de cavitação.',
            photos: [
              { id: 'ph_13', url: samplePhoto4, caption: 'Válvula cavitando', takenAt: '2026-03-12T14:20:00.000Z', isVertical: true },
            ],
          },
        ],
      },
    ],
  };

  const notifications: SupervisorNotification[] = [
    {
      id: 'notif_01',
      companyId: 'emp_cast_01',
      inspectionId: inspection1.id,
      condominiumName: inspection1.condominiumName,
      blockName: inspection1.blockName,
      criticalCount: 2,
      inspectorName: inspection1.inspectorName,
      createdAt: '2026-03-10T12:31:00.000Z',
      read: false,
      message: `Atenção: A vistoria ${inspection1.id} no condomínio ${inspection1.condominiumName} foi finalizada com 2 itens necessitando "AGENDAR MANUTENÇÃO".`,
    },
  ];

  return {
    companies: [company1, company2],
    users,
    condominiums: [],
    templates: [],
    inspections: [],
    notifications: [],
  };
}

class JsonDatabase {
  private data: DatabaseSchema;

  constructor() {
    this.ensureDirectory();
    this.data = this.load();
    this.ensureDevUsers();
  }

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  public ensureDevUsers(): void {
    if (!this.data.users) this.data.users = [];
    if (!this.data.companies) this.data.companies = [];
    if (!this.data.condominiums) this.data.condominiums = [];

    // Ensure Baseline Company 1: CAST Inspect
    let compCast = this.data.companies.find((c) => c.id === 'emp_cast_01');
    if (!compCast) {
      compCast = {
        id: 'emp_cast_01',
        name: 'CAST Inspeções & Engenharia Diagnóstica',
        tradeName: 'CAST Inspect',
        cnpj: '34.892.110/0001-45',
        email: 'contato@castinspect.com.br',
        phone: '(11) 3456-7890',
        address: 'Av. Paulista, 1500, Sala 1402',
        city: 'São Paulo',
        state: 'SP',
        active: true,
        createdAt: '2025-01-10T08:00:00.000Z',
      };
      this.data.companies.unshift(compCast);
    }

    // Ensure Baseline Company 2: Alpha Engenharia (for multi-tenant isolation testing)
    let compAlpha = this.data.companies.find((c) => c.id === 'emp_alpha_02');
    if (!compAlpha) {
      compAlpha = {
        id: 'emp_alpha_02',
        name: 'Alpha Engenharia & Diagnósticos Prediais',
        tradeName: 'Alpha Engenharia',
        cnpj: '19.283.475/0001-88',
        email: 'contato@alphaengenharia.com.br',
        phone: '(21) 2233-4455',
        address: 'Av. Rio Branco, 156, Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
        active: true,
        createdAt: '2025-02-01T08:00:00.000Z',
      };
      this.data.companies.push(compAlpha);
    }

    const targetDevEmail = 'cast.servicostecnicos@gmail.com';
    let devCast = this.data.users.find(
      (u) => (u.email || '').trim().toLowerCase() === targetDevEmail
    );

    if (devCast) {
      devCast.role = 'DEV';
      devCast.password = 'Cast@2468';
      devCast.active = true;
      devCast.companyId = '';
      devCast.companyName = '';
      if (!devCast.name || devCast.name.includes('Eng.')) {
        devCast.name = 'Dev Carlos (CAST)';
      }
    } else {
      devCast = {
        id: 'usr_dev_cast',
        companyId: '',
        companyName: '',
        name: 'Dev Carlos (CAST)',
        email: targetDevEmail,
        role: 'DEV',
        password: 'Cast@2468',
        active: true,
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      this.data.users.unshift(devCast);
    }

    // Ensure Dev Carlos Alessandro (ale11062@gmail.com / 11062@gmail.com)
    const devAle = this.data.users.find(
      (u) => {
        const em = (u.email || '').trim().toLowerCase();
        return em === 'ale11062@gmail.com' || em === '11062@gmail.com' || em === '11062@gmnail.com';
      }
    );
    if (devAle) {
      devAle.name = 'Carlos Alessandro';
      devAle.role = 'DEV';
      devAle.password = 'Cast@2468';
      devAle.active = true;
      devAle.companyId = '';
      devAle.companyName = '';
    }

    // Ensure Team Dev
    const devTeam = this.data.users.find(
      (u) => (u.email || '').trim().toLowerCase() === 'dev@castinspect.com.br'
    );
    if (devTeam) {
      devTeam.role = 'DEV';
      devTeam.password = 'dev';
      devTeam.active = true;
      devTeam.companyId = '';
      devTeam.companyName = '';
    }

    // Ensure Gerente Alpha
    let userAlpha = this.data.users.find((u) => u.id === 'usr_alpha_01' || u.email === 'gerente@alpha.com.br');
    if (userAlpha) {
      userAlpha.companyId = 'emp_alpha_02';
      userAlpha.companyName = 'Alpha Engenharia & Diagnósticos Prediais';
      userAlpha.role = 'GERENTE';
      userAlpha.password = userAlpha.password || '123456';
      userAlpha.active = true;
    } else {
      this.data.users.push({
        id: 'usr_alpha_01',
        companyId: 'emp_alpha_02',
        companyName: 'Alpha Engenharia & Diagnósticos Prediais',
        name: 'Eng. Rodrigo Alencar',
        email: 'gerente@alpha.com.br',
        role: 'GERENTE',
        docRegistration: 'CREA-RJ 2019481230',
        phone: '(21) 99876-5432',
        password: '123456',
        active: true,
        createdAt: '2025-02-15T10:00:00.000Z',
      });
    }

    // Ensure Técnico Alpha
    let tecAlpha = this.data.users.find((u) => u.email === 'tecnico@alpha.com.br');
    if (!tecAlpha) {
      this.data.users.push({
        id: 'usr_alpha_tec_01',
        companyId: 'emp_alpha_02',
        companyName: 'Alpha Engenharia & Diagnósticos Prediais',
        name: 'Téc. Bruno Albuquerque',
        email: 'tecnico@alpha.com.br',
        role: 'TECNICO',
        docRegistration: 'CFT-RJ 10928310',
        phone: '(21) 98877-6655',
        password: '123456',
        active: true,
        createdAt: '2025-02-20T10:00:00.000Z',
      });
    }

    // Ensure Condomínio Alpha
    const hasAlphaCondo = this.data.condominiums?.some((c) => c.companyId === 'emp_alpha_02');
    if (!hasAlphaCondo) {
      this.data.condominiums.push({
        id: 'cond_alpha_01',
        companyId: 'emp_alpha_02',
        name: 'Condomínio Edifício Horizon Tower',
        cnpj: '45.678.901/0001-23',
        address: 'Av. Atlântica, 1200',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        postalCode: '22070-000',
        syndicName: 'Marcos Vinícius Pires',
        syndicEmail: 'sindico.horizon@gmail.com',
        syndicPhone: '(21) 97766-5544',
        active: true,
        createdAt: '2025-02-18T10:00:00.000Z',
        blocks: [
          { id: 'blk_alpha_1', companyId: 'emp_alpha_02', condominiumId: 'cond_alpha_01', name: 'Torre Panorâmica', floorsCount: 22, active: true },
          { id: 'blk_alpha_2', companyId: 'emp_alpha_02', condominiumId: 'cond_alpha_01', name: 'Áreas de Lazer e Garagem', floorsCount: 3, active: true },
        ],
      });
    }

    // Fix legacy usr_adm_01 if it was previously set to cast.servicostecnicos@gmail.com
    const oldAdm = this.data.users.find((u) => u.id === 'usr_adm_01');
    if (oldAdm && (oldAdm.email || '').trim().toLowerCase() === targetDevEmail) {
      oldAdm.email = 'adm@cast.com.br';
      oldAdm.role = 'ADM_PREDIAL';
      oldAdm.name = 'Roberto Andrade (Síndico)';
    }

    this.save();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error reading database file, resetting to initial seed', e);
    }
    const seed = getInitialSeedData();
    this.save(seed);
    return seed;
  }

  private save(dataToSave?: DatabaseSchema) {
    try {
      const d = dataToSave || this.data;
      fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error persisting database file', e);
    }
  }

  // --- Firestore Cloud Synchronization ---
  async syncWithFirestore(): Promise<void> {
    try {
      console.log('[Firestore] Checking persistent collections in Firestore...');
      const [companies, users, condominiums, templates, inspections, notifications] = await Promise.all([
        loadCollectionFromFirestore<Company>('companies'),
        loadCollectionFromFirestore<User>('users'),
        loadCollectionFromFirestore<Condominium>('condominiums'),
        loadCollectionFromFirestore<InspectionTemplate>('templates'),
        loadCollectionFromFirestore<Inspection>('inspections'),
        loadCollectionFromFirestore<SupervisorNotification>('notifications'),
      ]);

      const totalDocs =
        companies.length +
        users.length +
        condominiums.length +
        templates.length +
        inspections.length;

      if (totalDocs > 0) {
        console.log(
          `[Firestore] Loaded live state from Firestore: ${companies.length} empresas, ${users.length} usuários, ${condominiums.length} condomínios, ${templates.length} modelos, ${inspections.length} vistorias.`
        );

        const mergeById = <T extends { id: string }>(localList: T[], remoteList: T[], collectionName: string): T[] => {
          const map = new Map<string, T>();
          for (const item of localList) {
            if (item && item.id) map.set(item.id, item);
          }
          for (const item of remoteList) {
            if (item && item.id) map.set(item.id, item);
          }
          // Push any local items that don't exist in remote Firestore yet
          for (const [id, item] of map.entries()) {
            if (!remoteList.some((r) => r && r.id === id)) {
              saveDocumentToFirestore(collectionName, id, item);
            }
          }
          return Array.from(map.values());
        };

        this.data.companies = mergeById(this.data.companies, companies, 'companies');
        this.data.users = mergeById(this.data.users, users, 'users');
        this.data.condominiums = mergeById(this.data.condominiums, condominiums, 'condominiums');
        this.data.templates = mergeById(this.data.templates, templates, 'templates');
        this.data.inspections = mergeById(this.data.inspections, inspections, 'inspections');
        this.data.notifications = mergeById(this.data.notifications, notifications, 'notifications');

        // Ensure dev users are always intact even after sync with cloud state
        this.ensureDevUsers();
        this.save();
      } else {
        console.log('[Firestore] Database is empty. Seeding initial records to cloud Firestore...');
        await this.pushAllToFirestore();
      }
    } catch (err: any) {
      console.warn('[Firestore] Sync error:', err.message);
    }
  }

  async pushAllToFirestore(): Promise<void> {
    try {
      for (const c of this.data.companies) await saveDocumentToFirestore('companies', c.id, c);
      for (const u of this.data.users) await saveDocumentToFirestore('users', u.id, u);
      for (const cd of this.data.condominiums) await saveDocumentToFirestore('condominiums', cd.id, cd);
      for (const t of this.data.templates) await saveDocumentToFirestore('templates', t.id, t);
      for (const i of this.data.inspections) await saveDocumentToFirestore('inspections', i.id, i);
      console.log('[Firestore] Successfully pushed all initial records to Firestore.');
    } catch (err: any) {
      console.warn('[Firestore] Push all error:', err.message);
    }
  }

  // --- Companies ---
  getCompanies(): Company[] {
    return this.data.companies;
  }

  getCompanyById(id: string): Company | undefined {
    return this.data.companies.find((c) => c.id === id);
  }

  saveCompany(company: Company): Company {
    const existingIdx = this.data.companies.findIndex((c) => c.id === company.id);
    if (existingIdx >= 0) {
      this.data.companies[existingIdx] = company;
    } else {
      this.data.companies.push(company);
    }
    this.save();
    saveDocumentToFirestore('companies', company.id, company);
    return company;
  }

  deleteCompany(id: string): boolean {
    const initialLen = this.data.companies.length;
    this.data.companies = this.data.companies.filter((c) => c.id !== id);
    if (this.data.companies.length < initialLen) {
      // Also clean up or flag related data if necessary
      this.save();
      deleteDocumentFromFirestore('companies', id);
      return true;
    }
    return false;
  }

  // --- Users ---
  getAllUsers(): User[] {
    return this.data.users;
  }

  getUsers(companyId?: string): User[] {
    if (companyId) {
      return this.data.users.filter((u) => u.companyId === companyId && u.role !== 'DEV');
    }
    return this.data.users.filter((u) => u.role !== 'DEV');
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    const clean = (email || '').trim().toLowerCase();
    if (clean === 'cast.servicostecnicos@gmail.com') {
      const existing = this.data.users.find(
        (u) => (u.email || '').trim().toLowerCase() === clean
      );
      if (!existing || existing.role !== 'DEV') {
        this.ensureDevUsers();
      }
    }
    return this.data.users.find((u) => (u.email || '').trim().toLowerCase() === clean);
  }

  saveUser(user: User): User {
    const existingIdx = this.data.users.findIndex((u) => u.id === user.id);
    if (existingIdx >= 0) {
      this.data.users[existingIdx] = user;
    } else {
      this.data.users.push(user);
    }
    this.save();
    saveDocumentToFirestore('users', user.id, user);
    return user;
  }

  resetUserPassword(userId: string, newPassword: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (user) {
      user.password = newPassword;
      this.save();
      saveDocumentToFirestore('users', user.id, user);
      return true;
    }
    return false;
  }

  deleteUser(id: string): boolean {
    const user = this.data.users.find((u) => u.id === id);
    if (!user || user.role === 'DEV') return false; // Perfil DEV nunca é deletado
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length < initialLen) {
      this.save();
      deleteDocumentFromFirestore('users', id);
      return true;
    }
    return false;
  }

  // --- Condominiums ---
  getCondominiums(companyId: string): Condominium[] {
    return this.data.condominiums.filter((c) => c.companyId === companyId);
  }

  getCondominiumById(companyId: string, id: string): Condominium | undefined {
    return this.data.condominiums.find((c) => c.companyId === companyId && c.id === id);
  }

  saveCondominium(companyId: string, cond: Condominium): Condominium {
    cond.companyId = companyId;
    const existingIdx = this.data.condominiums.findIndex((c) => c.companyId === companyId && c.id === cond.id);
    if (existingIdx >= 0) {
      this.data.condominiums[existingIdx] = cond;
    } else {
      this.data.condominiums.push(cond);
    }
    this.save();
    saveDocumentToFirestore('condominiums', cond.id, cond);
    return cond;
  }

  deleteCondominium(companyId: string, id: string): boolean {
    const initialLen = this.data.condominiums.length;
    this.data.condominiums = this.data.condominiums.filter(
      (c) => !(c.id === id && (!companyId || c.companyId === companyId))
    );
    if (this.data.condominiums.length < initialLen) {
      this.save();
      deleteDocumentFromFirestore('condominiums', id);
      return true;
    }
    return false;
  }

  // --- Templates ---
  getTemplates(companyId: string): InspectionTemplate[] {
    return this.data.templates.filter((t) => t.companyId === companyId);
  }

  getTemplateById(companyId: string, id: string): InspectionTemplate | undefined {
    return this.data.templates.find((t) => t.companyId === companyId && t.id === id);
  }

  saveTemplate(companyId: string, template: InspectionTemplate): InspectionTemplate {
    template.companyId = companyId;
    const existingIdx = this.data.templates.findIndex((t) => t.companyId === companyId && t.id === template.id);
    if (existingIdx >= 0) {
      this.data.templates[existingIdx] = template;
    } else {
      this.data.templates.push(template);
    }
    this.save();
    saveDocumentToFirestore('templates', template.id, template);
    return template;
  }

  deleteTemplate(companyId: string, id: string): boolean {
    const cleanId = String(id || '').trim();
    if (!cleanId) return false;

    const initialLen = this.data.templates.length;
    this.data.templates = this.data.templates.filter(
      (t) => !(String(t.id).trim() === cleanId && (!companyId || !t.companyId || t.companyId === companyId))
    );
    if (this.data.templates.length < initialLen) {
      this.save();
      deleteDocumentFromFirestore('templates', cleanId);
      return true;
    }

    const fallbackLen = this.data.templates.length;
    this.data.templates = this.data.templates.filter((t) => String(t.id).trim() !== cleanId);
    if (this.data.templates.length < fallbackLen) {
      this.save();
      deleteDocumentFromFirestore('templates', cleanId);
      return true;
    }
    return false;
  }

  // --- Inspections (Multi-empresa isolated) ---
  getInspections(companyId: string, filter?: { condominiumId?: string; status?: string; technicianId?: string }): Inspection[] {
    let list = this.data.inspections.filter((i) => i.companyId === companyId);

    if (filter?.condominiumId) {
      list = list.filter((i) => i.condominiumId === filter.condominiumId);
    }
    if (filter?.status) {
      list = list.filter((i) => i.status === filter.status);
    }
    if (filter?.technicianId) {
      list = list.filter((i) => i.inspectorId === filter.technicianId);
    }

    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }

  getInspectionById(companyId: string, id: string): Inspection | undefined {
    return this.data.inspections.find((i) => i.companyId === companyId && i.id === id);
  }

  saveInspection(companyId: string, inspection: Inspection): Inspection {
    inspection.companyId = companyId;

    // Count critical items
    let critical = 0;
    inspection.environments?.forEach((env) => {
      env.items?.forEach((item) => {
        if (item.status === 'AGENDAR MANUTENÇÃO') {
          critical++;
        }
      });
    });
    inspection.criticalItemsCount = critical;

    // Automatic Structure Versioning (Ambientes & Itens)
    if (!inspection.structureVersion || inspection.structureVersion <= 0) {
      const condoId = inspection.condominiumId;
      const condoInspections = this.data.inspections.filter(
        (i) => (i.condominiumId === condoId || !condoId) && i.id !== inspection.id
      );

      const getFp = (envs: any[]) => {
        if (!envs || envs.length === 0) return 'empty';
        return JSON.stringify(
          envs
            .map((e) => ({
              name: (e.name || '').trim().toLowerCase(),
              items: (e.items || [])
                .map((it: any) => ({
                  name: (it.name || '').trim().toLowerCase(),
                  description: (it.description || '').trim().toLowerCase(),
                }))
                .sort((a: any, b: any) => a.name.localeCompare(b.name)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      };

      const fpMap = new Map<string, number>();
      let maxVer = 0;
      for (const past of condoInspections) {
        const fp = getFp(past.environments || []);
        if (fp === 'empty') continue;
        if (!fpMap.has(fp)) {
          const v = past.structureVersion && past.structureVersion > 0 ? past.structureVersion : maxVer + 1;
          fpMap.set(fp, v);
          if (v > maxVer) maxVer = v;
        }
      }

      const currentFp = getFp(inspection.environments || []);
      if (fpMap.has(currentFp)) {
        inspection.structureVersion = fpMap.get(currentFp);
      } else {
        inspection.structureVersion = maxVer + 1;
      }
    }

    const existingIdx = this.data.inspections.findIndex((i) => i.companyId === companyId && i.id === inspection.id);
    if (existingIdx >= 0) {
      this.data.inspections[existingIdx] = inspection;
    } else {
      this.data.inspections.unshift(inspection);
    }

    // Auto-create notification for management/gerente if inspection completed with critical items
    if (inspection.status === 'CONCLUIDA' && critical > 0 && !inspection.supervisorNotified) {
      inspection.supervisorNotified = true;
      inspection.supervisorNotifiedAt = new Date().toISOString();

      const notif: SupervisorNotification = {
        id: `notif_${Date.now()}`,
        companyId,
        inspectionId: inspection.id,
        condominiumName: inspection.condominiumName,
        blockName: inspection.blockName,
        criticalCount: critical,
        inspectorName: inspection.inspectorName,
        createdAt: new Date().toISOString(),
        read: false,
        message: `Atenção: A vistoria ${inspection.id} no ${inspection.condominiumName} (${inspection.blockName}) foi finalizada com ${critical} item(ns) com "AGENDAR MANUTENÇÃO".`,
      };
      this.data.notifications.unshift(notif);
      saveDocumentToFirestore('notifications', notif.id, notif);
    }

    this.save();
    saveDocumentToFirestore('inspections', inspection.id, inspection);
    return inspection;
  }

  deleteInspection(companyId: string, id: string): boolean {
    const initialLen = this.data.inspections.length;
    this.data.inspections = this.data.inspections.filter((i) => !(i.companyId === companyId && i.id === id));
    if (this.data.inspections.length < initialLen) {
      this.save();
      deleteDocumentFromFirestore('inspections', id);
      return true;
    }
    return false;
  }

  // --- Notifications ---
  getNotifications(companyId: string): SupervisorNotification[] {
    return this.data.notifications.filter((n) => n.companyId === companyId);
  }

  markNotificationAsRead(companyId: string, id: string): boolean {
    const notif = this.data.notifications.find((n) => n.companyId === companyId && n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
      return true;
    }
    return false;
  }

  // Clear templates and inspections (leaving users and companies)
  clearTemplatesAndInspections(companyId?: string): { clearedTemplates: number; clearedInspections: number } {
    const prevTmplCount = this.data.templates.length;
    const prevInspCount = this.data.inspections.length;

    if (companyId) {
      this.data.templates = this.data.templates.filter((t) => t.companyId !== companyId);
      this.data.inspections = this.data.inspections.filter((i) => i.companyId !== companyId);
      this.data.notifications = this.data.notifications.filter((n) => n.companyId !== companyId);
    } else {
      this.data.templates = [];
      this.data.inspections = [];
      this.data.notifications = [];
    }

    this.save();
    return {
      clearedTemplates: prevTmplCount - this.data.templates.length,
      clearedInspections: prevInspCount - this.data.inspections.length,
    };
  }

  // Restore/Import state directly
  importFullState(state: Partial<DatabaseSchema>) {
    if (state.companies) this.data.companies = state.companies;
    if (state.users) this.data.users = state.users;
    if (state.condominiums) this.data.condominiums = state.condominiums;
    if (state.templates) this.data.templates = state.templates;
    if (state.inspections) this.data.inspections = state.inspections;
    if (state.notifications) this.data.notifications = state.notifications;
    this.save();
  }

  getFullState(): DatabaseSchema {
    return this.data;
  }

  // --- Dashboard Statistics ---
  getStats(companyId: string): DashboardStats {
    const companyInspections = this.data.inspections.filter((i) => i.companyId === companyId);
    const conds = this.data.condominiums.filter((c) => c.companyId === companyId);
    const techs = this.data.users.filter((u) => u.companyId === companyId && u.role === 'TECNICO');

    let completed = 0;
    let inProgress = 0;
    let criticalMaintenance = 0;
    const criticalItems: DashboardStats['criticalItems'] = [];

    const parseDateAlertInfo = (desc?: string, alertDate?: string, alertEnabled?: boolean) => {
      if (!alertEnabled) return { isAlert: false, daysRemaining: 0, isExpired: false, isExpiringSoon: false, dateStr: '' };
      const combined = `${alertDate || ''} ${desc || ''}`;
      let iso = '';
      const br = combined.match(/\b([0-3]?[0-9])[\/\-\.]([0-1]?[0-9])[\/\-\.]((?:20|19)\d{2})\b/);
      if (br) {
        iso = `${br[3]}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
      } else {
        const ism = combined.match(/\b((?:20|19)\d{2})[\/\-\.]([0-1]?[0-9])[\/\-\.]([0-3]?[0-9])\b/);
        if (ism) {
          iso = `${ism[1]}-${String(ism[2]).padStart(2, '0')}-${String(ism[3]).padStart(2, '0')}`;
        }
      }
      if (!iso) return { isAlert: false, daysRemaining: 0, isExpired: false, isExpiringSoon: false, dateStr: '' };

      const [y, m, d] = iso.split('-').map(Number);
      const target = new Date(y, m - 1, d, 23, 59, 59);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const isExp = days < 0;
      const isSoon = days >= 0 && days <= 30;

      return {
        isAlert: isExp || isSoon,
        daysRemaining: days,
        isExpired: isExp,
        isExpiringSoon: isSoon,
        dateStr: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`,
      };
    };

    companyInspections.forEach((insp) => {
      if (insp.status === 'CONCLUIDA') completed++;
      if (insp.status === 'EM_ANDAMENTO') inProgress++;

      insp.environments?.forEach((env) => {
        env.items?.forEach((item) => {
          const isMaintenanceStatus = item.status === 'AGENDAR MANUTENÇÃO';
          const alertInfo = parseDateAlertInfo(item.description, item.alertDate, item.alertEnabled);

          if (isMaintenanceStatus || alertInfo.isAlert) {
            criticalMaintenance++;
            criticalItems.push({
              inspectionId: insp.id,
              condominiumName: insp.condominiumName,
              blockName: insp.blockName,
              environmentName: env.name,
              itemName: item.name,
              description: item.description,
              observations: item.observations || (alertInfo.isAlert ? `Alerta de vencimento: ${alertInfo.dateStr}` : 'Manutenção agendada.'),
              date: insp.date,
              alertEnabled: item.alertEnabled,
              alertDate: item.alertDate || (alertInfo.dateStr || undefined),
              daysUntilDue: alertInfo.isAlert ? alertInfo.daysRemaining : undefined,
              isExpired: alertInfo.isExpired,
              isExpiringSoon: alertInfo.isExpiringSoon,
            });
          }
        });
      });
    });

    // Sort critical items by urgency: expired first (most negative days), then closest due date, then maintenance status
    criticalItems.sort((a, b) => {
      if (a.isExpired && !b.isExpired) return -1;
      if (!a.isExpired && b.isExpired) return 1;
      if (a.daysUntilDue !== undefined && b.daysUntilDue !== undefined) {
        return a.daysUntilDue - b.daysUntilDue;
      }
      if (a.daysUntilDue !== undefined) return -1;
      if (b.daysUntilDue !== undefined) return 1;
      return 0;
    });

    return {
      totalInspections: companyInspections.length,
      completedInspections: completed,
      inProgressInspections: inProgress,
      criticalMaintenanceCount: criticalMaintenance,
      totalCondominiums: conds.length,
      totalTechnicians: techs.length,
      recentInspections: companyInspections.slice(0, 6),
      criticalItems,
    };
  }
}

export const db = new JsonDatabase();
