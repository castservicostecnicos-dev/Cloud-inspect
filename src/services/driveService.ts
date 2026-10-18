import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User } from 'firebase/auth';
import app from '../firebase';
import { CompanyGoogleDriveConfig } from '../types';

const auth = getAuth(app);

// Request Google Drive access for storing files & photos
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');

const TOKEN_KEY = 'cast_inspect_drive_token';
const EMAIL_KEY = 'cast_inspect_drive_email';

let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
let cachedDriveEmail: string | null = typeof window !== 'undefined' ? localStorage.getItem(EMAIL_KEY) : null;
let googleUser: User | null = null;

// Initialize Google Auth state listener
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (u: User | null) => {
    googleUser = u;
    if (u) {
      if (u.email) {
        cachedDriveEmail = u.email;
        localStorage.setItem(EMAIL_KEY, u.email);
      }
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(u, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onFailure) onFailure();
      }
    } else {
      if (!cachedAccessToken && onFailure) {
        onFailure();
      }
    }
  });
};

export const getCachedGoogleToken = () => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem(TOKEN_KEY);
  }
  return cachedAccessToken;
};

export const setCachedGoogleToken = (token: string, email?: string) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) {
      cachedDriveEmail = email;
      localStorage.setItem(EMAIL_KEY, email);
    }
  }
};

export const getGoogleUser = () => googleUser;
export const getDriveEmail = () => cachedDriveEmail || googleUser?.email || null;
export const isGoogleDriveConnected = () => !!getCachedGoogleToken();

/**
 * Configure company Google Drive integration via Admin/Gerente or Dev
 */
export const connectCompanyGoogleDrive = async (
  companyId: string,
  user: { id: string; name: string }
): Promise<{ success: boolean; config: CompanyGoogleDriveConfig }> => {
  const { user: gUser, accessToken } = await signInWithGoogleDrive();
  const email = gUser.email || '';

  // 1. Create or find root folder for the company
  let rootFolderId: string | undefined;
  try {
    rootFolderId = await findOrCreateFolder('CAST Inspect — Vistorias');
  } catch (err) {
    console.warn('Erro ao criar pasta raiz no Drive:', err);
  }

  const driveConfig: CompanyGoogleDriveConfig = {
    connected: true,
    email,
    rootFolderId,
    connectedAt: new Date().toISOString(),
    connectedByUserId: user.id,
    connectedByUserName: user.name,
    accessToken,
  };

  // Persist to company in backend
  const res = await fetch(`/api/companies/${companyId}/drive-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(driveConfig),
  });

  if (!res.ok) {
    throw new Error('Falha ao salvar configuração do Google Drive na empresa.');
  }

  return { success: true, config: driveConfig };
};

/**
 * Disconnect company Google Drive integration
 */
export const disconnectCompanyGoogleDrive = async (companyId: string): Promise<boolean> => {
  await disconnectGoogleDrive();
  try {
    const res = await fetch(`/api/companies/${companyId}/drive-config`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
};

// Google Sign-In with popup to acquire Drive token
export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google Drive.');
    }
    cachedAccessToken = credential.accessToken;
    googleUser = result.user;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, credential.accessToken);
      if (result.user.email) {
        cachedDriveEmail = result.user.email;
        localStorage.setItem(EMAIL_KEY, result.user.email);
      }
    }
    return { user: result.user, accessToken: credential.accessToken };
  } finally {
    isSigningIn = false;
  }
};

export const disconnectGoogleDrive = async () => {
  cachedAccessToken = null;
  cachedDriveEmail = null;
  googleUser = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }
  try {
    await signOut(auth);
  } catch (e) {
    // ignore
  }
};

// Helper to find or create a folder in Google Drive
export const findOrCreateFolder = async (folderName: string, parentFolderId?: string): Promise<string> => {
  const token = getCachedGoogleToken();
  if (!token) {
    throw new Error('Não autenticado com o Google Drive');
  }

  let query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (searchRes.status === 401) {
    await disconnectGoogleDrive();
    throw new Error('Sessão do Google Drive expirada. Clique para conectar novamente.');
  }

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    if (createRes.status === 401) {
      await disconnectGoogleDrive();
      throw new Error('Sessão do Google Drive expirada. Clique para conectar novamente.');
    }
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Falha ao criar pasta no Google Drive');
  }

  const created = await createRes.json();
  return created.id;
};

function dataUrlToBlob(dataUrl: string): Blob {
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1] || '');
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.warn('Erro ao converter dataUrl para Blob em memória:', e);
    return new Blob([], { type: 'image/jpeg' });
  }
}

// Upload photo/file (Data URL or Blob) to Google Drive
export const uploadFileToDrive = async ({
  name,
  mimeType,
  dataUrl,
  blob,
  parentFolderId,
}: {
  name: string;
  mimeType: string;
  dataUrl?: string;
  blob?: Blob;
  parentFolderId?: string;
}): Promise<{ id: string; webViewLink?: string }> => {
  const token = getCachedGoogleToken();
  if (!token) {
    throw new Error('Google Drive não conectado.');
  }

  let fileBlob: Blob;
  if (blob) {
    fileBlob = blob;
  } else if (dataUrl) {
    if (dataUrl.startsWith('data:')) {
      fileBlob = dataUrlToBlob(dataUrl);
    } else {
      const response = await fetch(dataUrl);
      fileBlob = await response.blob();
    }
  } else {
    throw new Error('Nenhum dado fornecido para upload no Google Drive.');
  }

  const metadata: any = {
    name,
    mimeType,
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', fileBlob);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    if (uploadRes.status === 401) {
      await disconnectGoogleDrive();
      throw new Error('Sessão do Google Drive expirada. Clique no botão do Drive para renovar o acesso.');
    }
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Erro ao enviar arquivo para o Google Drive.');
  }

  return await uploadRes.json();
};
