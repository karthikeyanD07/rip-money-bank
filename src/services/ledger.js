import {fail} from '../domain/errors.js';

export function createLedgerService({db}) {
  async function accountHistory({accountId,customerId,limit=25}) {
    const a=await db.collection('accounts').doc(accountId).get();
    if(!a.exists || a.data().customerId!==customerId) fail('NOT_FOUND','Account not found.');
    return db.collection('transactions').where('accountId','==',accountId).orderBy('createdAt','desc').limit(Math.min(Math.max(limit,1),100)).get();
  }
  async function reconcileAccount(accountId) {
    const [account,entries]=await Promise.all([
      db.collection('accounts').doc(accountId).get(),
      db.collection('ledger_entries').where('accountId','==',accountId).get()
    ]);
    if(!account.exists) fail('NOT_FOUND','Account not found.');
    let calculated=0;
    for(const d of entries.docs) {
      const e=d.data(); if(!Number.isSafeInteger(e.amountPaise)) fail('LEDGER_CORRUPT','Ledger entry has invalid amount.');
      calculated += e.direction==='CREDIT' ? e.amountPaise : -e.amountPaise;
    }
    const actual=account.data().balancePaise;
    const result={accountId,ledgerBalancePaise:calculated,accountBalancePaise:actual,matched:calculated===actual,checkedAt:new Date()};
    await db.collection('reconciliation_runs').add(result);
    return result;
  }
  return {accountHistory,reconcileAccount};
}
