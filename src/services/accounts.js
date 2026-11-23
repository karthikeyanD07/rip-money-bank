import {fail} from '../domain/errors.js';
import {writeAudit} from './audit.js';

const STATUSES=['PENDING','APPROVED','HOLD','REJECTED','CLOSED'];
export function createAccountService({db}) {
  async function listForCustomer(customerId,{limit=25,after}={}) {
    let q=db.collection('accounts').where('customerId','==',customerId).orderBy('createdAt','desc').limit(Math.min(Math.max(limit,1),100));
    if(after) q=q.startAfter(after);
    return q.get();
  }
  async function openAccount({customerId,accountType='SAVINGS'}) {
    if(!['SAVINGS','CURRENT','FIXED_DEPOSIT'].includes(accountType)) fail('INVALID_ACCOUNT_TYPE','Unsupported account type.');
    const ref=db.collection('accounts').doc(), now=new Date();
    const accountNumber=Number(`${Date.now().toString().slice(-7)}${Math.floor(Math.random()*90+10)}`);
    await ref.create({customerId,accountNumber,accountType,bankCode:process.env.BANK_CODE||'B07',status:'PENDING',balancePaise:0,transferLimitPaise:1000000,currency:'INR',createdAt:now,updatedAt:now});
    return {accountId:ref.id,accountNumber,status:'PENDING'};
  }
  async function closeAccount({accountId,customerId}) {
    const ref=db.collection('accounts').doc(accountId);
    await db.runTransaction(async tx=>{
      const s=await tx.get(ref); if(!s.exists || s.data().customerId!==customerId) fail('NOT_FOUND','Account not found.');
      if(s.data().balancePaise!==0) fail('NONZERO_BALANCE','Account can close only when balance is zero.');
      if(s.data().status==='CLOSED') return;
      tx.update(ref,{status:'CLOSED',closedAt:new Date(),updatedAt:new Date()});
    });
  }
  async function setStatus({accountId,status,adminUid,reason=''}) {
    if(!STATUSES.includes(status)) fail('INVALID_STATUS','Unsupported account status.');
    const ref=db.collection('accounts').doc(accountId);
    await db.runTransaction(async tx=>{
      const s=await tx.get(ref); if(!s.exists) fail('NOT_FOUND','Account not found.');
      if(s.data().status==='CLOSED') fail('ACCOUNT_CLOSED','Closed accounts cannot be changed.');
      tx.update(ref,{status,updatedAt:new Date(),statusReason:reason,reviewedBy:adminUid});
      tx.create(db.collection('account_status_history').doc(),{accountId,fromStatus:s.data().status,toStatus:status,reason,actorUid:adminUid,createdAt:new Date()});
    });
    await writeAudit(db,{actorUid:adminUid,action:`ACCOUNT_${status}`,targetType:'ACCOUNT',targetId:accountId,details:{reason}});
  }
  async function setTransferLimit({accountId,limitPaise,adminUid}) {
    if(!Number.isSafeInteger(limitPaise)||limitPaise<=0) fail('INVALID_LIMIT','Limit must be positive integer paise.');
    await db.collection('accounts').doc(accountId).update({transferLimitPaise:limitPaise,updatedAt:new Date()});
    await writeAudit(db,{actorUid:adminUid,action:'TRANSFER_LIMIT_CHANGED',targetType:'ACCOUNT',targetId:accountId,details:{limitPaise}});
  }
  return {listForCustomer,openAccount,closeAccount,setStatus,setTransferLimit};
}
