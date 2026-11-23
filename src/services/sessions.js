import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {COLLECTIONS} from '../domain/schema.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export function createSessionService({db,ttlMs=8*60*60*1000}) {
  const sessions=db.collection(COLLECTIONS.sessions), users=db.collection(COLLECTIONS.users);
  async function create(uid) {
    const user=await users.doc(uid).get(); if(!user.exists||user.data().status!=='ACTIVE') fail('USER_INACTIVE','User is not active.');
    const token=randomBytes(32).toString('base64url'), csrf=randomBytes(24).toString('base64url'), sessionHash=sha(token), csrfHash=sha(csrf), expiresAt=new Date(Date.now()+ttlMs);
    await sessions.doc(sessionHash).create({uid,csrfHash,expiresAt,revokedAt:null,createdAt:new Date()});
    return {cookie:token,csrfToken:csrf,expiresAt};
  }
  async function resolve(token,csrfToken,{requireCsrf=true}={}) {
    if(!token) fail('UNAUTHENTICATED','Session required.'); const sessionHash=sha(token), ref=sessions.doc(sessionHash), snap=await ref.get();
    if(!snap.exists) fail('INVALID_SESSION','Session is invalid.'); const s=snap.data();
    if(s.revokedAt||new Date(s.expiresAt.toDate?.()??s.expiresAt).getTime()<=Date.now()) fail('SESSION_EXPIRED','Session expired or revoked.');
    if(requireCsrf){if(!csrfToken) fail('CSRF_REQUIRED','CSRF token required.'); const got=Buffer.from(sha(csrfToken),'hex'), expected=Buffer.from(s.csrfHash,'hex'); if(got.length!==expected.length||!timingSafeEqual(got,expected)) fail('CSRF_INVALID','CSRF token is invalid.');}
    const u=await users.doc(s.uid).get(); if(!u.exists||u.data().status!=='ACTIVE') fail('USER_INACTIVE','User is not active.');
    const user=u.data(); return {uid:s.uid,role:user.role,bankId:user.bankId,user};
  }
  async function revoke(token){if(!token)return;const ref=sessions.doc(sha(token));const s=await ref.get();if(s.exists)await ref.update({revokedAt:new Date()});}
  return {create,resolve,revoke};
}
