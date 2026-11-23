import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiServer} from '../src/api/server.js';
function snapshot(items){return {docs:items.map((data,i)=>({id:String(i),data:()=>data})),size:items.length};}
async function withServer(system,fn){const server=createApiServer({system,bankId:'P661'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await fn(`http://127.0.0.1:${server.address().port}`);}finally{await new Promise(resolve=>server.close(resolve));}}
test('admin dashboard returns bank-private operational aggregates',async()=>{
 const collections={users:snapshot([{role:'CUSTOMER'},{role:'ADMIN'}]),accounts:snapshot([{postedBalanceMinor:125000,heldMinor:0},{postedBalanceMinor:250000,heldMinor:10000}]),transfers:snapshot([{},{}]),kyc_requests:snapshot([{status:'PENDING'},{status:'HOLD'},{status:'APPROVED'}]),loans:snapshot([{status:'PENDING'},{status:'APPROVED'}])};
 const system={sessions:{resolve:async()=>({uid:'admin-1',role:'ADMIN'})},db:{collection:name=>({get:async()=>collections[name]})}};
 await withServer(system,async base=>{const response=await fetch(`${base}/api/v1/admin/dashboard`,{headers:{cookie:'bank_session=test'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{customers:1,accounts:2,transfers:2,kycRequests:3,pendingKyc:2,loans:2,pendingLoans:1,totalPostedMinor:375000,currency:'INR'});});
});
test('customer sessions cannot access admin dashboard',async()=>{
 const system={sessions:{resolve:async()=>({uid:'customer-1',role:'CUSTOMER'})}};
 await withServer(system,async base=>{const response=await fetch(`${base}/api/v1/admin/dashboard`,{headers:{cookie:'bank_session=test'}});assert.equal(response.status,403);assert.equal((await response.json()).error,'FORBIDDEN');});
});
test('admin bank profile exposes readiness without exposing private endpoint or credentials',async()=>{
 const system={sessions:{resolve:async()=>({uid:'admin-1',role:'ADMIN'})},sharedDb:{collection:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({bankId:'P661',bankName:'RIP Money Bank',ifsc:'KART0M4N7CQ',status:'INACTIVE',apiBaseUrl:null,apiVersion:'v1',bankSecret:'never-return-this'})})})})}};
 await withServer(system,async base=>{const response=await fetch(`${base}/api/v1/admin/bank-settings`,{headers:{cookie:'bank_session=test'}});assert.equal(response.status,200);const body=await response.json();assert.equal(body.bankId,'P661');assert.equal(body.apiConfigured,false);assert.equal(body.apiBaseUrl,undefined);assert.equal(body.bankSecret,undefined);});
});
