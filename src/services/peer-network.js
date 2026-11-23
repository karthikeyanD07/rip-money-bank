import {createHash} from 'node:crypto';
import {signPeerRequest,verifyPeerRequest,createNonce} from '../domain/peer-auth.js';
import {resolveBankByIfsc} from './bank-registry.js';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createPeerNetworkService({db,sharedDb,x42,bankId,peerSecrets,fetchImpl=fetch,timeoutMs=10000}) {
  const x42BaseUrl = String(process.env.X42_BASE_URL || '').replace(/\/$/, '');
  const x42Secret = String(process.env.X42_BANK_SECRET || '');
  function assertX42Configured() {
    if (!x42BaseUrl || x42BaseUrl.includes('YOUR_') || x42Secret.length < 32 || x42Secret.includes('replace-with')) fail('X42_NOT_CONFIGURED','Set X42_BASE_URL and the issued P661 X42 secret before submitting interbank transfers.');
    let endpoint;try{endpoint=new URL(x42BaseUrl);}catch{fail('X42_URL_INVALID','X42_BASE_URL must be a valid URL.');}
    const local=['localhost','127.0.0.1','::1'].includes(endpoint.hostname);if(endpoint.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&local&&endpoint.protocol==='http:'))fail('X42_HTTPS_REQUIRED','X42 must use HTTPS outside local development.');
  }
  async function callX42({method,path,body={}}) {
    assertX42Configured();
    const timestamp=Date.now(),nonce=createNonce();
    const signature=signPeerRequest(x42Secret,{bankId, timestamp, nonce, method, path, body});
    const response=await fetchImpl(new URL(path,x42BaseUrl),{method,headers:{'content-type':'application/json','x-x42-bank-id':bankId,'x-x42-timestamp':String(timestamp),'x-x42-nonce':nonce,'x-x42-signature':signature},...(method==='GET'?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(result.message||result.error||`X42 returned HTTP ${response.status}.`),{code:result.error||'X42_REQUEST_FAILED',status:response.status,definitive:response.status>=400&&response.status<500});
    return result;
  }
  async function sendInterbank({uid,fromAccountId,destinationIfsc,destinationAccountNumber,amountMinor,idempotencyKey}) {
    assertX42Configured();
    const destination=await resolveBankByIfsc(sharedDb,destinationIfsc);
    if(destination.bankId===bankId) fail('USE_INTERNAL_TRANSFER','Destination IFSC belongs to this bank.');
    const transferId=`${bankId}_${createHash('sha256').update(`${uid}:${idempotencyKey}`).digest('hex').slice(0,32)}`;
    const payload={sourceBankId:bankId,destinationIfsc:String(destinationIfsc).toUpperCase(),destinationAccountReference:String(destinationAccountNumber),amountMinor,currency:'INR',sourceReference:transferId};
    const reserve=await x42.reserve({accountId:fromAccountId,uid,transferId,idempotencyKey,amountMinor,destination:{bankId:destination.bankId,ifsc:destinationIfsc,accountNumber:String(destinationAccountNumber)}});
    if(reserve.status==='COMPLETED'||reserve.status==='REJECTED')return {transferId,status:reserve.status,duplicate:true};
    try {
      const result=await callX42({method:'POST',path:'/api/v1/transfers',body:payload});
      await db.collection('transfers').doc(transferId).update({x42TransactionId:result.transactionId||null,x42Status:result.status||'QUEUED',updatedAt:new Date()});
      return {transferId,x42TransactionId:result.transactionId,status:'PENDING',duplicate:!!result.duplicate,reconciliationRequired:true};
    } catch(error) {
      if(error.definitive){await x42.release({transferId,reason:error.message});return {transferId,status:'REJECTED',reason:error.message};}
      await db.collection('transfers').doc(transferId).update({x42Status:'UNKNOWN',lastError:'X42 submission outcome is unknown; reconciliation required.',updatedAt:new Date()});
      return {transferId,status:'PENDING',reconciliationRequired:true};
    }
  }
  async function validateDestination({destinationIfsc,destinationAccountNumber}) {
    assertX42Configured();
    const directory=await resolveBankByIfsc(sharedDb,destinationIfsc);if(directory.bankId===bankId)fail('USE_INTERNAL_TRANSFER','Destination IFSC belongs to this bank.');
    return callX42({method:'POST',path:'/api/v1/validate',body:{destinationIfsc:String(destinationIfsc).toUpperCase(),destinationAccountReference:String(destinationAccountNumber)}});
  }
  async function queryX42Status(transactionId) {
    return callX42({method:'GET',path:`/api/v1/transfers/${encodeURIComponent(transactionId)}`,body:{}});
  }
  async function retryPendingTransfer(transferId) {
    const snapshot=await db.collection('transfers').doc(transferId).get();if(!snapshot.exists)fail('TRANSFER_NOT_FOUND','Transfer not found.');const t=snapshot.data();if(t.status!=='PENDING'||t.type!=='INTERBANK')return {transferId,status:t.status,ignored:true};
    if(t.x42TransactionId){const state=await queryX42Status(t.x42TransactionId);return {transferId,x42Status:state.status,status:'PENDING'};}
    return sendInterbank({uid:t.requestedByUid,fromAccountId:t.sourceAccountId,destinationIfsc:t.destination.ifsc,destinationAccountNumber:t.destination.accountNumber,amountMinor:t.amountMinor,idempotencyKey:t.idempotencyKey});
  }
  async function reconcilePending({limit=100}={}) {
    const pending=await db.collection('transfers').where('status','==','PENDING').limit(limit).get();const results=[];
    for(const doc of pending.docs){const transfer=doc.data();if(transfer.type!=='INTERBANK')continue;try{
      if(!transfer.x42TransactionId){const retried=await retryPendingTransfer(doc.id);results.push({transferId:doc.id,status:'PENDING',recoveredByIdempotentResubmission:true,...retried});continue;}
      const state=await queryX42Status(transfer.x42TransactionId);
      if(state.status==='SUCCESS'){await x42.debit({transferId:doc.id,idempotencyKey:transfer.idempotencyKey});results.push({transferId:doc.id,status:'COMPLETED'});}
      else if(state.status==='FAILED'){await x42.release({transferId:doc.id,reason:state.reason||'X42 reported definitive failure'});results.push({transferId:doc.id,status:'REJECTED'});}
      else {await db.collection('transfers').doc(doc.id).update({x42Status:state.status||'UNKNOWN',updatedAt:new Date()});results.push({transferId:doc.id,status:'PENDING',x42Status:state.status||'UNKNOWN'});}
    }catch(error){results.push({transferId:doc.id,status:'PENDING',error:error.message});}}
    return results;
  }
  async function validateIncoming({headers,body}) {
    const caller=String(headers['x-bank-id']||headers['x-x42-bank-id']||''),timestamp=Number(headers['x-bank-timestamp']||headers['x-x42-timestamp']),nonce=String(headers['x-bank-nonce']||headers['x-x42-nonce']||''),signature=String(headers['x-bank-signature']||headers['x-x42-signature']||''),secret=peerSecrets[caller],path='/api/v1/interbank/validate';
    if(caller!=='X42'||!secret||!verifyPeerRequest({secret,bankId:caller,timestamp,nonce,method:'POST',path,body,signature}))fail('PEER_AUTH_FAILED','X42 switch authentication failed.');
    const nonceRef=db.collection('peer_nonces').doc(createHash('sha256').update(`${caller}:${nonce}`).digest('hex'));
    await db.runTransaction(async tx=>{const old=await tx.get(nonceRef);if(old.exists)fail('PEER_REPLAY','Peer nonce has already been used.');tx.create(nonceRef,{bankId:caller,nonce,createdAt:new Date(),expiresAt:new Date(Date.now()+10*60_000)});});
    const sourceBankId=String(body.sourceBankId||''),banks=sharedDb.collection('banks');let source=await banks.doc(sourceBankId).get();if(!source.exists){const matches=await banks.where('bankId','==',sourceBankId).limit(1).get();source=matches.docs[0]||null;}if(!source||source.data().status!=='ACTIVE')fail('PEER_BANK_INACTIVE','Source bank is not active in the shared directory.');
    const q=await db.collection('accounts').where('accountNumber','==',String(body.destinationAccountNumber||'')).limit(2).get();if(q.size!==1)return {accountExists:false,maskedName:null};const account=q.docs[0].data();if(account.status!=='ACTIVE')return {accountExists:false,maskedName:null};
    const user=await db.collection('users').doc(account.customerUid).get();if(!user.exists)return {accountExists:false,maskedName:null};
    const words=String(user.data().fullName||'Account holder').trim().split(/\s+/);const maskedName=words.map(w=>w.length<=1?w[0]||'':`${w[0]}${'*'.repeat(Math.min(5,Math.max(2,w.length-1)))}`).join(' ');
    return {accountExists:true,maskedName};
  }
  async function receiveCredit({headers,body}) {
    const caller=String(headers['x-bank-id']||headers['x-x42-bank-id']||''), timestamp=Number(headers['x-bank-timestamp']||headers['x-x42-timestamp']),nonce=String(headers['x-bank-nonce']||headers['x-x42-nonce']||''),signature=String(headers['x-bank-signature']||headers['x-x42-signature']||'');
    const sourceBankId=String(body.sourceBankId||''); const secret=peerSecrets[caller]; const path='/api/v1/interbank/credits';
    if(caller!=='X42'||!secret||!verifyPeerRequest({secret,bankId:caller,timestamp,nonce,method:'POST',path,body,signature})) fail('PEER_AUTH_FAILED','X42 switch authentication failed.');
    const banks=sharedDb.collection('banks');let sourceBank=await banks.doc(sourceBankId).get();if(!sourceBank.exists){const matches=await banks.where('bankId','==',sourceBankId).limit(2).get();if(matches.size===1)sourceBank=matches.docs[0];}
    if(!sourceBank.exists||sourceBank.data().status!=='ACTIVE')fail('PEER_BANK_INACTIVE','Source bank is not active in the central directory.');
    const bank=sourceBankId;
    const nonceRef=db.collection('peer_nonces').doc(createHash('sha256').update(`${caller}:${nonce}`).digest('hex'));
    await db.runTransaction(async tx=>{const s=await tx.get(nonceRef);if(s.exists)fail('PEER_REPLAY','Peer nonce has already been used.');tx.create(nonceRef,{bankId:caller,nonce,createdAt:new Date(),expiresAt:new Date(Date.now()+10*60_000)});});
    if(!/^[A-Z0-9_-]{5,80}$/i.test(String(body.transferId||''))||body.sourceBankId!==bank)fail('INVALID_PEER_PAYLOAD','Transfer identity is invalid.');
    const sourceRequestHash=digest(body);
    const accountQuery=await db.collection('accounts').where('accountNumber','==',String(body.destinationAccountNumber)).limit(2).get();
    if(accountQuery.size!==1){
      const inboxRef=db.collection('interbank_inbox').doc(body.transferId);let result;
      await db.runTransaction(async tx=>{const old=await tx.get(inboxRef);if(old.exists){const x=old.data();if(x.sourceRequestHash!==sourceRequestHash)fail('DUPLICATE_CONFLICT','Transfer ID reused with different credit details.');result={transferId:body.transferId,status:x.status,duplicate:true,definitive:x.status==='REJECTED',reason:x.reason||null};return;}const reason=accountQuery.empty?'Destination account not found.':'Destination account number is ambiguous.';tx.create(inboxRef,{sourceBankId:bank,destinationAccountId:null,amountMinor:body.amountMinor,currency:body.currency,status:'REJECTED',reason,sourceRequestHash,rejectedAt:new Date()});result={transferId:body.transferId,status:'REJECTED',definitive:true,reason};});return result;
    }
    try{return await x42.credit({transferId:body.transferId,sourceBankId:bank,destinationAccountId:accountQuery.docs[0].id,amountMinor:body.amountMinor,currency:body.currency,sourceRequestHash});}
    catch(error){if(!['ACCOUNT_INACTIVE','UNSUPPORTED_CURRENCY','INVALID_AMOUNT','BALANCE_OVERFLOW'].includes(error.code))throw error;const inboxRef=db.collection('interbank_inbox').doc(body.transferId);await inboxRef.create({sourceBankId:bank,destinationAccountId:accountQuery.docs[0].id,amountMinor:body.amountMinor,currency:body.currency,status:'REJECTED',reason:error.message,sourceRequestHash,rejectedAt:new Date()}).catch(()=>{});return {transferId:body.transferId,status:'REJECTED',definitive:true,reason:error.message};}
  }
  async function peerStatus({headers,transferId}) {
    const bank=String(headers['x-bank-id']||headers['x-x42-bank-id']||''),timestamp=Number(headers['x-bank-timestamp']||headers['x-x42-timestamp']),nonce=String(headers['x-bank-nonce']||headers['x-x42-nonce']||''),signature=String(headers['x-bank-signature']||headers['x-x42-signature']||'');
    const body={transferId}; const path=`/api/v1/interbank/transfers/${transferId}`; const secret=peerSecrets[bank];
    if(bank!=='X42'||!secret||!verifyPeerRequest({secret,bankId:bank,timestamp,nonce,method:'GET',path,body})) fail('PEER_AUTH_FAILED','X42 switch authentication failed.');
    const nonceRef=db.collection('peer_nonces').doc(createHash('sha256').update(`${bank}:${nonce}`).digest('hex')); await db.runTransaction(async tx=>{const n=await tx.get(nonceRef);if(n.exists)fail('PEER_REPLAY','Peer nonce has already been used.');tx.create(nonceRef,{bankId:caller,nonce,createdAt:new Date(),expiresAt:new Date(Date.now()+10*60_000)});});
    const s=await db.collection('interbank_inbox').doc(transferId).get(); return s.exists?{transferId,status:s.data().status,reason:s.data().reason||null}:{transferId,status:'NOT_FOUND'};
  }
  return {sendInterbank,validateDestination,validateIncoming,receiveCredit,peerStatus,retryPendingTransfer,reconcilePending};
}
