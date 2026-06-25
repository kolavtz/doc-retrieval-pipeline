/**
 * Client-side Google Drive REST API utilities.
 * Handles OAuth2 file/folder queries, creation, and uploads.
 */

// Helper to extract Year and Month from invoice date string
export function parseDateHierarchy(dateStr: string): { year: string; month: string } {
  if (!dateStr) {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return { year: now.getFullYear().toString(), month: months[now.getMonth()] };
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return { year: d.getFullYear().toString(), month: months[d.getMonth()] };
    }
  } catch {}

  // Parse text date
  const lower = dateStr.toLowerCase();
  const monthsList = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  let foundMonth = new Date().getMonth();
  for (let m = 0; m < 12; m++) {
    if (lower.includes(monthsList[m]) || lower.includes(monthShorts[m])) {
      foundMonth = m;
      break;
    }
  }

  const yearMatch = dateStr.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return { year, month: months[foundMonth] };
}

/**
 * Searches for a folder by name, optionally filtered by parent ID.
 * Returns the folder ID if found, otherwise null.
 */
async function findFolder(token: string, name: string, parentId?: string): Promise<string | null> {
  let query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Drive API Folder Search Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.files?.[0]?.id || null;
}

/**
 * Creates a folder on Google Drive.
 */
async function createFolder(token: string, name: string, parentId?: string): Promise<string> {
  const metadata: Record<string, any> = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    throw new Error(`Google Drive API Folder Creation Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Ensures a folder exists under a parent. Returns ID of existing or new folder.
 */
export async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const existingId = await findFolder(token, name, parentId);
  if (existingId) return existingId;
  return createFolder(token, name, parentId);
}

/**
 * Uploads a text file (like our encrypted JSON package) to Google Drive inside a folder.
 */
export async function uploadFileToFolder(
  token: string,
  folderId: string,
  fileName: string,
  content: string
): Promise<string> {
  // We use the multipart upload protocol to send metadata + content in one request
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/octet-stream\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    }
  );

  if (!response.ok) {
    throw new Error(`Google Drive API File Upload Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

export interface SyncResult {
  fileId: string;
  trajectory: string[];
}

/**
 * Synchronizes an encrypted bill/document payload to Google Drive, ensuring structural sorted path:
 * AetherDoc_Partition -> Category -> Year -> Month -> Encrypted Package File
 */
export async function syncEncryptedFileToDrive(
  token: string,
  fileData: {
    name: string;
    encryptedContent: string;
    category: string;
    date: string;
  }
): Promise<SyncResult> {
  const trajectory: string[] = [];
  const { year, month } = parseDateHierarchy(fileData.date);

  // 1. Root Partition
  trajectory.push('Navigating Root Partition: "AetherDoc_Partition"');
  const rootId = await ensureFolder(token, 'AetherDoc_Partition');

  // 2. Category Folder
  trajectory.push(`Validating Category folder: "${fileData.category}"`);
  const catId = await ensureFolder(token, fileData.category, rootId);

  // 3. Year Folder
  trajectory.push(`Validating Chronological folder: "${year}"`);
  const yearId = await ensureFolder(token, year, catId);

  // 4. Month Folder
  trajectory.push(`Validating Calendar folder: "${month}"`);
  const monthId = await ensureFolder(token, month, yearId);

  // 5. Upload File
  trajectory.push(`Encrypting & uploading document: "${fileData.name}.enc"`);
  const fileId = await uploadFileToFolder(token, monthId, `${fileData.name}.enc`, fileData.encryptedContent);
  trajectory.push(`Upload secure! File registered on GDrive (ID: ${fileId})`);

  return { fileId, trajectory };
}
