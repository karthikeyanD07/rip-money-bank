import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export function canonicalPeerMessage({bankId, timestamp, nonce, method, path, body}) {
  return [bankId, String(timestamp), nonce, method.toUpperCase(), path, JSON.stringify(body ?? {})].join('\n');
}
export function signPeerRequest(secret, fields) {
  return createHmac('sha256', secret).update(canonicalPeerMessage(fields)).digest('hex');
}
export function verifyPeerRequest({secret, bankId, timestamp, nonce, method, path, body, signature, now=Date.now(), maxSkewMs=5*60_000}) {
  if (!secret || !bankId || !nonce || !signature || !Number.isFinite(Number(timestamp))) return false;
  if (Math.abs(now - Number(timestamp)) > maxSkewMs) return false;
  const expected = Buffer.from(signPeerRequest(secret,{bankId,timestamp,nonce,method,path,body}), 'hex');
  let actual; try { actual = Buffer.from(signature, 'hex'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export const createNonce = () => randomUUID();
