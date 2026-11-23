import 'dotenv/config';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { createArgon2PasswordHasher } from '../src/infra/password-hasher.js';

const fail = message => { throw new Error(message); };
if (process.env.USE_EMULATORS !== 'true') fail('Refusing to seed: USE_EMULATORS must be true.');
if (process.env.NODE_ENV === 'production') fail('Refusing to seed a production environment.');

const banks = [
  { bankId: 'P661', bankName: 'RIP Money Bank', ifsc: 'KART0M4N7CQ', projectId: process.env.PRIVATE_FIREBASE_PROJECT_ID || 'demo-rip-p661', customerCount: 500, transactionCount: 5000, beneficiaryCount: 300, loanCount: 100 },
  { bankId: 'P629', bankName: 'Nexus Bank', ifsc: 'SRIR0A4N7WX', projectId: 'demo-bank-p629', customerCount: 200, transactionCount: 1200, beneficiaryCount: 100, loanCount: 35 },
  { bankId: 'P742', bankName: 'Meridian Bank', ifsc: 'MERI0A7B2CD', projectId: 'demo-bank-p742', customerCount: 200, transactionCount: 1200, beneficiaryCount: 100, loanCount: 35 },
  { bankId: 'P815', bankName: 'Horizon Bank', ifsc: 'HZON0R8T4K2', projectId: 'demo-bank-p815', customerCount: 200, transactionCount: 1200, beneficiaryCount: 100, loanCount: 35 }
];
const firestoreHost = process.env.PRIVATE_FIRESTORE_EMULATOR || '127.0.0.1:8080';
const sharedHost = process.env.SHARED_FIRESTORE_EMULATOR || '127.0.0.1:8180';
const fixedNow = new Date('2026-01-01T00:00:00.000Z');
const password = process.env.SYNTHETIC_CUSTOMER_PASSWORD || 'DemoBank#2026!';
if (password.length < 12) fail('SYNTHETIC_CUSTOMER_PASSWORD must be at least 12 characters.');
const hasher = createArgon2PasswordHasher();
const passwordHash = await hasher.hash(password);
const apps = [];

function appFor(name, projectId, host) {
  const appName = `synthetic-${name}`;
  const app = getApps().find(x => x.name === appName) || initializeApp({ projectId }, appName);
  apps.push(app);
  const db = getFirestore(app);
  db.settings({ host, ssl: false });
  return db;
}

async function writeInChunks(db, entries, chunkSize = 400) {
  let count = 0;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const batch = db.batch();
    for (const [ref, data] of entries.slice(i, i + chunkSize)) batch.set(ref, data);
    await batch.commit();
    count += Math.min(chunkSize, entries.length - i);
  }
  return count;
}

