export type UserRole = 'DEV' | 'GERENTE' | 'TECNICO' | 'ADM_PREDIAL';

export type ItemStatus = 'OK, MANUTENÇÃO EM DIA' | 'AGENDAR MANUTENÇÃO';

export interface CompanyGoogleDriveConfig {
  connected: boolean;
  email?: string;
  rootFolderId?: string;
  connectedAt?: string;
  connectedByUserId?: string;
  connectedByUserName?: string;
  accessToken?: string;
}

export interface Company {
  id: string;
  name: string;
  tradeName?: string;
  cnpj: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  active: boolean;
  logoUrl?: string;
  createdAt: string;
  googleDriveConfig?: CompanyGoogleDriveConfig;
}

export interface User {
  id: string;
  companyId: string;
  companyName?: string;
  name: string;
  email: string;
  role: UserRole;
  docRegistration?: string; // CREA / CFT / CAU
  phone?: string;
  password?: string;
  active: boolean;
  createdAt: string;
}

export interface Block {
  id: string;
  companyId?: string;
  condominiumId?: string;
  name: string;
  floorsCount?: number;
  description?: string;
  active?: boolean;
}

export type CondominiumBlock = Block;

export interface Condominium {
  id: string;
  companyId: string;
  name: string;
  cnpj?: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode?: string;
  zipCode?: string;
  syndicName?: string;
  syndicEmail?: string;
  syndicPhone?: string;
  active: boolean;
  blocks: Block[];
  defaultTemplateId?: string;
  createdAt: string;
}

export interface TemplateItem {
  id: string;
  name: string;
  description?: string;
  order: number;
}

export interface TemplateEnvironment {
  id: string;
  name: string;
  tower?: string; // Torre / Bloco à qual o ambiente pertence (ex: 'TORRE 1', 'BLOCO A', 'ÁREA COMUM')
  order: number;
  items: TemplateItem[];
}

export interface InspectionTemplate {
  id: string;
  companyId: string;
  title: string;
  description: string;
  environments: TemplateEnvironment[];
  active: boolean;
  createdAt: string;
}

export interface InspectionPhoto {
  id: string;
  url: string; // Base64 data URI or image URL
  caption?: string;
  takenAt: string;
  isVertical: boolean;
  driveFileId?: string; // ID of file in Google Drive
  driveUrl?: string; // Public / Web link to file in Google Drive
}

export interface InspectionItem {
  id: string;
  templateItemId?: string;
  name: string;
  description?: string;
  order: number;
  status: ItemStatus | null;
  observations: string;
  photos: InspectionPhoto[];
  alertEnabled?: boolean; // Ticket de alerta de vencimento / manutenção
  alertDate?: string;     // Data de vencimento extraída da descrição ou definida (YYYY-MM-DD ou DD/MM/YYYY)
  urgencyLevel?: 'Crítica' | 'Alta' | 'Média' | 'Baixa'; // Grau de urgência da pendência
}

export interface InspectionEnvironment {
  id: string;
  templateEnvId?: string;
  name: string;
  tower?: string; // Torre / Bloco à qual o ambiente pertence
  order: number;
  items: InspectionItem[];
}

export interface InspectionGeolocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
}

export interface Inspection {
  id: string; // e.g. VIS-2026-001
  companyId: string;
  companyName: string;
  condominiumId: string;
  condominiumName: string;
  condominiumAddress?: string;
  blockId: string;
  blockName: string;
  templateId: string;
  templateName: string;
  inspectorId: string;
  inspectorName: string;
  inspectorRole: UserRole;
  inspectorDoc?: string;
  date: string; // YYYY-MM-DD
  startedAt: string;
  completedAt?: string;
  status: 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  geolocation?: InspectionGeolocation;
  environments: InspectionEnvironment[];
  technicianSignature?: string; // base64 PNG
  technicianName?: string;
  syndicSignature?: string; // base64 PNG
  syndicName?: string;
  supervisorNotified?: boolean;
  supervisorNotifiedAt?: string;
  criticalItemsCount?: number;
  generalNotes?: string;
  structureVersion?: number; // Versão dos ambientes e itens
  syncStatus?: 'synced' | 'pending_sync';
  drivePdfFileId?: string;
  drivePdfUrl?: string;
}

export interface SupervisorNotification {
  id: string;
  companyId: string;
  inspectionId: string;
  condominiumName: string;
  blockName: string;
  criticalCount: number;
  inspectorName: string;
  createdAt: string;
  read: boolean;
  message: string;
}

export interface DashboardStats {
  totalInspections: number;
  completedInspections: number;
  inProgressInspections: number;
  criticalMaintenanceCount: number;
  totalCondominiums: number;
  totalTechnicians: number;
  recentInspections: Inspection[];
  criticalItems: Array<{
    inspectionId: string;
    condominiumName: string;
    blockName: string;
    environmentName: string;
    itemName: string;
    description?: string;
    observations: string;
    date: string;
    alertEnabled?: boolean;
    alertDate?: string;
    daysUntilDue?: number;
    isExpired?: boolean;
    isExpiringSoon?: boolean;
  }>;
}
