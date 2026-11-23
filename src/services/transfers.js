import {fail} from '../domain/errors.js';
import {assertPaise,rupeesToPaise} from '../domain/money.js';
import {createTransferId,routeBankFromIfsc,assertValidNote} from '../domain/contract.js';

export function createTransferService({db,sharedDb,bankCode}) {
  const accounts=db.collection('accounts'), txns=db.collection('transactions'), ledger=db.collection('ledger_entries'), notes=sharedDb.collection('transfers');
  async function sameBank({uid,customerId,fromAccountId,toAccountNumber,amountPaise,requestId}) {
    assertPaise(amountPaise);
    if(String(fromAccountId)===String(toAccountNumber)) fail('SAME_ACCOUNT','Source and destination must differ.');
    const fromRef=accounts.doc(fromAccountId);
    const destQ=await accounts.where('accountNumber','==',Number(toAccountNumber)).limit(2).get();
    if(destQ.size!==1) fail('BENEFICIARY_NOT_FOUND','Beneficiary account not found or ambiguous.');
    const toRef=destQ.docs[0].ref;
    const debit=txns.doc(`${requestId}_DEBIT`), credit=txns.doc(`${requestId}_CREDIT`);
    return db.runTransaction(async t=>{
      const [fs,ts,ds,cs]=await Promise.all([t.get(fromRef),t.get(toRef),t.get(debit),t.get(credit)]);
      if(ds.exists||cs.exists) return {duplicate:true,requestId};
      if(!fs.exists||!ts.exists) fail('NOT_FOUND','Account not found.');
      const f=fs.data(),b=ts.data();
      if(f.customerId!==customerId) fail('FORBIDDEN','Sender account is not owned by this customer.');
      if(f.status!=='APPROVED') fail('ACCOUNT_NOT_APPROVED','Sender account must be APPROVED.');
      if(b.status!=='APPROVED') fail('BENEFICIARY_NOT_APPROVED','Beneficiary account must be APPROVED.');
      if(f.balancePaise<amountPaise) fail('INSUFFICIENT_FUNDS','Insufficient funds.');
      if(amountPaise>f.transferLimitPaise) fail('LIMIT_EXCEEDED','Transfer limit exceeded.');
      const now=new Date();
      t.update(fromRef,{balancePaise:f.balancePaise-amountPaise,updatedAt:now});
      t.update(toRef,{balancePaise:b.balancePaise+amountPaise,updatedAt:now});
      t.create(debit,{requestId,accountId:fromRef.id,type:'DEBIT',amountPaise,status:'COMPLETED',createdAt:now});
      t.create(credit,{requestId,accountId:toRef.id,type:'CREDIT',amountPaise,status:'COMPLETED',createdAt:now});
      t.create(ledger.doc(`${requestId}_DEBIT`),{requestId,accountId:fromRef.id,direction:'DEBIT',amountPaise,createdAt:now});
      t.create(ledger.doc(`${requestId}_CREDIT`),{requestId,accountId:toRef.id,direction:'CREDIT',amountPaise,createdAt:now});
      return {requestId,status:'COMPLETED',duplicate:false};
    });
  }
  async function refund(txnId,reason='Transfer rejected') {
    const debit=txns.doc(`${txnId}_DEBIT`), refundRef=txns.doc(`${txnId}_REFUND`);
    return db.runTransaction(async t=>{
      const d=await t.get(debit);
      if(!d.exists) fail('DEBIT_NOT_FOUND','Pending debit not found.');
      const data=d.data();
      if(data.status!=='PENDING') return {refunded:false,reason:'Debit is no longer pending.'};
      const [a,r]=await Promise.all([t.get(accounts.doc(data.accountId)),t.get(refundRef)]);
      if(r.exists) return {refunded:false,reason:'Refund already recorded.'};
      if(!a.exists) fail('ACCOUNT_NOT_FOUND','Refund account missing.');
      const now=new Date();
      t.update(accounts.doc(data.accountId),{balancePaise:a.data().balancePaise+data.amountPaise,updatedAt:now});
      t.update(debit,{status:'REFUNDED',reason,updatedAt:now});
      t.create(refundRef,{transferId:txnId,accountId:data.accountId,type:'REFUND',amountPaise:data.amountPaise,status:'COMPLETED',createdAt:now});
      t.create(ledger.doc(`${txnId}_REFUND`),{transferId:txnId,accountId:data.accountId,direction:'CREDIT',amountPaise:data.amountPaise,createdAt:now});
      return {refunded:true};
    });
  }
  async function send({customerId,fromAccountId,beneficiaryIfsc,beneficiaryAccountNumber,amountPaise,requestId}) {
    assertPaise(amountPaise);
    const toBank=routeBankFromIfsc(beneficiaryIfsc);
    if(toBank===bankCode) fail('USE_SAME_BANK','Use same-bank transfer for this bank.');
    const bank=await db.collection('banks').doc(toBank).get();
    if(!bank.exists || bank.data().active!==true) fail('UNKNOWN_BANK','unknown bank');
    if(!Number.isSafeInteger(Number(beneficiaryAccountNumber))||Number(beneficiaryAccountNumber)<=0) fail('INVALID_ACCOUNT_NUMBER','Invalid beneficiary account number.');
    const txnId=createTransferId(bankCode);
    const fromRef=accounts.doc(fromAccountId), debit=txns.doc(`${txnId}_DEBIT`);
    await db.runTransaction(async t=>{
      const [a,d]=await Promise.all([t.get(fromRef),t.get(debit)]);
      if(d.exists) fail('DUPLICATE_TRANSFER','Transfer ID already exists.');
      if(!a.exists) fail('ACCOUNT_NOT_FOUND','Sender account not found.');
      const x=a.data();
      if(x.customerId!==customerId) fail('FORBIDDEN','Sender account is not owned by this customer.');
      if(x.status!=='APPROVED') fail('ACCOUNT_NOT_APPROVED','Sender account must be APPROVED.');
      if(amountPaise>x.transferLimitPaise) fail('LIMIT_EXCEEDED','Transfer limit exceeded.');
      if(x.balancePaise<amountPaise) fail('INSUFFICIENT_FUNDS','Insufficient funds.');
      const now=new Date();
      t.update(fromRef,{balancePaise:x.balancePaise-amountPaise,updatedAt:now});
      t.create(debit,{transferId:txnId,accountId:fromAccountId,type:'DEBIT',amountPaise,status:'PENDING',otherBank:toBank,otherAccount:Number(beneficiaryAccountNumber),createdAt:now});
      t.create(ledger.doc(`${txnId}_DEBIT`),{transferId:txnId,accountId:fromAccountId,direction:'DEBIT',amountPaise,createdAt:now});
    });
    const sender= (await fromRef.get()).data();
    const note={txnId,fromBank:bankCode,fromAccount:Number(sender.accountNumber),toBank,toAccount:Number(beneficiaryAccountNumber),amount:Number((amountPaise/100).toFixed(2)),status:'PENDING',reason:'',settled:false};
    try {
      assertValidNote(note);
      await notes.doc(txnId).create(note);
      return {txnId,status:'PENDING'};
    } catch(error) {
      // Ambiguous timeout: never refund until existence is checked successfully.
      let existing;
      try { existing=await notes.doc(txnId).get(); }
      catch(readError) {
        await db.collection('system_events').add({eventType:'INTERBANK_NOTE_WRITE_UNCERTAIN',transferId:txnId,error:String(error),readError:String(readError),createdAt:new Date()});
        return {txnId,status:'PENDING_RECONCILIATION',customerAction:'Do not retry; bank must reconcile this transfer.'};
      }
      if(existing.exists) return {txnId,status:'PENDING',recoveryRequired:true};
      await refund(txnId,'Shared note confirmed absent after write failure.');
      return {txnId,status:'REFUNDED',error:'Transfer note could not be written.'};
    }
  }
  async function receive(noteId) {
    const ref=notes.doc(noteId), snap=await ref.get();
    if(!snap.exists) return {ignored:true};
    const n=snap.data();
    if(n.toBank!==bankCode||n.status!=='PENDING') return {ignored:true};
    const errors= (await import('../domain/contract.js')).validateNote(n);
    if(errors.length) { await ref.update({status:'REJECTED',reason:errors.join(' ')}); return {status:'REJECTED'}; }
    const credit=txns.doc(`${n.txnId}_CREDIT`);
    const candidates=await accounts.where('accountNumber','==',n.toAccount).limit(2).get();
    if(candidates.size!==1) { await ref.update({status:'REJECTED',reason:candidates.empty?'Account not found':'Account number is ambiguous'}); return {status:'REJECTED'}; }
    const target=candidates.docs[0].ref, amountPaise=rupeesToPaise(n.amount);
    try {
      await db.runTransaction(async t=>{
        const [c,a]=await Promise.all([t.get(credit),t.get(target)]);
        if(c.exists) return;
        if(!a.exists||a.data().status!=='APPROVED') fail('BENEFICIARY_NOT_APPROVED',`Account is ${a.exists?a.data().status:'not found'}.`);
        const now=new Date();
        t.update(target,{balancePaise:a.data().balancePaise+amountPaise,updatedAt:now});
        t.create(credit,{transferId:n.txnId,accountId:target.id,type:'CREDIT',amountPaise,status:'COMPLETED',createdAt:now});
        t.create(ledger.doc(`${n.txnId}_CREDIT`),{transferId:n.txnId,accountId:target.id,direction:'CREDIT',amountPaise,createdAt:now});
      });
      await ref.update({status:'CREDITED',reason:''});
      return {status:'CREDITED'};
    } catch(e) {
      await ref.update({status:'REJECTED',reason:e.message||'Beneficiary could not be credited'});
      return {status:'REJECTED'};
    }
  }
  async function settle(noteId) {
    const ref=notes.doc(noteId), snap=await ref.get();
    if(!snap.exists) return {ignored:true};
    const n=snap.data();
    if(n.fromBank!==bankCode||n.settled!==false||!['CREDITED','REJECTED'].includes(n.status)) return {ignored:true};
    if(n.status==='CREDITED') {
      const debit=txns.doc(`${n.txnId}_DEBIT`);
      await db.runTransaction(async t=>{const d=await t.get(debit); if(d.exists&&d.data().status==='PENDING') t.update(debit,{status:'COMPLETED',updatedAt:new Date()});});
    } else await refund(n.txnId,n.reason||'Transfer rejected');
    await ref.update({settled:true});
    return {settled:true};
  }
  async function startListening({onError=console.error}={}) {
    const receiveQ=notes.where('toBank','==',bankCode).where('status','==','PENDING');
    const settleQ=notes.where('fromBank','==',bankCode).where('settled','==',false);
    const receiveHandler=async snap=>{for(const ch of snap.docChanges()) if(['added','modified'].includes(ch.type)) try{await receive(ch.doc.id)}catch(e){onError(e,ch.doc.id)}};
    const settleHandler=async snap=>{for(const ch of snap.docChanges()) if(['added','modified'].includes(ch.type)) try{await settle(ch.doc.id)}catch(e){onError(e,ch.doc.id)}};
    const stopA=receiveQ.onSnapshot(receiveHandler,onError), stopB=settleQ.onSnapshot(settleHandler,onError);
    return ()=>{stopA();stopB();};
  }
  return {sameBank,send,receive,settle,refund,startListening};
}
