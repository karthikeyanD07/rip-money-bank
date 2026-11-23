import test from 'node:test';
import assert from 'node:assert/strict';
import {validateNote,createTransferId,routeBankFromIfsc,BANK_CODES} from '../src/domain/contract.js';
const good={txnId:'B07-1732163000-abcd1234',fromBank:'B07',fromAccount:10000001,toBank:'B21',toAccount:10000005,amount:500,status:'PENDING',reason:'',settled:false};
test('shared contract has exactly allowed statuses and valid fields',()=>{assert.deepEqual(validateNote(good),[]);assert.equal(validateNote({...good,status:'SUCCESS'}).includes('Invalid status.'),true);});
test('IFSC prefix routing is case insensitive',()=>assert.equal(routeBankFromIfsc('b21XXXX123'),'B21'));
test('bank registry is B01-B50',()=>{assert.equal(BANK_CODES.length,50);assert.equal(BANK_CODES[0],'B01');assert.equal(BANK_CODES[49],'B50');});
test('transfer IDs are sender-prefixed and unique-shaped',()=>assert.match(createTransferId('B07',1732163000000),/^B07-1732163000-[a-f0-9]{12}$/));
