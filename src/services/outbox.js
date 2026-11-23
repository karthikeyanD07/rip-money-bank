import {randomUUID} from 'node:crypto';
/** At-least-once delivery. A crash after SMTP accepts a message but before SENT is stored can still cause a retry. */
export function createNotificationOutboxService({db,transport,leaseMs=5*60_000}) {
 const outbox=db.collection('notification_outbox');
 async function process({limit=25}={}) {
  const [pending,processing]=await Promise.all([outbox.where('status','==','PENDING').limit(limit).get(),outbox.where('status','==','PROCESSING').limit(limit).get()]);
  const docs=[...pending.docs,...processing.docs].slice(0,limit),results=[];
  for(const doc of docs){const ref=doc.ref,lockId=randomUUID();let event;
   const claimed=await db.runTransaction(async tx=>{const fresh=await tx.get(ref);if(!fresh.exists)return false;const d=fresh.data(),stale=d.status==='PROCESSING'&&d.processingAt&&Date.now()-new Date(d.processingAt.toDate?.()??d.processingAt).getTime()>leaseMs;if(d.status!=='PENDING'&&!stale)return false;event=d;tx.update(ref,{status:'PROCESSING',lockId,processingAt:new Date(),attempts:(d.attempts||0)+1});return true;});
   if(!claimed)continue;
   try{await transport.sendMail({to:event.email,messageId:`<${doc.id}@bank-engine.local>`,subject:event.type==='KYC_DECISION'?'KYC application update':'Bank notification',text:JSON.stringify(event.payload||{})});await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.exists&&s.data().lockId===lockId)tx.update(ref,{status:'SENT',sentAt:new Date(),lockId:null});});results.push({eventId:doc.id,status:'SENT'});}
   catch(error){await db.runTransaction(async tx=>{const s=await tx.get(ref);if(s.exists&&s.data().lockId===lockId)tx.update(ref,{status:'PENDING',lastError:String(error.message||error),lockId:null});});results.push({eventId:doc.id,status:'PENDING'});}
  }
  return results;
 }
 return {process};
}
