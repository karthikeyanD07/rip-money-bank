import {randomUUID} from 'node:crypto';
import {COLLECTIONS} from '../domain/schema.js';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const TYPES=new Map([['application/pdf','pdf'],['image/jpeg','jpg'],['image/png','png']]);
function matchesMagic(buffer,type){if(type==='application/pdf')return buffer.subarray(0,5).toString()==='%PDF-';if(type==='image/png')return buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));if(type==='image/jpeg')return buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;return false;}
export function createKycStorageService({db,bucket,maxBytes=10*1024*1024}) {
 async function upload({uid,buffer,contentType}) {const ext=TYPES.get(contentType);if(!ext)fail('UNSUPPORTED_DOCUMENT_TYPE','Only PDF, JPEG and PNG KYC documents are accepted.');if(!Buffer.isBuffer(buffer)||buffer.length===0||buffer.length>maxBytes)fail('INVALID_DOCUMENT_SIZE','KYC document must be between 1 byte and 10 MB.');if(!matchesMagic(buffer,contentType))fail('INVALID_DOCUMENT_CONTENT','Document content does not match its declared MIME type.');
  const q=await db.collection(COLLECTIONS.kycRequests).where('uid','==',uid).where('status','in',['PENDING','HOLD']).limit(1).get();if(q.empty)fail('KYC_NOT_PENDING','No pending KYC request found.');
  const path=`kyc/${uid}/${randomUUID()}.${ext}`,file=bucket.file(path);await file.save(buffer,{resumable:false,metadata:{contentType,metadata:{ownerUid:uid,classification:'KYC'}}});
  try{await db.runTransaction(async tx=>{const current=await tx.get(q.docs[0].ref);if(!current.exists||!['PENDING','HOLD'].includes(current.data().status))fail('KYC_NOT_PENDING','KYC request is no longer pending.');tx.update(q.docs[0].ref,{documentPaths:[...(current.data().documentPaths||[]),path],updatedAt:new Date()});});}catch(error){await file.delete().catch(()=>{});throw error;}return {path,contentType,sizeBytes:buffer.length};
 }
 async function documentUrl({requestId,path}){const q=await db.collection(COLLECTIONS.kycRequests).doc(requestId).get();if(!q.exists||!(q.data().documentPaths||[]).includes(path)||!path.startsWith(`kyc/${q.data().uid}/`))fail('DOCUMENT_NOT_FOUND','KYC document is not attached to this request.');const [url]=await bucket.file(path).getSignedUrl({action:'read',expires:Date.now()+5*60_000});return {url,expiresInSeconds:300};}
 return {upload,documentUrl};
}
