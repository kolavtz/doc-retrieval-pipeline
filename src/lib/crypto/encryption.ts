/**
 * Browser-native Web Crypto API wrappers for client-side encryption.
 * Implements PBKDF2 for key derivation and AES-GCM 256-bit for symmetric encryption.
 */

// Helper to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer: any): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface EncryptedPackage {
  ciphertext: string;
  iv: string;
  salt: string;
}

/**
 * Derives a CryptoKey from a user passphrase and salt.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using a derived passphrase.
 */
export async function encryptText(plaintext: string, passphrase: string): Promise<EncryptedPackage> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(passphrase, salt);
  
  const enc = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt)
  };
}

/**
 * Decrypts an EncryptedPackage using the correct passphrase.
 */
export async function decryptText(pkg: EncryptedPackage, passphrase: string): Promise<string> {
  const salt = new Uint8Array(base64ToArrayBuffer(pkg.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(pkg.iv));
  const ciphertext = base64ToArrayBuffer(pkg.ciphertext);

  const key = await deriveKey(passphrase, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
