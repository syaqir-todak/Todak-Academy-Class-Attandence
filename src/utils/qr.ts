const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789_-';
const DEVICE_STORAGE_KEY = 'campuspulse_device_id_v1';
const DEVICE_DB_NAME = 'campuspulse_device_store';
const DEVICE_STORE_NAME = 'meta';

export function generateSecureToken(length = 24): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

export function generateSessionId(classLab: string): string {
  const cleanLab =
    classLab
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 16) || 'session';
  const suffix = generateSecureToken(10).replace(/[^a-zA-Z0-9]/g, 'x');
  return `${cleanLab}_${suffix}`;
}

export function isDevPreviewOrigin(): boolean {
  return window.location.hostname.startsWith('ais-dev-');
}

const QR_BASE_ORIGIN_KEY = 'todak_qr_base_origin_v1';

export function getDefaultCheckInOrigin(): string {
  const { protocol, host } = window.location;
  if (host.startsWith('ais-dev-')) {
    return `${protocol}//${host.replace(/^ais-dev-/, 'ais-pre-')}`;
  }
  return window.location.origin;
}

export function getStoredQrBaseOrigin(): string {
  try {
    const saved = window.localStorage.getItem(QR_BASE_ORIGIN_KEY)?.trim();
    if (saved) {
      new URL(saved);
      return saved;
    }
  } catch {
    // Fallback to default origin
  }
  return getDefaultCheckInOrigin();
}

export function setStoredQrBaseOrigin(origin: string): void {
  try {
    const trimmed = origin.trim();
    if (!trimmed) {
      window.localStorage.removeItem(QR_BASE_ORIGIN_KEY);
      return;
    }
    window.localStorage.setItem(QR_BASE_ORIGIN_KEY, trimmed);
  } catch {
    // Ignore localStorage error
  }
}

export function buildQrCheckInUrl(
  sessionId: string,
  token: string,
  baseOrigin?: string
): string {
  const targetOrigin = (baseOrigin || getStoredQrBaseOrigin()).trim();
  const url = new URL(targetOrigin);
  url.searchParams.set('session', sessionId);
  url.searchParams.set('token', token);
  return url.toString();
}

export function parseQrPayload(raw: string): { sessionId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed);
    const session = parsedUrl.searchParams.get('session')?.trim() || '';
    const token = parsedUrl.searchParams.get('token')?.trim() || '';
    if (isValidIdString(session) && isValidTokenString(token)) {
      return { sessionId: session, token };
    }
  } catch {
    // Fall through to compact token parsing
  }

  const parts = trimmed.split(':').map((s) => s.trim());
  if (parts.length === 2 && isValidIdString(parts[0]) && isValidTokenString(parts[1])) {
    return { sessionId: parts[0], token: parts[1] };
  }

  return null;
}

export function isValidIdString(value: string): boolean {
  return value.length >= 1 && value.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(value);
}

export function isValidTokenString(value: string): boolean {
  return value.length >= 12 && value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value);
}

function isValidDeviceId(value: string | null | undefined): value is string {
  return Boolean(
    value && value.length >= 16 && value.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

function readCookieDeviceId(): string | null {
  try {
    const pairs = document.cookie.split(';');
    for (const pair of pairs) {
      const [k, v] = pair.trim().split('=');
      if (k === DEVICE_STORAGE_KEY && v) {
        const decoded = decodeURIComponent(v);
        if (isValidDeviceId(decoded)) return decoded;
      }
    }
  } catch {
    // Ignore cookie read error
  }
  return null;
}

function writeCookieDeviceId(id: string): void {
  try {
    document.cookie = `${DEVICE_STORAGE_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Ignore cookie write error
  }
}

function readIndexedDbDeviceId(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = window.indexedDB.open(DEVICE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DEVICE_STORE_NAME)) {
          db.createObjectStore(DEVICE_STORE_NAME);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(DEVICE_STORE_NAME, 'readonly');
          const getReq = tx.objectStore(DEVICE_STORE_NAME).get(DEVICE_STORAGE_KEY);
          getReq.onsuccess = () => {
            const val = typeof getReq.result === 'string' ? getReq.result : null;
            db.close();
            resolve(isValidDeviceId(val) ? val : null);
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function writeIndexedDbDeviceId(id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) {
        resolve();
        return;
      }
      const req = window.indexedDB.open(DEVICE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DEVICE_STORE_NAME)) {
          db.createObjectStore(DEVICE_STORE_NAME);
        }
      };
      req.onsuccess = () => {
        try {
          const db = req.result;
          const tx = db.transaction(DEVICE_STORE_NAME, 'readwrite');
          tx.objectStore(DEVICE_STORE_NAME).put(id, DEVICE_STORAGE_KEY);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          resolve();
        }
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getOrCreatePersistentDeviceId(): Promise<string> {
  let lsId: string | null = null;
  try {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (isValidDeviceId(raw)) lsId = raw;
  } catch {
    // Ignore localStorage error
  }

  const idbId = await readIndexedDbDeviceId();
  const cookieId = readCookieDeviceId();

  const resolved = lsId || idbId || cookieId || `dev_${generateSecureToken(24)}`;

  try {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, resolved);
  } catch {
    // Ignore localStorage error
  }
  writeCookieDeviceId(resolved);
  await writeIndexedDbDeviceId(resolved);

  return resolved;
}

export function getTodayDateInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateInputValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function formatSessionDateLabel(dateStr?: string): string | null {
  if (!dateStr || !isValidDateInputValue(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
