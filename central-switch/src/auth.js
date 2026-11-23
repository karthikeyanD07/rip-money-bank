import {createHmac, timingSafeEqual, randomUUID} from 'node:crypto';
export const nonce=()=>randomUUID();
export function canonical({bankId,timestamp,nonce,method,path,body}){return [bankId,String(timestamp),nonce,method.toUpperCase(),path,JSON.stringify(body??{})].join('\n');}
export function sign(secret,fields){return createHmac('sha256',secret).update(canonical(fields)).digest('hex');}
export function verify(secret,fields,{now=Date.now(),skewMs=300000}={}){
 if(!secret||!fields.bankId||!fields.nonce||!fields.signature||!Number.isFinite(Number(fields.timestamp)))return false;
 if(Math.abs(now-Number(fields.timestamp))>skewMs)return false;
 const expected=Buffer.from(sign(secret,fields),'hex');let actual;try{actual=Buffer.from(fields.signature,'hex')}catch{return false;}
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function signedHeaders(secret,bankId,method,path,body={}){const timestamp=Date.now(),n=nonce();return {'content-type':'application/json','x-x42-bank-id':bankId,'x-x42-timestamp':String(timestamp),'x-x42-nonce':n,'x-x42-signature':sign(secret,{bankId,timestamp,nonce:n,method,path,body})};}
