import 'dotenv/config';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
if (process.env.USE_EMULATORS !== 'true' || process.env.NODE_ENV === 'production') throw new Error('Seed verification is restricted to non-production emulator mode.');
const banks=[
 {bankId:'P661',projectId:process.env.PRIVATE_FIREBASE_PROJECT_ID||'demo-rip-p661',customers:500,accounts:650,transactions:5000},
 {bankId:'P629',projectId:'demo-bank-p629',customers:200,accounts:240,transactions:1200},
 {bankId:'P742',projectId:'demo-bank-p742',customers:200,accounts:240,transactions:1200},
 {bankId:'P815',projectId:'demo-bank-p815',customers:200,accounts:240,transactions:1200}
];
const host=process.env.PRIVATE_FIRESTORE_EMULATOR||'127.0.0.1:8080';
const results=[];
for(const b of banks){
 const app=initializeApp({projectId:b.projectId},`verify-${b.bankId.toLowerCase()}`);const db=getFirestore(app);db.settings({host,ssl:false});
 try{
  const [users,accounts,transfers,loans,beneficiaries,kyc,ledger]=await Promise.all(['users','accounts','transfers','loans','beneficiaries','kyc_requests','ledger_entries'].map(c=>db.collection(c).get()));
  const errors=[];
  if(users.size!==b.customers)errors.push(`customers expected ${b.customers}, got ${users.size}`);
  if(accounts.size!==b.accounts)errors.push(`accounts expected ${b.accounts}, got ${accounts.size}`);
  const activity=transfers.docs.filter(d=>d.data().type==='SYNTHETIC_ACCOUNT_ACTIVITY');
  if(activity.length!==b.transactions)errors.push(`activity expected ${b.transactions}, got ${activity.length}`);
  const userIds=new Set(users.docs.map(d=>d.id));
  const ledgerTotals=new Map();
  for(const d of ledger.docs){const x=d.data();const old=ledgerTotals.get(x.accountId)||0;ledgerTotals.set(x.accountId,old+(x.direction==='CREDIT'?x.amountMinor:-x.amountMinor));}
  for(const d of accounts.docs){const a=d.data();if(!userIds.has(a.customerUid))errors.push(`orphan account ${d.id}`);if(!Number.isSafeInteger(a.postedBalanceMinor)||!Number.isSafeInteger(a.heldMinor)||a.heldMinor>a.postedBalanceMinor)errors.push(`invalid balance ${d.id}`);if((ledgerTotals.get(d.id)||0)!==a.postedBalanceMinor)errors.push(`ledger does not reconcile for ${d.id}`);}
  results.push({bankId:b.bankId,projectId:b.projectId,customers:users.size,accounts:accounts.size,activityTransactions:activity.length,beneficiaries:beneficiaries.size,loans:loans.size,kycRequests:kyc.size,ledgerEntries:ledger.size,ledgerReconciled:errors.length===0,errors});
 }finally{await app.delete();}
}
const sharedApp=initializeApp({projectId:process.env.SHARED_FIREBASE_PROJECT_ID||'demo-x42-shared'},'verify-shared-directory');const shared=getFirestore(sharedApp);shared.settings({host:process.env.SHARED_FIRESTORE_EMULATOR||'127.0.0.1:8180',ssl:false});
try{for(const b of banks){const s=await shared.collection('banks').doc(b.bankId).get();if(!s.exists)throw new Error(`Missing shared directory bank ${b.bankId}`);if(s.data().status!=='INACTIVE'||s.data().apiBaseUrl!==null)throw new Error(`Simulated bank ${b.bankId} must remain INACTIVE with no API URL.`);const m=await shared.collection('ifsc_registry').doc(b.bankId==='P661'?'KART0M4N7CQ':b.bankId==='P629'?'SRIR0A4N7WX':b.bankId==='P742'?'MERI0A7B2CD':'HZON0R8T4K2').get();if(!m.exists||m.data().bankId!==b.bankId)throw new Error(`IFSC mapping missing for ${b.bankId}`);}}finally{await sharedApp.delete();}
const failed=results.filter(x=>x.errors.length);
console.log(JSON.stringify({status:failed.length?'failed':'passed',banks:results},null,2));
if(failed.length)process.exitCode=1;
