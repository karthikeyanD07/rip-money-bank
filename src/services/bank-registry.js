import { fail } from '../domain/errors.js';

const BANK_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const normalizeIfsc = value => {
  if (typeof value !== 'string') fail('INVALID_IFSC', 'IFSC must be a string.');
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized)) {
    fail('INVALID_IFSC', 'IFSC must be 11 characters in the standard format.');
  }
  return normalized;
};

function validateBank(input) {
  if (!input || typeof input !== 'object') fail('INVALID_BANK_CONFIGURATION', 'Bank details are required.');
  const bankId = String(input.bankId || '').trim().toUpperCase();
  const bankName = String(input.bankName || '').trim();
  const ifsc = normalizeIfsc(input.ifsc);
  const status = input.status || 'INACTIVE';
  if (!/^[A-Z0-9]{2,12}$/.test(bankId)) fail('INVALID_BANK_ID', 'Bank ID must be 2-12 uppercase letters or digits.');
  if (!bankName) fail('INVALID_BANK_CONFIGURATION', 'Bank name is required.');
  if (!BANK_STATUSES.has(status)) fail('INVALID_BANK_STATUS', 'Bank status must be ACTIVE or INACTIVE.');
  const apiBaseUrl = input.apiBaseUrl ?? null;
  if (apiBaseUrl !== null) {
    let parsed;
    try { parsed = new URL(apiBaseUrl); } catch { fail('INVALID_BANK_URL', 'apiBaseUrl must be a valid HTTPS URL.'); }
    if (parsed.protocol !== 'https:') fail('INVALID_BANK_URL', 'Bank API base URL must use HTTPS.');
  }
  return {
    bankId, bankName, ifsc,
    address: input.address ?? null,
    apiBaseUrl,
    apiVersion: String(input.apiVersion || 'v1'),
    status
  };
}

/** Shared directory only. This service must receive sharedDb, never a private bank DB. */
export async function registerBank(sharedDb, input, { updatedBy = null } = {}) {
  const bank = validateBank(input);
  const bankRef = sharedDb.collection('banks').doc(bank.bankId);
  const ifscRef = sharedDb.collection('ifsc_registry').doc(bank.ifsc);
  const now = new Date();
  await sharedDb.runTransaction(async tx => {
    const [existingBank, existingIfsc] = await Promise.all([tx.get(bankRef), tx.get(ifscRef)]);
    if (existingIfsc.exists && existingIfsc.data().bankId !== bank.bankId) {
      fail('IFSC_ALREADY_REGISTERED', 'This IFSC is already mapped to another bank.');
    }
    if (existingBank.exists && existingBank.data().ifsc !== bank.ifsc) {
      fail('BANK_IFSC_CHANGE_REQUIRES_MIGRATION', 'Changing a registered bank IFSC requires an explicit directory migration.');
    }
    tx.set(bankRef, {
      ...bank,
      createdAt: existingBank.exists ? existingBank.data().createdAt : now,
      updatedAt: now,
      updatedBy
    });
    tx.set(ifscRef, {
      bankId: bank.bankId,
      createdAt: existingIfsc.exists ? existingIfsc.data().createdAt : now
    });
  });
  return { bankId: bank.bankId, ifsc: bank.ifsc, status: bank.status };
}

export async function resolveBankByIfsc(sharedDb, ifsc) {
  const normalized = normalizeIfsc(ifsc);
  const mapping = await sharedDb.collection('ifsc_registry').doc(normalized).get();
  if (!mapping.exists) fail('BANK_NOT_FOUND', 'No bank is registered for this IFSC.');
  const banks = sharedDb.collection('banks');
  let bankSnap = await banks.doc(mapping.data().bankId).get();
  if (!bankSnap.exists) {
    const matches = await banks.where('bankId', '==', mapping.data().bankId).limit(2).get();
    if (matches.size !== 1) fail('BANK_DIRECTORY_INCONSISTENT', 'IFSC mapping must resolve to exactly one bank record.');
    bankSnap = matches.docs[0];
  }
  const bank = bankSnap.data();
  if (bank.status !== 'ACTIVE') fail('BANK_INACTIVE', 'Destination bank is not active for transfers.');
  if (!bank.apiBaseUrl) fail('BANK_ENDPOINT_NOT_CONFIGURED', 'Destination bank has no API endpoint configured.');
  return { ...bank, bankId: bank.bankId || bankSnap.id, ifsc: normalized };
}

export async function seedBankDirectory(sharedDb, banks = []) {
  if (!Array.isArray(banks) || banks.length === 0) {
    return { count: 0, message: 'No real bank directory records supplied; refusing to invent bank metadata.' };
  }
  for (const bank of banks) await registerBank(sharedDb, bank, { updatedBy: 'SEED' });
  return { count: banks.length };
}



export { normalizeIfsc };
