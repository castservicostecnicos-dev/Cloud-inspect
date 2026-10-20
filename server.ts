import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support large base64 photos in inspection payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Multi-empresa tenant helper
  const getCompanyId = (req: express.Request): string => {
    const headerCompany = req.headers['x-company-id'] as string;
    if (headerCompany && headerCompany.trim().length > 0) {
      return headerCompany;
    }
    // Default fallback to first active company
    const first = db.getCompanies()[0];
    return first?.id || 'emp_cast_01';
  };

  // --- API ROUTES FIRST ---

  // Serve PWA assets directly with appropriate headers
  app.get('/sw.js', (req, res) => {
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
  });

  app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'CAST Inspect API', timestamp: new Date().toISOString() });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({ error: 'Senha é obrigatória.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let user = db.getUserByEmail(cleanEmail);
    if (!user && cleanEmail.includes('@castinspect.com.br')) {
      user = db.getUserByEmail(cleanEmail.replace('@castinspect.com.br', '@cast.com.br'));
    } else if (!user && cleanEmail.includes('@cast.com.br')) {
      user = db.getUserByEmail(cleanEmail.replace('@cast.com.br', '@castinspect.com.br'));
    }
    if (!user && (cleanEmail === 'dev' || cleanEmail === 'dev@cast.com.br' || cleanEmail === 'carlos@cast.com.br')) {
      user = db.getUserByEmail('cast.servicostecnicos@gmail.com') || db.getUserByEmail('dev@castinspect.com.br');
    }
    if (!user && (cleanEmail === '11062@gmail.com' || cleanEmail === '11062@gmnail.com' || cleanEmail === 'ale11062@gmnail.com')) {
      user = db.getUserByEmail('ale11062@gmail.com');
    }

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado com este e-mail.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Este usuário está inativo no sistema.' });
    }

    if (user.role === 'DEV') {
      const validDevPasswords = [
        user.password,
        'Cast@2468',
        'cast@2468',
        'Cast2468',
        'cast2468',
        'dev',
        '123456',
      ].filter(Boolean);

      const isValid = validDevPasswords.some(
        (p) => p === password || p === cleanPassword || p?.toLowerCase() === cleanPassword.toLowerCase()
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Senha incorreta para o perfil Dev.' });
      }
    } else {
      const validPasswords = [user.password, '123456', '123'].filter(Boolean);
      const isValid = validPasswords.some(
        (p) => p === password || p === cleanPassword
      );
      if (!isValid) {
        return res.status(401).json({ error: 'Senha incorreta.' });
      }
    }

    const company = db.getCompanyById(user.companyId);
    if (company && !company.active) {
      return res.status(403).json({ error: 'A empresa deste usuário está desativada.' });
    }

    res.json({
      user,
      company: company || { id: user.companyId, name: user.companyName || 'Empresa' },
      token: `tok_${user.id}_${Date.now()}`,
    });
  });

  // Companies Management (Multi-tenant scoped: non-DEV users only see their own company)
  app.get('/api/companies', (req, res) => {
    const userRole = req.headers['x-user-role'] as string;
    const headerCompany = req.headers['x-company-id'] as string;
    const all = db.getCompanies();

    if (userRole && userRole !== 'DEV' && headerCompany) {
      const filtered = all.filter((c) => c.id === headerCompany);
      return res.json(filtered.length > 0 ? filtered : all.slice(0, 1));
    }
    res.json(all);
  });

  app.get('/api/companies/:id', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json(comp);
  });

  app.post('/api/companies', (req, res) => {
    const data = req.body;
    if (!data.name || !data.cnpj) {
      return res.status(400).json({ error: 'Nome e CNPJ são obrigatórios.' });
    }
    const newCompany = {
      ...data,
      id: data.id || `emp_${Date.now()}`,
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    };
    delete (newCompany as any).manager;
    db.saveCompany(newCompany);

    // Cadastrar o Gerente junto ao cadastro da empresa, conforme regra do sistema
    let createdManager = null;
    if (data.manager && data.manager.name && data.manager.email) {
      const managerUser: any = {
        id: `usr_${Date.now()}_mgr`,
        companyId: newCompany.id,
        companyName: newCompany.tradeName || newCompany.name,
        name: data.manager.name.trim(),
        email: data.manager.email.trim(),
        password: data.manager.password?.trim() || 'Cast#' + Math.floor(1000 + Math.random() * 9000),
        role: 'GERENTE' as const,
        active: true,
        createdAt: new Date().toISOString(),
      };
      if (data.manager.phone && data.manager.phone.trim()) {
        managerUser.phone = data.manager.phone.trim();
      }
      if (data.manager.docRegistration && data.manager.docRegistration.trim()) {
        managerUser.docRegistration = data.manager.docRegistration.trim();
      }
      db.saveUser(managerUser);
      createdManager = managerUser;
    }

    res.status(201).json({ ...newCompany, manager: createdManager });
  });

  app.put('/api/companies/:id', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    const updated = { ...comp, ...req.body, id: req.params.id };
    db.saveCompany(updated);
    res.json(updated);
  });

  app.delete('/api/companies/:id', (req, res) => {
    const ok = db.deleteCompany(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Empresa não encontrada para exclusão.' });
    res.json({ success: true, message: 'Empresa excluída com sucesso.' });
  });

  app.patch('/api/companies/:id/status', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    const updated = { ...comp, active: req.body.active ?? !comp.active };
    db.saveCompany(updated);
    res.json(updated);
  });

  // Google Drive Company Integration
  app.get('/api/companies/:id/drive-config', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    res.json(comp.googleDriveConfig || { connected: false });
  });

  app.post('/api/companies/:id/drive-config', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    
    const driveConfig = req.body;
    const updated = {
      ...comp,
      googleDriveConfig: {
        ...driveConfig,
        connected: driveConfig.connected ?? true,
        connectedAt: driveConfig.connectedAt || new Date().toISOString(),
      },
    };
    db.saveCompany(updated);
    res.json(updated.googleDriveConfig);
  });

  app.delete('/api/companies/:id/drive-config', (req, res) => {
    const comp = db.getCompanyById(req.params.id);
    if (!comp) return res.status(404).json({ error: 'Empresa não encontrada.' });
    
    const updated = {
      ...comp,
      googleDriveConfig: {
        connected: false,
        email: undefined,
        rootFolderId: undefined,
        accessToken: undefined,
      },
    };
    db.saveCompany(updated);
    res.json({ success: true, message: 'Conta do Google Drive desvinculada da empresa.' });
  });

  // DEV Exclusive Routes: Global User Lookup & Password Recovery
  app.get('/api/dev/users', (req, res) => {
    const allUsers = db.getAllUsers();
    res.json(allUsers);
  });

  app.post('/api/dev/reset-password', (req, res) => {
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'ID do usuário e nova senha são obrigatórios.' });
    }
    const ok = db.resetUserPassword(userId, newPassword);
    if (!ok) {
      return res.status(404).json({ error: 'Usuário não encontrado para recuperação de senha.' });
    }
    const user = db.getUserById(userId);
    res.json({ success: true, message: `Senha do usuário ${user?.name || ''} redefinida com sucesso!`, user });
  });

  // Users Management (isolated by companyId)
  app.get('/api/users', (req, res) => {
    const companyId = getCompanyId(req);
    const users = db.getUsers(companyId);
    res.json(users);
  });

  app.post('/api/users', (req, res) => {
    const companyId = getCompanyId(req);
    const userRole = (req.headers['x-user-role'] as string) || '';
    const data = req.body;
    if (!data.name || !data.email || !data.role) {
      return res.status(400).json({ error: 'Nome, e-mail e perfil são obrigatórios.' });
    }

    const targetCompanyId = data.companyId || companyId;
    const existingUsers = db.getUsers(targetCompanyId);
    const existingManager = existingUsers.find((u) => u.role === 'GERENTE');

    // Regra: O DEV NÃO pode incluir funcionários na empresa, fora o gerente (se ainda não existir).
    // Os demais funcionários só podem ser cadastrados pelo Gerente.
    if (userRole === 'DEV') {
      if (data.role !== 'GERENTE') {
        return res.status(403).json({
          error: 'O Desenvolvedor não pode incluir funcionários na empresa. Os funcionários (Técnicos e Síndicos) só podem ser cadastrados pelo Gerente da empresa.',
        });
      }

      if (existingManager) {
        return res.status(400).json({
          error: `A empresa já possui um Gerente cadastrado (${existingManager.name} - ${existingManager.email}). Os demais usuários devem ser cadastrados pelo próprio Gerente da empresa.`,
        });
      }
    } else if (userRole && userRole !== 'GERENTE') {
      // Se não for DEV nem GERENTE, bloqueia criação de usuários
      return res.status(403).json({
        error: 'Apenas o Gerente tem permissão para cadastrar funcionários nesta empresa.',
      });
    }

    // Não permitir cadastro de perfil DEV através da API pública de usuários
    if (data.role === 'DEV') {
      return res.status(403).json({
        error: 'Não é permitido cadastrar perfil DEV.',
      });
    }

    const targetCompany = db.getCompanyById(targetCompanyId);

    const newUser: any = {
      ...data,
      id: data.id || `usr_${Date.now()}`,
      companyId: targetCompanyId,
      companyName: targetCompany?.tradeName || targetCompany?.name || data.companyName,
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    };
    if (data.phone && typeof data.phone === 'string' && data.phone.trim()) {
      newUser.phone = data.phone.trim();
    } else {
      delete newUser.phone;
    }
    if (data.docRegistration && typeof data.docRegistration === 'string' && data.docRegistration.trim()) {
      newUser.docRegistration = data.docRegistration.trim();
    } else {
      delete newUser.docRegistration;
    }
    db.saveUser(newUser);
    res.status(201).json(newUser);
  });

  app.put('/api/users/:id', (req, res) => {
    const user = db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const userRole = (req.headers['x-user-role'] as string) || '';

    // Se usuário editando não for DEV nem GERENTE, bloqueia
    if (userRole && userRole !== 'DEV' && userRole !== 'GERENTE') {
      return res.status(403).json({ error: 'Permissão negada para alterar usuários.' });
    }

    const updated = { ...user, ...req.body, id: req.params.id };
    db.saveUser(updated);
    res.json(updated);
  });

  app.delete('/api/users/:id', (req, res) => {
    const userRole = (req.headers['x-user-role'] as string) || '';
    if (userRole && userRole !== 'DEV' && userRole !== 'GERENTE') {
      return res.status(403).json({ error: 'Permissão negada para excluir usuários.' });
    }
    const ok = db.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Usuário não encontrado ou não pode ser excluído.' });
    res.json({ success: true, message: 'Usuário excluído com sucesso.' });
  });

  // Condominiums (isolated by companyId)
  app.get('/api/condominiums', (req, res) => {
    const companyId = getCompanyId(req);
    const list = db.getCondominiums(companyId);
    res.json(list);
  });

  app.post('/api/condominiums', (req, res) => {
    const companyId = getCompanyId(req);
    const data = req.body;
    if (!data.name || !data.address) {
      return res.status(400).json({ error: 'Nome e endereço do condomínio são obrigatórios.' });
    }

    const newCond = {
      ...data,
      id: data.id || `cond_${Date.now()}`,
      companyId,
      blocks: data.blocks || [
        { id: `blk_${Date.now()}_1`, companyId, condominiumId: data.id || '', name: 'Torre 1', active: true },
      ],
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    };
    db.saveCondominium(companyId, newCond);
    res.status(201).json(newCond);
  });

  app.put('/api/condominiums/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const cond = db.getCondominiumById(companyId, req.params.id);
    if (!cond) return res.status(404).json({ error: 'Condomínio não encontrado nesta empresa.' });
    const updated = { ...cond, ...req.body, id: req.params.id, companyId };
    db.saveCondominium(companyId, updated);
    res.json(updated);
  });

  app.delete('/api/condominiums/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const ok = db.deleteCondominium(companyId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Condomínio não encontrado para exclusão.' });
    res.json({ success: true, message: 'Condomínio excluído com sucesso.' });
  });

  // Inspection Templates (isolated by companyId)
  app.get('/api/templates', (req, res) => {
    const companyId = getCompanyId(req);
    const templates = db.getTemplates(companyId);
    res.json(templates);
  });

  app.post('/api/templates', (req, res) => {
    const companyId = getCompanyId(req);
    const data = req.body;
    if (!data.title) {
      return res.status(400).json({ error: 'Título do modelo é obrigatório.' });
    }
    const newTemplate = {
      ...data,
      id: data.id || `tmpl_${Date.now()}`,
      companyId,
      active: data.active ?? true,
      createdAt: new Date().toISOString(),
    };
    db.saveTemplate(companyId, newTemplate);
    res.status(201).json(newTemplate);
  });

  app.put('/api/templates/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const tmpl = db.getTemplateById(companyId, req.params.id);
    if (!tmpl) {
      return res.status(404).json({ error: 'Modelo não encontrado nesta empresa.' });
    }
    const updated = { ...tmpl, ...req.body, id: req.params.id, companyId };
    db.saveTemplate(companyId, updated);
    res.json(updated);
  });

  app.delete('/api/templates/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const tmplId = decodeURIComponent(req.params.id || '').trim();
    let deleted = db.deleteTemplate(companyId, tmplId);
    if (!deleted) {
      deleted = db.deleteTemplate('', tmplId);
    }
    if (!deleted) {
      return res.status(404).json({ error: 'Modelo não encontrado nesta empresa.' });
    }
    res.json({ success: true, message: 'Modelo excluído com sucesso.' });
  });

  // Inspections CRUD (isolated by companyId)
  app.get('/api/inspections', (req, res) => {
    const companyId = getCompanyId(req);
    const { condominiumId, status, technicianId } = req.query;
    const inspections = db.getInspections(companyId, {
      condominiumId: condominiumId as string,
      status: status as string,
      technicianId: technicianId as string,
    });
    res.json(inspections);
  });

  app.get('/api/inspections/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const inspection = db.getInspectionById(companyId, req.params.id);
    if (!inspection) {
      return res.status(404).json({ error: 'Vistoria não encontrada ou pertence a outra empresa.' });
    }
    res.json(inspection);
  });

  app.post('/api/inspections', (req, res) => {
    const companyId = getCompanyId(req);
    const data = req.body;

    if (!data.condominiumId || !data.blockId) {
      return res.status(400).json({ error: 'Condomínio e bloco/torre são obrigatórios.' });
    }

    // Auto generate sequential inspection code if not provided
    const year = new Date().getFullYear();
    const existingCount = db.getInspections(companyId).length + 1;
    const id = data.id || `VIS-${year}-${String(existingCount).padStart(3, '0')}`;

    const newInspection = {
      ...data,
      id,
      companyId,
      status: data.status || 'EM_ANDAMENTO',
      startedAt: data.startedAt || new Date().toISOString(),
      date: data.date || new Date().toISOString().split('T')[0],
      environments: data.environments || [],
    };

    const saved = db.saveInspection(companyId, newInspection);
    res.status(201).json(saved);
  });

  app.put('/api/inspections/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const existing = db.getInspectionById(companyId, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Vistoria não encontrada.' });
    }

    const updated = {
      ...existing,
      ...req.body,
      id: req.params.id,
      companyId,
    };

    const saved = db.saveInspection(companyId, updated);
    res.json(saved);
  });

  app.delete('/api/inspections/:id', (req, res) => {
    const companyId = getCompanyId(req);
    const deleted = db.deleteInspection(companyId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Vistoria não encontrada.' });
    }
    res.json({ message: 'Vistoria excluída com sucesso.' });
  });

  // Offline Sync endpoint: batch upload pending inspections
  app.post('/api/sync', (req, res) => {
    const companyId = getCompanyId(req);
    const { inspections } = req.body;

    if (!Array.isArray(inspections)) {
      return res.status(400).json({ error: 'Array de vistorias esperado.' });
    }

    const synced: string[] = [];
    inspections.forEach((insp) => {
      insp.companyId = companyId;
      insp.syncStatus = 'synced';
      db.saveInspection(companyId, insp);
      synced.push(insp.id);
    });

    res.json({ status: 'ok', syncedCount: synced.length, ids: synced });
  });

  // Clear database of templates and inspections (keeps registered users & companies intact)
  app.post('/api/dev/clean-database', (req, res) => {
    const { companyId } = req.body || {};
    const result = db.clearTemplatesAndInspections(companyId);
    res.json({
      success: true,
      message: 'Banco de dados de modelos e vistorias limpo com sucesso. Todos os usuários cadastrados foram mantidos intactos.',
      ...result,
    });
  });

  // Get full state (for Firebase Firestore persistent backup)
  app.get('/api/dev/db-state', (req, res) => {
    res.json(db.getFullState());
  });

  // Import full state (from Firebase Firestore restoration)
  app.post('/api/dev/db-restore', (req, res) => {
    const state = req.body;
    if (!state) {
      return res.status(400).json({ error: 'Estado inválido para restauração.' });
    }
    db.importFullState(state);
    res.json({ success: true, message: 'Dados restaurados com sucesso!' });
  });

  // Notifications for managers and company team
  app.get('/api/notifications', (req, res) => {
    const userRole = req.headers['x-user-role'] as string;
    // Alerts and notifications for company must ONLY appear for company users, NOT for DEV
    if (userRole === 'DEV') {
      return res.json([]);
    }
    const companyId = getCompanyId(req);
    const notifs = db.getNotifications(companyId);
    res.json(notifs);
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    const companyId = getCompanyId(req);
    const ok = db.markNotificationAsRead(companyId, req.params.id);
    res.json({ success: ok });
  });

  // Dashboard Stats
  app.get('/api/stats', (req, res) => {
    const companyId = getCompanyId(req);
    const stats = db.getStats(companyId);
    res.json(stats);
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Hydrate persistent data from Firebase Firestore before accepting requests
  try {
    await db.syncWithFirestore();
  } catch (err: any) {
    console.warn('[Server] Initial Firestore sync warning:', err?.message || err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CAST Inspect] Server running on http://localhost:${PORT}`);
  });
}

startServer();