function money(n) { return Math.max(1000, Math.round(n)); }
function accountNumber(bankId, n) { return `${bankId}${String(n).padStart(12, '0')}`; }
function makePlan(bank, db) {
  const entries = [];
  const add = (collection, id, data) => entries.push([collection.doc(id), data]);
  const users = [];
  const accounts = [];
  const balances = new Map();
  const now = fixedNow;

  for (let i = 1; i <= bank.customerCount; i++) {
    const uid = `${bank.bankId.toLowerCase()}-cust-${String(i).padStart(5, '0')}`;
    const kycStatus = i % 12 === 0 ? 'HOLD' : i % 8 === 0 ? 'PENDING' : i % 19 === 0 ? 'REJECTED' : 'APPROVED';
    const customer = {
      uid, bankId: bank.bankId, kycStatus,
      fullName: `Synthetic ${bank.bankName.split(' ')[0]} Customer ${String(i).padStart(4, '0')}`,
      email: `${bank.bankId.toLowerCase()}.customer${String(i).padStart(4, '0')}@example.test`,
      passwordHash, role: 'CUSTOMER', status: 'ACTIVE', synthetic: true,
      createdAt: new Date(now.getTime() - (i * 86400000)), updatedAt: now
    };
    users.push(customer);
  }
  // User, email registry, KYC and portfolio records.
  for (const u of users) {
    const emailKey = createHash('sha256').update(u.email).digest('hex');
    add(db.collection('users'), u.uid, u);
    add(db.collection('email_registry'), emailKey, { uid: u.uid, email: u.email, createdAt: u.createdAt, synthetic: true });
    const kycStatus = u.kycStatus;
    add(db.collection('kyc_requests'), `KYC-${u.uid}`, { uid: u.uid, documentPaths: [], openingDepositMinor: 100000, status: kycStatus, reviewedBy: kycStatus === 'PENDING' ? null : 'SYNTHETIC_REVIEWER', reviewedAt: kycStatus === 'PENDING' ? null : now, reason: kycStatus === 'REJECTED' ? 'Synthetic scenario record' : null, createdAt: u.createdAt, synthetic: true, documentMetadataOnly: true });
    add(db.collection('portfolios'), u.uid, { uid: u.uid, accountIds: [], loanIds: [], updatedAt: now, synthetic: true });
  }

  let accountSeq = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const numberOfAccounts = bank.bankId === 'P661' ? (i < 150 ? 2 : 1) : (i % 5 === 0 ? 2 : 1);
    const accountIds = [];
    for (let j = 0; j < numberOfAccounts; j++) {
      accountSeq++;
      const id = `${bank.bankId}-ACC-${String(accountSeq).padStart(6, '0')}`;
      const accountStatus = u.kycStatus === 'APPROVED' ? 'ACTIVE' : u.kycStatus === 'PENDING' ? 'PENDING' : u.kycStatus === 'HOLD' ? 'HOLD' : 'CLOSED';
      const opening = ['APPROVED','HOLD'].includes(u.kycStatus) ? 250000 + ((i * 7919 + j * 15431) % 7500000) : 0;
      const account = { customerUid: u.uid, accountNumber: accountNumber(bank.bankId, accountSeq), status: accountStatus, currency: 'INR', postedBalanceMinor: opening, heldMinor: 0, accountType: j === 0 ? 'SAVINGS' : 'CURRENT', createdAt: u.createdAt, updatedAt: now, synthetic: true };
      accounts.push({ id, uid: u.uid, accountNumber: account.accountNumber, opening, account });
      accountIds.push(id);
      balances.set(id, opening);
      add(db.collection('accounts'), id, { accountId: id, ...account });
      if (opening > 0) add(db.collection('ledger_entries'), `${id}_OPENING`, { transferId: `OPENING_${id}`, accountId: id, direction: 'CREDIT', amountMinor: opening, entryType: 'SYNTHETIC_OPENING_BALANCE', postedAt: u.createdAt, synthetic: true });
      add(db.collection('transfer_limits'), id, { accountId: id, perTransferMinor: 5000000, dailyMinor: 15000000, updatedBy: 'SYNTHETIC_SEED', updatedAt: now, synthetic: true });
    }
    const pRef = db.collection('portfolios').doc(u.uid);
    const p = entries.find(x => x[0].path === pRef.path);
    if (p) p[1].accountIds = accountIds;
  }

  // Historical account activity. Every generated event has one immutable transfer record and one matching ledger entry.
  const eligibleAccounts = accounts.filter(a => a.account.status === 'ACTIVE');
  for (let n = 1; n <= bank.transactionCount; n++) {
    const a = eligibleAccounts[(n * 37 + 11) % eligibleAccounts.length];
    const current = balances.get(a.id);
    const credit = n % 3 === 0 || current < 200000;
    const proposedMinor = money(2500 + ((n * 3571) % 175000));
    const amountMinor = credit ? proposedMinor : Math.min(proposedMinor, Math.max(1000, current - 1000));
    const next = credit ? current + amountMinor : current - amountMinor;
    balances.set(a.id, next);
    const transferId = `${bank.bankId}-HIST-${String(n).padStart(7, '0')}`;
    const postedAt = new Date(now.getTime() - ((bank.transactionCount - n + 1) * 3600000));
    add(db.collection('transfers'), transferId, { transferId, type: 'SYNTHETIC_ACCOUNT_ACTIVITY', sourceAccountId: credit ? null : a.id, destinationAccountId: credit ? a.id : null, amountMinor, currency: 'INR', status: 'COMPLETED', requestedByUid: a.uid, channel: n % 4 === 0 ? 'UPI' : n % 4 === 1 ? 'CARD' : n % 4 === 2 ? 'NEFT' : 'CASH', description: credit ? 'Synthetic cash deposit / credit' : 'Synthetic purchase / withdrawal', createdAt: postedAt, completedAt: postedAt, synthetic: true });
    add(db.collection('ledger_entries'), `${transferId}_${credit ? 'CREDIT' : 'DEBIT'}`, { transferId, accountId: a.id, direction: credit ? 'CREDIT' : 'DEBIT', amountMinor, entryType: credit ? 'SYNTHETIC_CREDIT' : 'SYNTHETIC_DEBIT', postedAt, synthetic: true });
  }
  for (const a of accounts) {
    const ref = db.collection('accounts').doc(a.id);
    const pair = entries.find(x => x[0].path === ref.path);
    pair[1].postedBalanceMinor = balances.get(a.id);
  }

  // Beneficiary directory records intentionally include external participants, but all network participants remain inactive.
  for (let n = 1; n <= bank.beneficiaryCount; n++) {
    const owner = users[(n * 13) % users.length];
    const external = banks[(n % (banks.length - 1)) + 1];
    add(db.collection('beneficiaries'), `${bank.bankId}-BEN-${String(n).padStart(6, '0')}`, { uid: owner.uid, beneficiaryBankId: n % 4 === 0 ? bank.bankId : external.bankId, beneficiaryIfsc: n % 4 === 0 ? bank.ifsc : external.ifsc, beneficiaryAccountNumber: accountNumber(n % 4 === 0 ? bank.bankId : external.bankId, n), nickname: `Synthetic Payee ${String(n).padStart(3, '0')}`, createdAt: new Date(now.getTime() - n * 3600000), synthetic: true });
  }

  const portfolioLoanIds = new Map();
  for (let n = 1; n <= bank.loanCount; n++) {
    const owned = eligibleAccounts[(n * 17) % eligibleAccounts.length];
    const owner = users.find(u => u.uid === owned.uid);
    const status = n % 5 === 0 ? 'PENDING' : n % 11 === 0 ? 'REJECTED' : n % 7 === 0 ? 'PAID' : 'APPROVED';
    const requestedMinor = 500000 + ((n * 123457) % 4500000);
    const repaidMinor = status === 'PAID' ? requestedMinor : status === 'APPROVED' ? Math.floor(requestedMinor * (n % 4) / 10) : 0;
    const outstandingMinor = status === 'PAID' ? 0 : status === 'APPROVED' ? requestedMinor - repaidMinor : 0;
    const loanId = `${bank.bankId}-LOAN-${String(n).padStart(5, '0')}`;
    add(db.collection('loans'), loanId, { uid: owner.uid, accountId: owned.id, requestedMinor, termMonths: [6, 12, 24, 36][n % 4], purpose: ['Home improvement', 'Education', 'Vehicle', 'Personal expenses'][n % 4], status, outstandingMinor, repaidMinor, reviewedBy: status === 'PENDING' ? null : 'SYNTHETIC_REVIEWER', createdAt: new Date(now.getTime() - n * 86400000), updatedAt: now, synthetic: true });
    if (!portfolioLoanIds.has(owner.uid)) portfolioLoanIds.set(owner.uid, []);
    portfolioLoanIds.get(owner.uid).push(loanId);
    if (status === 'APPROVED' || status === 'PAID') {
      const credit = requestedMinor;
      balances.set(owned.id, balances.get(owned.id) + credit - repaidMinor);
      const accRef = db.collection('accounts').doc(owned.id);
      const accPair = entries.find(x => x[0].path === accRef.path);
      accPair[1].postedBalanceMinor = balances.get(owned.id);
      add(db.collection('transfers'), `${loanId}_DISBURSEMENT`, { transferId: `${loanId}_DISBURSEMENT`, type: 'SYNTHETIC_LOAN_DISBURSEMENT', sourceAccountId: null, destinationAccountId: owned.id, amountMinor: credit, currency: 'INR', status: 'COMPLETED', requestedByUid: owner.uid, createdAt: new Date(now.getTime() - n * 86400000), completedAt: new Date(now.getTime() - n * 86400000), synthetic: true });
      add(db.collection('ledger_entries'), `${loanId}_DISBURSEMENT`, { transferId: `${loanId}_DISBURSEMENT`, loanId, accountId: owned.id, direction: 'CREDIT', amountMinor: credit, entryType: 'SYNTHETIC_LOAN_DISBURSEMENT', postedAt: new Date(now.getTime() - n * 86400000), synthetic: true });
      if (repaidMinor > 0) {
        add(db.collection('loan_repayments'), `${loanId}_REPAYMENT_001`, { loanId, uid: owner.uid, accountId: owned.id, amountMinor: repaidMinor, idempotencyKey: `synthetic-${loanId}-repayment`, createdAt: new Date(now.getTime() - Math.floor(n / 2) * 3600000), synthetic: true });
        add(db.collection('ledger_entries'), `${loanId}_REPAYMENT_001`, { transferId: `${loanId}_REPAYMENT_001`, loanId, accountId: owned.id, direction: 'DEBIT', amountMinor: repaidMinor, entryType: 'SYNTHETIC_LOAN_REPAYMENT', postedAt: new Date(now.getTime() - Math.floor(n / 2) * 3600000), synthetic: true });
      }
    }
  }

  // Reconcile portfolio loan references and add a modest, deterministic audit trail.
  for (const [uid, loanIds] of portfolioLoanIds) {
    const pRef = db.collection('portfolios').doc(uid);
    const p = entries.find(x => x[0].path === pRef.path);
    if (p) p[1].loanIds = loanIds;
  }
  for (let n = 1; n <= Math.min(250, bank.customerCount); n++) {
    add(db.collection('audit_logs'), `${bank.bankId}-AUD-${String(n).padStart(5, '0')}`, { logid: `${bank.bankId}-AUD-${String(n).padStart(5, '0')}`, actorUid: 'SYNTHETIC_REVIEWER', action: ['CUSTOMER_REVIEWED', 'LIMIT_UPDATED', 'KYC_REVIEWED'][n % 3], description: 'Synthetic operational audit event', targetType: ['CUSTOMER', 'ACCOUNT', 'KYC'][n % 3], targetId: users[(n * 7) % users.length].uid, createdAt: new Date(now.getTime() - n * 7200000), synthetic: true });
  }
  return { entries, customers: users.length, accounts: accounts.length, transactions: bank.transactionCount, beneficiaries: bank.beneficiaryCount, loans: bank.loanCount };
}

