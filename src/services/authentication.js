import {randomUUID,createHash} from 'node:crypto';
import {COLLECTIONS} from '../domain/schema.js';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export function createAuthenticationService({db,bankId,sessions,passwordHasher}) {
 const users=db.collection(COLLECTIONS.users),kyc=db.collection(COLLECTIONS.kycRequests);
 async function register({fullName,email,password}) {
  const normalized=String(email||'').trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(normalized))fail('INVALID_EMAIL','A valid email is required.');
  if(typeof fullName!=='string'||fullName.trim().length<2)fail('INVALID_NAME','Full name is required.'); if(typeof password!=='string'||password.length<12)fail('WEAK_PASSWORD','Password must contain at least 12 characters.');
  const passwordHash=await passwordHasher.hash(password),now=new Date(),uid=randomUUID(),requestRef=kyc.doc();
  const emailRef=db.collection('email_registry').doc(createHash('sha256').update(normalized).digest('hex'));
  await db.runTransaction(async tx=>{const existing=await tx.get(emailRef);if(existing.exists)fail('EMAIL_EXISTS','Email is already registered.');tx.create(emailRef,{uid,email:normalized,createdAt:now});tx.create(users.doc(uid),{uid,bankId,fullName:fullName.trim(),email:normalized,passwordHash,role:'CUSTOMER',status:'ACTIVE',createdAt:now});tx.create(requestRef,{uid,documentPaths:[],openingDepositMinor:100000,status:'PENDING',reviewedBy:null,createdAt:now});});
  return {uid,kycRequestId:requestRef.id,status:'PENDING'};
 }
 async function login({email,password}) {const normalized=String(email||'').trim().toLowerCase(),q=await users.where('email','==',normalized).limit(1).get();if(q.empty)fail('INVALID_CREDENTIALS','Email or password is incorrect.');const doc=q.docs[0],u=doc.data();if(u.status!=='ACTIVE')fail('USER_INACTIVE','User is not active.');const valid=await passwordHasher.verify(u.passwordHash,password);if(!valid)fail('INVALID_CREDENTIALS','Email or password is incorrect.');const session=await sessions.create(doc.id);return {uid:doc.id,role:u.role,bankId:u.bankId,...session};}
 async function me(context){return {uid:context.uid,role:context.role,bankId:context.bankId};}
 return {register,login,me};
}
