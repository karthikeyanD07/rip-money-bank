import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryFirestore } from './helpers/memory-firestore.js';
import { registerBank, resolveBankByIfsc, seedBankDirectory } from '../src/services/bank-registry.js';

const nexus = {
  bankId: 'P629', bankName: 'Nexus Bank', ifsc: 'SRIR0A4N7WX',
  address: null, apiBaseUrl: 'https://nexus.example.test/api', apiVersion: 'v1', status: 'ACTIVE'
};

test('shared bank directory stores bank and unique IFSC mapping separately', async () => {
  const sharedDb = new MemoryFirestore();
  const result = await registerBank(sharedDb, nexus, { updatedBy: 'CENTRAL-1' });
  assert.equal(result.bankId, 'P629');
  const bank = (await sharedDb.collection('banks').doc('P629').get()).data();
  assert.equal(bank.bankName, 'Nexus Bank');
  assert.equal(bank.status, 'ACTIVE');
  assert.equal((await sharedDb.collection('ifsc_registry').doc('SRIR0A4N7WX').get()).data().bankId, 'P629');
  assert.equal((await sharedDb.collection('transfers').get()).size, 0);
});

test('IFSC lookup resolves only active banks with HTTPS endpoints', async () => {
  const sharedDb = new MemoryFirestore();
  await registerBank(sharedDb, nexus);
  const result = await resolveBankByIfsc(sharedDb, 'srir0a4n7wx');
  assert.equal(result.bankId, 'P629');
  await assert.rejects(registerBank(sharedDb, { ...nexus, bankId: 'P658', bankName: 'Other Bank' }), error => error.code === 'IFSC_ALREADY_REGISTERED');
});

test('inactive banks and banks without configured peer URLs cannot be resolved for transfers', async () => {
  const sharedDb = new MemoryFirestore();
  await registerBank(sharedDb, { ...nexus, status: 'INACTIVE' });
  await assert.rejects(resolveBankByIfsc(sharedDb, nexus.ifsc), error => error.code === 'BANK_INACTIVE');
  const other = { ...nexus, bankId: 'P658', ifsc: 'AKSH0R4N8WX', status: 'ACTIVE', apiBaseUrl: null };
  await registerBank(sharedDb, other);
  await assert.rejects(resolveBankByIfsc(sharedDb, other.ifsc), error => error.code === 'BANK_ENDPOINT_NOT_CONFIGURED');
});

test('seed refuses to fabricate directory metadata', async () => {
  const sharedDb = new MemoryFirestore();
  const result = await seedBankDirectory(sharedDb, []);
  assert.equal(result.count, 0);
  assert.equal((await sharedDb.collection('banks').get()).size, 0);
});
test('IFSC resolver supports shared directory documents keyed by IFSC with bankId field', async () => {
  const sharedDb = new MemoryFirestore();
  await sharedDb.collection('banks').doc('KART0M4N7CQ').create({bankId:'P661',bankName:'RIP Money Bank',ifsc:'KART0M4N7CQ',apiBaseUrl:'https://rip.example.test',status:'ACTIVE'});
  await sharedDb.collection('ifsc_registry').doc('KART0M4N7CQ').create({bankId:'P661'});
  const result = await resolveBankByIfsc(sharedDb,'kart0m4n7cq');
  assert.equal(result.bankId,'P661');
  assert.equal(result.bankName,'RIP Money Bank');
});
