import test from 'node:test';
import assert from 'node:assert/strict';
import {routeBankFromIfsc,validateNote} from '../src/domain/contract.js';
import {rupeesToPaise} from '../src/domain/money.js';
test('IFSC parsing rejects absent and short values',()=>{assert.throws(()=>routeBankFromIfsc(''));assert.throws(()=>routeBankFromIfsc('B'));});
test('incoming note rejects malformed amount and unsupported status',()=>{
 const n={txnId:'x',fromBank:'B07',fromAccount:123,toBank:'B21',toAccount:456,amount:-1,status:'SUCCESS',reason:'',settled:false};
 assert.ok(validateNote(n).length>=2);
});
test('integer paise rejects unsafe values',()=>assert.throws(()=>rupeesToPaise(Number.MAX_SAFE_INTEGER)));
