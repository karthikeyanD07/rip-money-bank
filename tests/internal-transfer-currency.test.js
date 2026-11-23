import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryFirestore} from './helpers/memory-firestore.js';
import {createInternalTransferService} from '../src/services/internal-transfers.js';

test('internal transfer rejects mismatched currencies without changing either balance',async()=>{
 const db=new MemoryFirestore();
 await db.collection('accounts').doc('source').create({customerUid:'sender',status:'ACTIVE',currency:'INR',accountNumber:'SOURCE1',postedBalanceMinor:10000,heldMinor:0});
 await db.collection('accounts').doc('destination').create({customerUid:'receiver',status:'ACTIVE',currency:'USD',accountNumber:'DEST001',postedBalanceMinor:2000,heldMinor:0});
 const service=createInternalTransferService({db,bankId:'P629'});
 await assert.rejects(()=>service.transfer({uid:'sender',fromAccountId:'source',toAccountNumber:'DEST001',amountMinor:1000,idempotencyKey:'currency-mismatch'}),{code:'CURRENCY_MISMATCH'});
 assert.equal((await db.collection('accounts').doc('source').get()).data().postedBalanceMinor,10000);
 assert.equal((await db.collection('accounts').doc('destination').get()).data().postedBalanceMinor,2000);
});