try {
  const sharedDb = appFor('shared', process.env.SHARED_FIREBASE_PROJECT_ID || 'demo-x42-shared', sharedHost);
  // Local-only simulated participants. No API URLs or activation are fabricated.
  const directoryBatch = sharedDb.batch();
  let directoryWrites = 0;
  for (const bank of banks) {
    const ref = sharedDb.collection('banks').doc(bank.bankId);
    const existing = await ref.get();
    if (existing.exists) { const x = existing.data(); if (x.bankId !== bank.bankId || x.ifsc !== bank.ifsc || x.status !== 'INACTIVE' || x.apiBaseUrl !== null) fail(`Shared directory record ${bank.bankId} exists with unexpected identity or activation state; refusing to overwrite it.`); }
    else { directoryBatch.create(ref, { bankId: bank.bankId, bankName: bank.bankName, ifsc: bank.ifsc, apiBaseUrl: null, apiVersion: 'v1', status: 'INACTIVE', environment: 'SYNTHETIC_EMULATOR', managedBy: 'LOCAL_SYNTHETIC_SEED', createdAt: fixedNow, updatedAt: fixedNow, synthetic: true }); directoryWrites++; }
    const ifscRef = sharedDb.collection('ifsc_registry').doc(bank.ifsc);
    const mapping = await ifscRef.get();
    if (mapping.exists && mapping.data().bankId !== bank.bankId) fail(`IFSC ${bank.ifsc} is already mapped to a different bank; refusing to overwrite it.`);
    if (!mapping.exists) { directoryBatch.create(ifscRef, { bankId: bank.bankId, createdAt: fixedNow, synthetic: true }); directoryWrites++; }
  }
  if (directoryWrites > 0) await directoryBatch.commit();

  const results = [];
  for (const bank of banks) {
    const db = appFor(bank.bankId.toLowerCase(), bank.projectId, firestoreHost);
    const plan = makePlan(bank, db);
    const writes = await writeInChunks(db, plan.entries);
    const { entries: _privateEntries, ...summary } = plan;
    results.push({ bankId: bank.bankId, projectId: bank.projectId, ...summary, writes });
    console.log(`SEEDED ${bank.bankId}: customers=${plan.customers}, accounts=${plan.accounts}, transactions=${plan.transactions}, writes=${writes}`);
  }
  console.log(JSON.stringify({ status: 'complete', emulatorOnly: true, banks: results, sharedDirectoryBanks: banks.length, directoryStatus: 'INACTIVE' }, null, 2));
} finally {
  await Promise.all(apps.map(app => app.delete().catch(() => {})));
}
