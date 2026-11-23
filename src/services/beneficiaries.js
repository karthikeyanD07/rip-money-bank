import {COLLECTIONS} from '../domain/schema.js';
import {normalizeIfsc,resolveBankByIfsc} from './bank-registry.js';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
export function createBeneficiaryService({db,sharedDb}) {
 const col=db.collection(COLLECTIONS.beneficiaries);
 async function create({uid,beneficiaryIfsc,beneficiaryAccountNumber,nickname}){const ifsc=normalizeIfsc(beneficiaryIfsc);const bank=await resolveBankByIfsc(sharedDb,ifsc);const number=String(beneficiaryAccountNumber||'').trim();if(!/^[A-Za-z0-9-]{5,30}$/.test(number))fail('INVALID_ACCOUNT_NUMBER','Beneficiary account number is invalid.');const ref=col.doc();await ref.create({uid,beneficiaryBankId:bank.bankId,beneficiaryIfsc:ifsc,beneficiaryAccountNumber:number,nickname:String(nickname||'').slice(0,60),createdAt:new Date()});return {beneficiaryId:ref.id,beneficiaryBankId:bank.bankId,beneficiaryIfsc:ifsc};}
 async function list(uid){const s=await col.where('uid','==',uid).get();return s.docs.map(d=>({beneficiaryId:d.id,...d.data()}));}
 async function remove({uid,beneficiaryId}){const r=col.doc(beneficiaryId),s=await r.get();if(!s.exists||s.data().uid!==uid)fail('NOT_FOUND','Beneficiary not found.');await r.delete();return {deleted:true};}
 return {create,list,remove};
}
