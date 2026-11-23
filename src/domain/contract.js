import {randomBytes} from 'node:crypto';
import {fail} from './errors.js';

export const SHARED_STATUSES = Object.freeze(['PENDING','CREDITED','REJECTED']);
export const BANK_CODES = Object.freeze(Array.from({length:50},(_,i)=>`B${String(i+1).padStart(2,'0')}`));
export function createTransferId(bankCode, now=Date.now()) {
  if (!/^B(?:0[0-9]|[1-4][0-9]|50)$/.test(bankCode)) fail('INVALID_BANK_CODE','Bank code must be B01-B50.');
  return `${bankCode}-${Math.floor(now/1000)}-${randomBytes(6).toString('hex')}`;
}
export function validateNote(n) {
  const errors=[];
  if (!n || typeof n!=='object') return ['Note must be an object.'];
  if (typeof n.txnId!=='string' || !n.txnId) errors.push('Invalid txnId.');
  if (!/^B\d{2}$/.test(n.fromBank||'')) errors.push('Invalid fromBank.');
  if (!/^B\d{2}$/.test(n.toBank||'')) errors.push('Invalid toBank.');
  if (!Number.isSafeInteger(n.fromAccount) || n.fromAccount<=0) errors.push('Invalid fromAccount.');
  if (!Number.isSafeInteger(n.toAccount) || n.toAccount<=0) errors.push('Invalid toAccount.');
  if (typeof n.amount!=='number' || !Number.isFinite(n.amount) || n.amount<=0 || Math.round(n.amount*100)!==n.amount*100) errors.push('Invalid amount.');
  if (!SHARED_STATUSES.includes(n.status)) errors.push('Invalid status.');
  if (typeof n.reason!=='string') errors.push('Invalid reason.');
  if (typeof n.settled!=='boolean') errors.push('Invalid settled.');
  return errors;
}
export function assertValidNote(n) { const e=validateNote(n); if(e.length) fail('INVALID_SHARED_NOTE',e.join(' '),{errors:e}); }
export function routeBankFromIfsc(ifsc) {
  if (typeof ifsc!=='string' || ifsc.trim().length<3) fail('INVALID_IFSC','A valid IFSC is required.');
  return ifsc.trim().slice(0,3).toUpperCase();
}
