import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryFirestore} from './helpers/memory-firestore.js';
import {registerBank} from '../src/services/bank-registry.js';
import {createBeneficiaryService} from '../src/services/beneficiaries.js';

const bank={bankId:'P658',bankName:'Sandbox Peer',ifsc:'AKSH0R4N8WX',apiBaseUrl:'https://peer.example.test',apiVersion:'v1',status:'ACTIVE'};

test('beneficiary create, list and delete are scoped to the authenticated owner',async()=>{
 const db=new MemoryFirestore(),sharedDb=new MemoryFirestore();await registerBank(sharedDb,bank);
 const service=createBeneficiaryService({db,sharedDb});
 const created=await service.create({uid:'customer-a',beneficiaryIfsc:bank.ifsc.toLowerCase(),beneficiaryAccountNumber:'PEER-12345',nickname:'Rent'});
 assert.equal(created.beneficiaryBankId,'P658');assert.equal((await service.list('customer-a')).length,1);assert.equal((await service.list('customer-b')).length,0);
 await assert.rejects(()=>service.remove({uid:'customer-b',beneficiaryId:created.beneficiaryId}),{code:'NOT_FOUND'});
 assert.equal((await service.list('customer-a')).length,1);assert.deepEqual(await service.remove({uid:'customer-a',beneficiaryId:created.beneficiaryId}),{deleted:true});assert.equal((await service.list('customer-a')).length,0);
});

test('beneficiary rejects invalid IFSC, unknown banks and malformed account numbers',async()=>{
 const db=new MemoryFirestore(),sharedDb=new MemoryFirestore();await registerBank(sharedDb,bank);const service=createBeneficiaryService({db,sharedDb});
 await assert.rejects(()=>service.create({uid:'u',beneficiaryIfsc:'BAD',beneficiaryAccountNumber:'123456'}),{code:'INVALID_IFSC'});
 await assert.rejects(()=>service.create({uid:'u',beneficiaryIfsc:'ABCD0123456',beneficiaryAccountNumber:'123456'}),{code:'BANK_NOT_FOUND'});
 await assert.rejects(()=>service.create({uid:'u',beneficiaryIfsc:bank.ifsc,beneficiaryAccountNumber:'x'}),{code:'INVALID_ACCOUNT_NUMBER'});
});
