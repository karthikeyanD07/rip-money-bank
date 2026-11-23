import {DomainError,fail} from '../domain/errors.js';
import {writeAudit} from './audit.js';

export function createAuthService({auth,db}) {
  async function register({email,password,fullName,phone,address}) {
    if (!email || !/^[^@\s]+@[^@\s]+\\.[^@\s]+$/.test(email)) fail('INVALID_EMAIL','Enter a valid email.');
    if (typeof password!=='string' || password.length<10) fail('WEAK_PASSWORD','Password must contain at least 10 characters.');
    if (!fullName?.trim() || !phone?.trim() || !address?.trim()) fail('MISSING_PROFILE','Name, phone and address are required.');
    let user;
    try { user=await auth.createUser({email:email.toLowerCase(),password,displayName:fullName.trim(),emailVerified:false}); }
    catch(e) { if(e.code==='auth/email-already-exists') fail('EMAIL_EXISTS','An account already uses this email.'); throw e; }
    const customerId=`C-${user.uid}`;
    const batch=db.batch(), now=new Date();
    batch.create(db.collection('customers').doc(customerId),{fullName:fullName.trim(),email:email.toLowerCase(),phone:phone.trim(),address:address.trim(),kycStatus:'PENDING',createdAt:now,updatedAt:now});
    batch.create(db.collection('users').doc(user.uid),{customerId,email:email.toLowerCase(),role:'CUSTOMER',isActive:true,createdAt:now});
    const accountRef=db.collection('accounts').doc();
    const accountNumber=Number(`${Date.now().toString().slice(-7)}${Math.floor(Math.random()*90+10)}`);
    batch.create(accountRef,{customerId,accountNumber,accountType:'SAVINGS',bankCode:process.env.BANK_CODE||'B07',status:'PENDING',balancePaise:100000,transferLimitPaise:1000000,currency:'INR',createdAt:now,updatedAt:now});
    batch.create(db.collection('ledger_entries').doc(`${accountRef.id}_OPENING`),{accountId:accountRef.id,direction:'CREDIT',amountPaise:100000,type:'OPENING_BALANCE',createdAt:now});
    batch.create(db.collection('kyc_records').doc(customerId),{customerId,status:'PENDING',documentStatus:'NOT_UPLOADED',createdAt:now});
    await batch.commit();
    await auth.setCustomUserClaims(user.uid,{role:'CUSTOMER'});
    return {uid:user.uid,customerId,accountId:accountRef.id,accountNumber,status:'PENDING'};
  }
  async function getUserContext(uid) {
    const snap=await db.collection('users').doc(uid).get();
    if(!snap.exists || snap.data().isActive!==true) throw new DomainError('UNAUTHORIZED','User is not active.');
    return {uid,...snap.data()};
  }
  async function provisionAdmin({email,password}) {
    if(!email || !password || password.length<14) fail('INVALID_ADMIN_CREDENTIALS','Admin email and a password of at least 14 characters are required.');
    let user;
    try { user=await auth.getUserByEmail(email); }
    catch(e) { if(e.code!=='auth/user-not-found') throw e; user=await auth.createUser({email,password,displayName:'Bank Administrator'}); }
    await auth.setCustomUserClaims(user.uid,{role:'ADMIN'});
    await db.collection('users').doc(user.uid).set({email:email.toLowerCase(),role:'ADMIN',isActive:true,createdAt:new Date()},{merge:true});
    await writeAudit(db,{actorUid:user.uid,action:'ADMIN_PROVISIONED',targetType:'USER',targetId:user.uid});
    return {uid:user.uid,email:user.email,role:'ADMIN'};
  }
  return {register,getUserContext,provisionAdmin};
}
