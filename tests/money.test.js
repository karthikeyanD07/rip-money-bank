import test from 'node:test';
import assert from 'node:assert/strict';
import {rupeesToPaise,paiseToRupees} from '../src/domain/money.js';
test('money conversion is integer paise',()=>{assert.equal(rupeesToPaise(500.25),50025);assert.equal(paiseToRupees(50025),500.25);});
test('rejects invalid money',()=>{for(const n of [0,-1,1.234,NaN,Infinity,'4'])assert.throws(()=>rupeesToPaise(n));});
