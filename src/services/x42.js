import {COLLECTIONS, assertMinor, availableBalance} from '../domain/schema.js';
import {createHash} from 'node:crypto';
const err=(code,message)=>Object.assign(new Error(message),{code});
const hashKey=(s)=>createHash('sha256').update(String(s)).digest('hex');
const dateIST=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);

export function createX42Service({db, bankId}) {
  const accounts=db.collection(COLLECTIONS.accounts), transfers=db.collection(COLLECTIONS.transfers), ledger=db.collection(COLLECTIONS.ledgerEntries);
  const idempotency=db.collection(COLLECTIONS.idempotencyKeys), limits=db.collection(COLLECTIONS.transferLimits), usage=db.collection(COLLECTIONS.dailyUsage);
  async function balance(accountId, uid) {
    const s=await accounts.doc(accountId).get(); if(!s.exists) throw err('ACCOUNT_NOT_FOUND','Account not found.');
    const a=s.data(); if(uid && a.customerUid!==uid) throw err('FORBIDDEN','Account does not belong to this user.');
    return {accountId, currency:a.currency||'INR', postedBalanceMinor:a.postedBalanceMinor, heldMinor:a.heldMinor, availableBalanceMinor:availableBalance(a)};
  }
  async function validate({accountId,uid,amountMinor,transferId}) {
    assertMinor(amountMinor); const aRef=accounts.doc(accountId); const a=await aRef.get();
    if(!a.exists) throw err('ACCOUNT_NOT_FOUND','Account not found.'); const d=a.data();
    if(uid && d.customerUid!==uid) throw err('FORBIDDEN','Account does not belong to this user.');
    if(d.status!=='ACTIVE') throw err('ACCOUNT_INACTIVE','Account is not ACTIVE.');
    if(amountMinor>availableBalance(d)) throw err('INSUFFICIENT_FUNDS','Insufficient available balance.');
    const l=await limits.doc(accountId).get(); if(l.exists){const rule=l.data();if(rule.perTransferMinor&&amountMinor>rule.perTransferMinor)throw err('TRANSFER_LIMIT_EXCEEDED','Per-transfer limit exceeded.');if(rule.dailyMinor){const usageSnap=await usage.doc(`${accountId}_${dateIST()}`).get(),used=usageSnap.exists?usageSnap.data().usedMinor:0;if(used+amountMinor>rule.dailyMinor)throw err('DAILY_LIMIT_EXCEEDED','Daily transfer limit exceeded.');}}
    return {valid:true,transferId,availableBalanceMinor:availableBalance(d)};
  }
  async function reserve({accountId,uid,transferId,idempotencyKey,amountMinor,destination,kind='INTERBANK'}) {
    assertMinor(amountMinor); if(!transferId||!idempotencyKey) throw err('IDEMPOTENCY_REQUIRED','transferId and idempotencyKey are required.');
    const reqHash=hashKey(JSON.stringify({accountId,amountMinor,destination,kind})); const idemRef=idempotency.doc(hashKey(`${uid}:${idempotencyKey}`));
    const aRef=accounts.doc(accountId), tRef=transfers.doc(transferId), lRef=limits.doc(accountId);
    const dateISTValue=dateIST(); const usageRef=usage.doc(`${accountId}_${dateISTValue}`);
    return db.runTransaction(async tx=>{
      const [aSnap,tSnap,iSnap,limitSnap,uSnap]=await Promise.all([tx.get(aRef),tx.get(tRef),tx.get(idemRef),tx.get(lRef),tx.get(usageRef)]);
      if(iSnap.exists){const i=iSnap.data(); if(i.requestHash!==reqHash) throw err('IDEMPOTENCY_CONFLICT','Idempotency key reused with different request.'); const prior=await tx.get(transfers.doc(i.transferId)); return {transferId:i.transferId,status:prior.exists?prior.data().status:'PENDING',duplicate:true};}
      if(tSnap.exists) throw err('TRANSFER_ID_EXISTS','Transfer ID already exists.'); if(!aSnap.exists) throw err('ACCOUNT_NOT_FOUND','Account not found.');
      const a=aSnap.data(); if(a.customerUid!==uid) throw err('FORBIDDEN','Account does not belong to this user.'); if(a.status!=='ACTIVE') throw err('ACCOUNT_INACTIVE','Account is not ACTIVE.');
      const available=availableBalance(a); if(amountMinor>available) throw err('INSUFFICIENT_FUNDS','Insufficient available balance.');
      const lim=limitSnap.exists?limitSnap.data():{}; if(lim.perTransferMinor && amountMinor>lim.perTransferMinor) throw err('TRANSFER_LIMIT_EXCEEDED','Per-transfer limit exceeded.');
      const used=uSnap.exists?uSnap.data().usedMinor:0; if(lim.dailyMinor && used+amountMinor>lim.dailyMinor) throw err('DAILY_LIMIT_EXCEEDED','Daily transfer limit exceeded.');
      const now=new Date();
      tx.update(aRef,{heldMinor:a.heldMinor+amountMinor,updatedAt:now});
      tx.create(tRef,{transferId,type:kind,sourceAccountId:accountId,fromAccountId:accountId,destination,destinationIfsc:destination?.ifsc||null,destinationAccountNumber:destination?.accountNumber||null,amountMinor,currency:'INR',status:'PENDING',requestedByUid:uid,idempotencyKey,createdAt:now,updatedAt:now,dateIST:dateISTValue});
      tx.create(idemRef,{requestHash:reqHash,transferId,uid,createdAt:now});
      tx.set(usageRef,{accountId,dateIST:dateISTValue,usedMinor:used+amountMinor,updatedAt:now},{merge:true});
      return {transferId,status:'PENDING',duplicate:false};
    });
  }
  async function debit({transferId,idempotencyKey}) {
    const tRef=transfers.doc(transferId);
    return db.runTransaction(async tx=>{
      const t=await tx.get(tRef); if(!t.exists) throw err('TRANSFER_NOT_FOUND','Transfer not found.'); const d=t.data();
      if(d.status==='COMPLETED') return {transferId,status:'COMPLETED',duplicate:true}; if(d.status!=='PENDING') throw err('INVALID_TRANSFER_STATE','Transfer is not pending.');
      if(d.idempotencyKey!==idempotencyKey) throw err('IDEMPOTENCY_CONFLICT','Idempotency key mismatch.');
      const aRef=accounts.doc(d.sourceAccountId), a=await tx.get(aRef); if(!a.exists) throw err('ACCOUNT_NOT_FOUND','Source account missing.');
      const account=a.data(); if(account.heldMinor<d.amountMinor || account.postedBalanceMinor<d.amountMinor) throw err('HOLD_MISSING','Reserved funds not available.');
      const now=new Date(); tx.update(aRef,{postedBalanceMinor:account.postedBalanceMinor-d.amountMinor,heldMinor:account.heldMinor-d.amountMinor,updatedAt:now});
      tx.update(tRef,{status:'COMPLETED',completedAt:now,updatedAt:now});
      tx.create(ledger.doc(`${transferId}_DEBIT`),{transferId,accountId:d.sourceAccountId,direction:'DEBIT',amountMinor:d.amountMinor,postedAt:now});
      return {transferId,status:'COMPLETED',duplicate:false};
    });
  }
  async function release({transferId,reason='Definitive rejection'}) {
    const tRef=transfers.doc(transferId);
    return db.runTransaction(async tx=>{
      const t=await tx.get(tRef); if(!t.exists) throw err('TRANSFER_NOT_FOUND','Transfer not found.'); const d=t.data();
      if(d.status==='REJECTED'||d.status==='FAILED') return {transferId,status:d.status,duplicate:true};
      if(d.status!=='PENDING') throw err('INVALID_TRANSFER_STATE','Only pending transfers can release a hold.');
      const aRef=accounts.doc(d.sourceAccountId), a=await tx.get(aRef); if(!a.exists) throw err('ACCOUNT_NOT_FOUND','Source account missing.');
      const x=a.data(); if(x.heldMinor<d.amountMinor) throw err('HOLD_MISSING','Reserved amount is not held.'); const usageRef=usage.doc(`${d.sourceAccountId}_${d.dateIST}`), usageSnap=await tx.get(usageRef); const now=new Date();
      tx.update(aRef,{heldMinor:x.heldMinor-d.amountMinor,updatedAt:now}); if(usageSnap.exists)tx.update(usageRef,{usedMinor:Math.max(0,usageSnap.data().usedMinor-d.amountMinor),updatedAt:now}); tx.update(tRef,{status:'REJECTED',reason,updatedAt:now});
      return {transferId,status:'REJECTED',duplicate:false};
    });
  }
  async function credit({transferId,sourceBankId,destinationAccountId,amountMinor,currency='INR',sourceRequestHash}) {
    assertMinor(amountMinor); if(currency!=='INR') throw err('UNSUPPORTED_CURRENCY','Only INR is supported.');
    const inboxRef=db.collection(COLLECTIONS.interbankInbox).doc(transferId), aRef=accounts.doc(destinationAccountId), ledgerRef=ledger.doc(`${transferId}_CREDIT`);
    return db.runTransaction(async tx=>{
      const [i,a,l]=await Promise.all([tx.get(inboxRef),tx.get(aRef),tx.get(ledgerRef)]);
      if(i.exists){const old=i.data(); if(old.sourceBankId!==sourceBankId||old.destinationAccountId!==destinationAccountId||old.amountMinor!==amountMinor||old.sourceRequestHash!==sourceRequestHash) throw err('DUPLICATE_CONFLICT','Transfer ID reused with different credit details.'); return {transferId,status:old.status,duplicate:true,definitive:old.status==='REJECTED'};}
      if(!a.exists) throw err('ACCOUNT_NOT_FOUND','Destination account not found.'); const account=a.data(); if(account.status!=='ACTIVE') throw err('ACCOUNT_INACTIVE','Destination account is not ACTIVE.');
      const now=new Date(); const next=account.postedBalanceMinor+amountMinor; if(!Number.isSafeInteger(next)) throw err('BALANCE_OVERFLOW','Balance exceeds safe integer range.');
      tx.update(aRef,{postedBalanceMinor:next,updatedAt:now}); tx.create(inboxRef,{sourceBankId,destinationAccountId,amountMinor,currency,status:'CREDITED',sourceRequestHash,creditedAt:now});
      tx.create(ledgerRef,{transferId,accountId:destinationAccountId,direction:'CREDIT',amountMinor,postedAt:now}); return {transferId,status:'CREDITED',duplicate:false};
    });
  }
  async function status(transferId) {const s=await transfers.doc(transferId).get(); if(!s.exists) throw err('TRANSFER_NOT_FOUND','Transfer not found.'); return {transferId,...s.data()};}
  return {balance,validate,reserve,debit,release,credit,status};
}
