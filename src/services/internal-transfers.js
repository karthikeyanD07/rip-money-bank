import {createHash} from 'node:crypto';
import {COLLECTIONS,assertMinor,availableBalance} from '../domain/schema.js';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export function createInternalTransferService({db,bankId}) {
 const accounts=db.collection(COLLECTIONS.accounts),transfers=db.collection(COLLECTIONS.transfers),ledger=db.collection(COLLECTIONS.ledgerEntries),idem=db.collection(COLLECTIONS.idempotencyKeys),limits=db.collection(COLLECTIONS.transferLimits),usage=db.collection(COLLECTIONS.dailyUsage);
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const istDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
 async function transfer({uid,fromAccountId,toAccountNumber,amountMinor,idempotencyKey}) {
  assertMinor(amountMinor); if(!idempotencyKey)fail('IDEMPOTENCY_REQUIRED','Idempotency-Key is required.');
  const q=await accounts.where('accountNumber','==',String(toAccountNumber)).limit(2).get(); if(q.size!==1)fail('BENEFICIARY_NOT_FOUND','Destination account not found or ambiguous.');
  const toRef=q.docs[0].ref,fromRef=accounts.doc(fromAccountId),transferId=`${bankId}_IN_${hash(`${uid}:${idempotencyKey}`).slice(0,32)}`;
  const tRef=transfers.doc(transferId),keyRef=idem.doc(hash(`${uid}:${idempotencyKey}`)),date=istDate(),usageRef=usage.doc(`${fromAccountId}_${date}`),limitRef=limits.doc(fromAccountId);
  const requestHash=hash(JSON.stringify({fromAccountId,toAccountNumber:String(toAccountNumber),amountMinor}));
  return db.runTransaction(async tx=>{
   const [f,t,k,old,l,u]=await Promise.all([tx.get(fromRef),tx.get(toRef),tx.get(keyRef),tx.get(tRef),tx.get(limitRef),tx.get(usageRef)]);
   if(k.exists){if(k.data().requestHash!==requestHash)fail('IDEMPOTENCY_CONFLICT','Idempotency key reused with different request.');return {transferId:k.data().transferId,status:'COMPLETED',duplicate:true};}
   if(!f.exists||!t.exists)fail('ACCOUNT_NOT_FOUND','Account not found.'); const a=f.data(),b=t.data();
   if(a.customerUid!==uid)fail('FORBIDDEN','Source account does not belong to this user.'); if(a.status!=='ACTIVE'||b.status!=='ACTIVE')fail('ACCOUNT_INACTIVE','Both accounts must be ACTIVE.'); if(!a.currency||!b.currency||a.currency!==b.currency)fail('CURRENCY_MISMATCH','Source and destination accounts must use the same supported currency.'); if(a.currency!=='INR')fail('CURRENCY_MISMATCH','Only INR internal transfers are supported.');
   if(fromRef.id===toRef.id)fail('SAME_ACCOUNT','Source and destination must differ.'); if(availableBalance(a)<amountMinor)fail('INSUFFICIENT_FUNDS','Insufficient available balance.');
   const lim=l.exists?l.data():{},used=u.exists?u.data().usedMinor:0; if(lim.perTransferMinor&&amountMinor>lim.perTransferMinor)fail('TRANSFER_LIMIT_EXCEEDED','Per-transfer limit exceeded.'); if(lim.dailyMinor&&used+amountMinor>lim.dailyMinor)fail('DAILY_LIMIT_EXCEEDED','Daily limit exceeded.');
   const now=new Date(); if(!Number.isSafeInteger(b.postedBalanceMinor+amountMinor))fail('BALANCE_OVERFLOW','Destination balance overflow.');
   tx.update(fromRef,{postedBalanceMinor:a.postedBalanceMinor-amountMinor,updatedAt:now}); tx.update(toRef,{postedBalanceMinor:b.postedBalanceMinor+amountMinor,updatedAt:now});
   tx.create(tRef,{transferId,type:'INTERNAL',sourceAccountId:fromRef.id,fromAccountId:fromRef.id,destinationAccountId:toRef.id,toAccountId:toRef.id,amountMinor,currency:'INR',status:'COMPLETED',requestedByUid:uid,idempotencyKey,createdAt:now,completedAt:now});
   tx.create(keyRef,{requestHash,transferId,uid,createdAt:now}); tx.set(usageRef,{accountId:fromRef.id,dateIST:date,usedMinor:used+amountMinor,updatedAt:now},{merge:true});
   tx.create(ledger.doc(`${transferId}_DEBIT`),{transferId,accountId:fromRef.id,direction:'DEBIT',amountMinor,postedAt:now}); tx.create(ledger.doc(`${transferId}_CREDIT`),{transferId,accountId:toRef.id,direction:'CREDIT',amountMinor,postedAt:now});
   return {transferId,status:'COMPLETED',duplicate:false};
  });
 }
 return {transfer};
}
