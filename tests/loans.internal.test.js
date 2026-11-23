import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryFirestore} from './helpers/memory-firestore.js';
import {createLoanService} from '../src/services/loans-basic.js';

test('internal loan approval disburses to the bank-local account and repayment updates balances and ledger',async()=>{
 const db=new MemoryFirestore();await db.collection('accounts').doc('acct').create({customerUid:'u1',accountNumber:'RIP00001',currency:'INR',status:'ACTIVE',postedBalanceMinor:100000,heldMinor:0});
 const loans=createLoanService({db});const application=await loans.apply({uid:'u1',accountId:'acct',requestedMinor:500000,termMonths:12,purpose:'Education'});assert.equal(application.status,'PENDING');
 const decision=await loans.decide({loanId:application.loanId,adminUid:'admin',decision:'APPROVED'});assert.equal(decision.disbursedMinor,500000);let account=await db.collection('accounts').doc('acct').get();assert.equal(account.data().postedBalanceMinor,600000);
 const repayment=await loans.repay({uid:'u1',loanId:application.loanId,fromAccountId:'acct',amountMinor:200000,idempotencyKey:'repayment-0001'});assert.equal(repayment.outstandingMinor,300000);account=await db.collection('accounts').doc('acct').get();assert.equal(account.data().postedBalanceMinor,400000);
 const duplicate=await loans.repay({uid:'u1',loanId:application.loanId,fromAccountId:'acct',amountMinor:200000,idempotencyKey:'repayment-0001'});assert.equal(duplicate.duplicate,true);account=await db.collection('accounts').doc('acct').get();assert.equal(account.data().postedBalanceMinor,400000);
 const second=await loans.repay({uid:'u1',loanId:application.loanId,fromAccountId:'acct',amountMinor:300000,idempotencyKey:'repayment-0002'});assert.equal(second.status,'PAID');
 const loan=await db.collection('loans').doc(application.loanId).get();assert.equal(loan.data().outstandingMinor,0);assert.equal(loan.data().repaidMinor,500000);
 const ledger=await db.collection('ledger_entries').get();assert.equal(ledger.size,3);
});
test('internal loan repayment rejects overpayment and insufficient funds',async()=>{
 const db=new MemoryFirestore();await db.collection('accounts').doc('acct').create({customerUid:'u1',accountNumber:'RIP00001',currency:'INR',status:'ACTIVE',postedBalanceMinor:100000,heldMinor:0});const loans=createLoanService({db});const app=await loans.apply({uid:'u1',accountId:'acct',requestedMinor:200000});await loans.decide({loanId:app.loanId,adminUid:'admin',decision:'APPROVED'});
 await assert.rejects(()=>loans.repay({uid:'u1',loanId:app.loanId,fromAccountId:'acct',amountMinor:300000,idempotencyKey:'repayment-over'}),{code:'OVERPAYMENT'});
 await db.collection('accounts').doc('acct').update({heldMinor:250000});
 await assert.rejects(()=>loans.repay({uid:'u1',loanId:app.loanId,fromAccountId:'acct',amountMinor:100000,idempotencyKey:'repayment-funds'}),{code:'INSUFFICIENT_FUNDS'});
});
