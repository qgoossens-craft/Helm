import { safeStorage } from 'electron'
import { db } from '../database/db'

const ENCRYPTED_KEY_PREFIX = 'encrypted:'

/**
 * Securely store an API key using Electron's safeStorage
 * Falls back to plain text if encryption is not available (e.g., Linux without keyring)
 */
export function setApiKey(key: string, value: string): void {
  if (safeStorage.isEncryptionAvailable()) {
    // Encrypt and store as base64
    const encrypted = safeStorage.encryptString(value)
    const base64 = encrypted.toString('base64')
    db.settings.set(key, ENCRYPTED_KEY_PREFIX + base64)
  } else {
    // Fallback to plain storage with warning
    console.warn('[Credentials] Encryption not available, storing API key in plain text')
    db.settings.set(key, value)
  }
}

/**
 * Retrieve a securely stored API key
 */
export function getApiKey(key: string): string | null {
  const value = db.settings.get(key)
  if (!value) return null

  // Check if value is encrypted
  if (value.startsWith(ENCRYPTED_KEY_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) {
      console.error('[Credentials] Cannot decrypt - encryption not available')
      return null
    }
    try {
      const base64 = value.slice(ENCRYPTED_KEY_PREFIX.length)
      const encrypted = Buffer.from(base64, 'base64')
      return safeStorage.decryptString(encrypted)
    } catch (error) {
      console.error('[Credentials] Failed to decrypt API key:', error)
      return null
    }
  }

  // Plain text (legacy or fallback)
  return value
}

/**
 * Delete an API key
 */
export function deleteApiKey(key: string): void {
  db.settings.set(key, '')
}

/**
 * Check if encryption is available on this system
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
