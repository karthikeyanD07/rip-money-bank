import {fail} from '../domain/errors.js';
import {assertPaise} from '../domain/money.js';
import {writeAudit} from './audit.js';

export function createLoanService({db}) {
  async function apply({customerId,accountId,amountPaise,termMonths,purpose}) {
    assertPaise(amountPaise);
    if(!Number.isInteger(termMonths)||termMonths<1||termMonths>120) fail('INVALID_TERM','Loan term must be 1-120 months.');
    const a=await db.collection('accounts').doc(accountId).get();
    if(!a.exists||a.data().customerId!==customerId) fail('NOT_FOUND','Account not found.');
    if(a.data().status!=='APPROVED') fail('ACCOUNT_NOT_APPROVED','Loan applications require an APPROVED account.');
    const ref=db.collection('loans').doc();
    await ref.create({customerId,accountId,amountPaise,termMonths,purpose:String(purpose||'').slice(0,500),status:'PENDING',createdAt:new Date(),updatedAt:new Date()});
    return {loanId:ref.id,status:'PENDING'};
  }
  async function decide({loanId,decision,adminUid,reason=''}) {
    if(!['APPROVED','REJECTED'].includes(decision)) fail('INVALID_DECISION','Decision must be APPROVED or REJECTED.');
    const loanRef=db.collection('loans').doc(loanId);
    await db.runTransaction(async t=>{
      const l=await t.get(loanRef); if(!l.exists) fail('NOT_FOUND','Loan not found.');
      if(l.data().status!=='PENDING') fail('ALREADY_DECIDED','Loan has already been decided.');
      if(decision==='REJECTED') {t.update(loanRef,{status:'REJECTED',reason,reviewedBy:adminUid,updatedAt:new Date()});return;}
      const aRef=db.collection('accounts').doc(l.data().accountId), a=await t.get(aRef);
      if(!a.exists||a.data().status!=='APPROVED') fail('ACCOUNT_NOT_APPROVED','Disbursement account must remain APPROVED.');
      const id=`LOAN_${loanId}`, amount=l.data().amountPaise, now=new Date();
      t.update(aRef,{balancePaise:a.data().balancePaise+amount,updatedAt:now});
      t.update(loanRef,{status:'APPROVED',reason,reviewedBy:adminUid,approvedAt:now,updatedAt:now});
      t.create(db.collection('transactions').doc(id),{accountId:aRef.id,loanId,type:'LOAN',amountPaise:amount,status:'COMPLETED',createdAt:now});
      t.create(db.collection('ledger_entries').doc(id),{accountId:aRef.id,loanId,direction:'CREDIT',amountPaise:amount,type:'LOAN',createdAt:now});
    });
    await writeAudit(db,{actorUid:adminUid,action:`LOAN_${decision}`,targetType:'LOAN',targetId:loanId,details:{reason}});
    return {loanId,status:decision};
  }
  async function repay({customerId,loanId,fromAccountId,amountPaise,requestId}) {
    assertPaise(amountPaise);
    const loanRef=db.collection('loans').doc(loanId), accountRef=db.collection('accounts').doc(fromAccountId);
    return db.runTransaction(async t=>{
      const [l,a]=await Promise.all([t.get(loanRef),t.get(accountRef)]);
      if(!l.exists||!a.exists||l.data().customerId!==customerId||a.data().customerId!==customerId) fail('NOT_FOUND','Loan or account not found.');
      if(l.data().status!=='APPROVED') fail('LOAN_NOT_ACTIVE','Loan is not approved.');
      if(a.data().status!=='APPROVED') fail('ACCOUNT_NOT_APPROVED','Repayment account must be approved.');
      if(a.data().balancePaise<amountPaise) fail('INSUFFICIENT_FUNDS','Insufficient funds.');
      const repRef=db.collection('loan_repayments').doc(requestId), now=new Date();
      const old=await t.get(repRef); if(old.exists) return {duplicate:true};
      const paid=l.data().repaidPaise||0;
      if(paid+amountPaise>l.data().amountPaise) fail('OVERPAYMENT','Repayment exceeds principal outstanding in this simplified model.');
      t.update(accountRef,{balancePaise:a.data().balancePaise-amountPaise,updatedAt:now});
      t.update(loanRef,{repaidPaise:paid+amountPaise,status:paid+amountPaise===l.data().amountPaise?'PAID':'APPROVED',updatedAt:now});
      t.create(repRef,{loanId,accountId:fromAccountId,amountPaise,createdAt:now});
      t.create(db.collection('transactions').doc(`${requestId}_DEBIT`),{accountId:fromAccountId,loanId,type:'LOAN_REPAYMENT',amountPaise,status:'COMPLETED',createdAt:now});
      t.create(db.collection('ledger_entries').doc(`${requestId}_DEBIT`),{accountId:fromAccountId,loanId,direction:'DEBIT',amountPaise,createdAt:now});
      return {duplicate:false,repaidPaise:paid+amountPaise};
    });
  }
  return {apply,decide,repay};
}
