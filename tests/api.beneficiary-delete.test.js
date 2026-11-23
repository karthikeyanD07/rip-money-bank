import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiServer} from '../src/api/server.js';

test('DELETE beneficiary route requires session context and passes caller UID to ownership service',async()=>{
 const calls=[];const system={sessions:{resolve:async(token,csrf,options)=>{assert.equal(token,'session-token');assert.equal(csrf,'csrf-token');assert.equal(options.requireCsrf,true);return {uid:'customer-a',role:'CUSTOMER'};}},beneficiaries:{remove:async input=>{calls.push(input);return {deleted:true};}}};
 const server=createApiServer({system,bankId:'P629'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/beneficiaries/beneficiary-1`,{method:'DELETE',headers:{cookie:'bank_session=session-token','x-csrf-token':'csrf-token'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{deleted:true});assert.deepEqual(calls,[{uid:'customer-a',beneficiaryId:'beneficiary-1'}]);}
 finally{await new Promise(resolve=>server.close(resolve));}
});
