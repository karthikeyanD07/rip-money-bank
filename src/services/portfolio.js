import {COLLECTIONS,availableBalance} from '../domain/schema.js';
export function createPortfolioService({db}) {
 async function get(uid){const [a,l]=await Promise.all([db.collection(COLLECTIONS.accounts).where('customerUid','==',uid).get(),db.collection(COLLECTIONS.loans).where('uid','==',uid).get()]);const accounts=a.docs.map(d=>{const x=d.data();return {accountId:d.id,accountNumber:x.accountNumber,status:x.status,currency:x.currency,postedBalanceMinor:x.postedBalanceMinor,heldMinor:x.heldMinor,availableBalanceMinor:availableBalance(x)};});const loans=l.docs.map(d=>({loanId:d.id,...d.data()}));return {uid,accounts,loans,totalAvailableMinor:accounts.reduce((n,x)=>n+x.availableBalanceMinor,0)};}
 return {get};
}
