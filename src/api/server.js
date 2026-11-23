import http from 'node:http';
import {parse} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
const cookie=(header,name)=>{for(const part of String(header||'').split(';')){const [k,...v]=part.trim().split('=');if(k===name)return decodeURIComponent(v.join('='));}return null;};
const json=(res,status,value,headers={})=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});res.end(JSON.stringify(value));};
async function body(req){let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>1_000_000)throw Object.assign(new Error('Request too large.'),{code:'REQUEST_TOO_LARGE'});return raw?JSON.parse(raw):{};}
async function rawBody(req,maxBytes=10*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(new Error('Document exceeds 10 MB.'),{code:'INVALID_DOCUMENT_SIZE'});chunks.push(chunk);}return Buffer.concat(chunks);}
const statusFor=e=>({UNAUTHENTICATED:401,INVALID_SESSION:401,SESSION_EXPIRED:401,CSRF_REQUIRED:403,CSRF_INVALID:403,FORBIDDEN:403,NOT_FOUND:404,ACCOUNT_NOT_FOUND:404,BENEFICIARY_NOT_FOUND:404,KYC_NOT_FOUND:404,INVALID_AMOUNT:400,IDEMPOTENCY_REQUIRED:400,INVALID_EMAIL:400,WEAK_PASSWORD:400,EMAIL_EXISTS:409,IDEMPOTENCY_CONFLICT:409,PEER_AUTH_FAILED:401,PEER_REPLAY:409,INSUFFICIENT_FUNDS:409,DAILY_LIMIT_EXCEEDED:409,TRANSFER_LIMIT_EXCEEDED:409,DAILY_LIMIT_EXCEEDED:409,PEER_BANK_INACTIVE:403,KYC_DOCUMENTS_REQUIRED:409,INVALID_DOCUMENT_SIZE:413,INVALID_DOCUMENT_CONTENT:400,UNSUPPORTED_DOCUMENT_TYPE:415,STORAGE_NOT_CONFIGURED:503,REQUEST_TOO_LARGE:413,INVALID_LIMIT:400,CURRENCY_MISMATCH:400})[e.code]||400;
export function createApiServer({system,bankId,cookieSecure=false}) {
 return http.createServer(async(req,res)=>{const url=parse(req.url,true),path=url.pathname;try{
  if(req.method==='GET'&&path==='/health')return json(res,200,{status:'ok',bankId,x42ApiVersion:'v1',capabilities:['credit-v1','status-v1']});
  if(req.method==='POST'&&path==='/api/v1/auth/register'){const b=await body(req);return json(res,201,await system.auth.register(b));}
  if(req.method==='POST'&&path==='/api/v1/auth/login'){const b=await body(req),s=await system.auth.login(b);return json(res,200,{uid:s.uid,role:s.role,bankId:s.bankId,csrfToken:s.csrfToken,expiresAt:s.expiresAt},{'set-cookie':`bank_session=${encodeURIComponent(s.cookie)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${cookieSecure?'; Secure':''}`});}
  const directoryMatch=path.match(/^\/api\/v1\/directory\/ifsc\/([^/]+)$/);
  if(req.method==='GET'&&directoryMatch){const bank=await system.directory.resolve(decodeURIComponent(directoryMatch[1]));return json(res,200,{bankId:bank.bankId,bankName:bank.bankName,ifsc:bank.ifsc,status:bank.status});}
  if(!path.startsWith('/api/v1/'))return json(res,404,{error:'NOT_FOUND'});
  const token=cookie(req.headers.cookie,'bank_session');
  if(req.method==='POST'&&path==='/api/v1/auth/logout'){const csrf=req.headers['x-csrf-token'];await system.sessions.resolve(token,csrf);await system.sessions.revoke(token);return json(res,200,{revoked:true},{'set-cookie':'bank_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
  if(req.method==='GET'&&path==='/api/v1/interbank/transfers/'){return json(res,400,{error:'TRANSFER_ID_REQUIRED'});}
  if(path.startsWith('/api/v1/x42/')&&['POST /api/v1/x42/debit','POST /api/v1/x42/credit'].includes(`${req.method} ${path}`)){
   const configured=process.env.X42_INTERNAL_TOKEN||'';const supplied=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const a=Buffer.from(configured),b=Buffer.from(supplied);if(!configured||a.length!==b.length||!timingSafeEqual(a,b))return json(res,401,{error:'X42_INTERNAL_AUTH_FAILED'});const bdy=await body(req);if(path.endsWith('/debit'))return json(res,200,await system.x42.debit({transferId:bdy.transferId,idempotencyKey:bdy.idempotencyKey}));return json(res,200,await system.x42.credit(bdy));
  }
  if(path.startsWith('/api/v1/interbank/')){
   if(req.method==='POST'&&path==='/api/v1/interbank/validate'){const b=await body(req);return json(res,200,await system.peers.validateIncoming({headers:req.headers,body:b}));}
   if(req.method==='POST'&&path==='/api/v1/interbank/credits'){const b=await body(req);return json(res,200,await system.peers.receiveCredit({headers:req.headers,body:b}));}
   const m=path.match(/^\/api\/v1\/interbank\/transfers\/([^/]+)$/);if(req.method==='GET'&&m)return json(res,200,await system.peers.peerStatus({headers:req.headers,transferId:decodeURIComponent(m[1])}));
  }
  const context=await system.sessions.resolve(token,req.headers['x-csrf-token'],{requireCsrf:!['GET','HEAD'].includes(req.method)});
  if(req.method==='GET'&&path==='/api/v1/auth/me')return json(res,200,await system.auth.me(context));
  if(req.method==='POST'&&path==='/api/v1/kyc/documents'){if(!system.kycStorage)throw Object.assign(new Error('KYC storage is not configured.'),{code:'STORAGE_NOT_CONFIGURED'});const buffer=await rawBody(req);return json(res,201,await system.kycStorage.upload({uid:context.uid,buffer,contentType:req.headers['content-type']}));}
  const isAdmin=['ADMIN','SUPER_ADMIN'].includes(context.role);
  if (path.startsWith('/api/v1/admin/') && !isAdmin) throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});
  if(req.method==='GET'&&path==='/api/v1/admin/bank-settings'){
   const snap=await system.sharedDb.collection('banks').doc(bankId).get();
   if(!snap.exists)return json(res,200,{bankId,bankName:process.env.BANK_NAME||'RIP Money Bank',ifsc:process.env.BANK_IFSC||null,status:'NOT_REGISTERED',apiConfigured:false,apiVersion:'v1'});
   const d=snap.data();
   return json(res,200,{bankId:d.bankId,bankName:d.bankName,ifsc:d.ifsc,status:d.status,apiConfigured:!!d.apiBaseUrl,apiVersion:d.apiVersion||'v1',environment:d.environment||'configured'});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/dashboard'){
   const names=['users','accounts','transfers','kyc_requests','loans'];
   const snapshots=await Promise.all(names.map(name=>system.db.collection(name).get()));
   const accountDocs=snapshots[1].docs;
   const totalPostedMinor=accountDocs.reduce((sum,d)=>sum+(Number.isSafeInteger(d.data().postedBalanceMinor)?d.data().postedBalanceMinor:0),0);
   const pendingKyc=snapshots[3].docs.filter(d=>['PENDING','HOLD'].includes(d.data().status)).length;
   const pendingLoans=snapshots[4].docs.filter(d=>d.data().status==='PENDING').length;
   return json(res,200,{customers:snapshots[0].docs.filter(d=>d.data().role==='CUSTOMER').length,accounts:accountDocs.length,transfers:snapshots[2].size,kycRequests:snapshots[3].size,pendingKyc,loans:snapshots[4].size,pendingLoans,totalPostedMinor,currency:'INR'});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/customers'){
   const snap=await system.db.collection('users').where('role','==','CUSTOMER').limit(Math.min(Number(url.query.limit)||100,500)).get();
   return json(res,200,{customers:snap.docs.map(d=>({uid:d.id,...d.data(),passwordHash:undefined})).map(({passwordHash,...u})=>u)});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/accounts'){
   const snap=await system.db.collection('accounts').limit(Math.min(Number(url.query.limit)||250,1000)).get();
   return json(res,200,{accounts:snap.docs.map(d=>({accountId:d.id,...d.data()}))});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/transactions'){
   const snap=await system.db.collection('transfers').orderBy('createdAt','desc').limit(Math.min(Number(url.query.limit)||100,500)).get();
   return json(res,200,{transactions:snap.docs.map(d=>({transferId:d.id,...d.data()}))});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/loans'){
   const snap=await system.db.collection('loans').limit(Math.min(Number(url.query.limit)||100,500)).get();
   return json(res,200,{loans:snap.docs.map(d=>({loanId:d.id,...d.data()}))});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/audit-logs'){
   const snap=await system.db.collection('audit_logs').orderBy('createdAt','desc').limit(Math.min(Number(url.query.limit)||100,500)).get();
   return json(res,200,{auditLogs:snap.docs.map(d=>({logid:d.id,...d.data()}))});
  }
  if(req.method==='GET'&&path==='/api/v1/admin/kyc-requests'){if(!isAdmin)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});return json(res,200,{requests:await system.kyc.queue()});}
  let adminMatch=path.match(/^\/api\/v1\/admin\/kyc-requests\/([^/]+)\/documents$/);if(req.method==='GET'&&adminMatch){if(!isAdmin)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});const documentPath=String(url.query.path||'');return json(res,200,await system.kycStorage.documentUrl({requestId:decodeURIComponent(adminMatch[1]),path:documentPath}));}
  adminMatch=path.match(/^\/api\/v1\/admin\/kyc-requests\/([^/]+)$/);if(req.method==='PATCH'&&adminMatch){if(!isAdmin)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});const b=await body(req);return json(res,200,await system.kyc.review({requestId:decodeURIComponent(adminMatch[1]),adminUid:context.uid,decision:b.decision,reason:b.reason}));}
  adminMatch=path.match(/^\/api\/v1\/admin\/limits\/([^/]+)$/);if(req.method==='PATCH'&&adminMatch){if(!isAdmin)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});const b=await body(req);if(!Number.isSafeInteger(b.perTransferMinor)||!Number.isSafeInteger(b.dailyMinor)||b.perTransferMinor<1||b.dailyMinor<b.perTransferMinor)throw Object.assign(new Error('Invalid transfer limits.'),{code:'INVALID_LIMIT'});const limitRef=system.db.collection('transfer_limits').doc(decodeURIComponent(adminMatch[1])),account=await system.db.collection('accounts').doc(decodeURIComponent(adminMatch[1])).get();if(!account.exists)throw Object.assign(new Error('Account not found.'),{code:'ACCOUNT_NOT_FOUND'});const batch=system.db.batch();batch.set(limitRef,{perTransferMinor:b.perTransferMinor,dailyMinor:b.dailyMinor,updatedBy:context.uid,updatedAt:new Date()});const auditRef=system.db.collection('audit_logs').doc();batch.create(auditRef,{logid:auditRef.id,actorUid:context.uid,description:`Transfer limits updated for ${decodeURIComponent(adminMatch[1])}`,createdAt:new Date()});await batch.commit();return json(res,200,{updated:true});}
  if(req.method==='GET'&&path==='/api/v1/accounts'){const s=await system.portfolio.get(context.uid);return json(res,200,{accounts:s.accounts});}
  if(req.method==='GET'&&path==='/api/v1/transactions'){
   const ownedAccounts=await system.db.collection('accounts').where('customerUid','==',context.uid).get();
   const ownedIds=new Set(ownedAccounts.docs.map(d=>d.id));
   const requested=await system.db.collection('transfers').where('requestedByUid','==',context.uid).get();
   const found=new Map(requested.docs.map(d=>[d.id,d]));

   const ids=[...ownedIds];
   for(let i=0;i<ids.length;i+=30){
    const group=ids.slice(i,i+30);
    const matches=await Promise.all([
     system.db.collection('transfers').where('sourceAccountId','in',group).get(),
     system.db.collection('transfers').where('destinationAccountId','in',group).get()
    ]);
    for(const snap of matches){
     for(const d of snap.docs) found.set(d.id,d);
    }
   }

   const transactions=await Promise.all([...found.values()].map(async d=>{
    const t=d.data();
    const outgoing=ownedIds.has(t.sourceAccountId)||t.requestedByUid===context.uid;
    const incoming=ownedIds.has(t.destinationAccountId);

    if(!outgoing&&!incoming)return null;

    const counterpartyId=outgoing?t.destinationAccountId:t.sourceAccountId;
    let counterpartyNumber=null;

    if(counterpartyId){
     const account=await system.db.collection('accounts').doc(counterpartyId).get();
     if(account.exists){
      const number=account.data().accountNumber;
      if(typeof number==='string'&&number.length>=4){
       counterpartyNumber=`****${number.slice(-4)}`;
      }
     }
    }

    return {
     transferId:d.id,
     type:t.type,
     direction:outgoing?'DEBIT':'CREDIT',
     amountMinor:t.amountMinor,
     currency:t.currency,
     status:t.status,
     counterpartyAccount:counterpartyNumber,
     createdAt:t.createdAt,
     completedAt:t.completedAt
    };
   }));

   const limit=Math.min(Number(url.query.limit)||100,250);
   transactions.sort((a,b)=>
    new Date(b?.createdAt?.toDate?.()||b?.createdAt||0)-
    new Date(a?.createdAt?.toDate?.()||a?.createdAt||0)
   );

   return json(res,200,{transactions:transactions.filter(Boolean).slice(0,limit)});
  }
  if(req.method==='GET'&&path==='/api/v1/kyc/status'){
   const snap=await system.db.collection('kyc_requests').where('uid','==',context.uid).limit(10).get();
   return json(res,200,{requests:snap.docs.map(d=>({requestId:d.id,...d.data(),documentPaths:undefined})).map(({documentPaths,...r})=>r)});
  }
  if(req.method==='POST'&&path==='/api/v1/x42/validate'){const b=await body(req);return json(res,200,await system.x42.validate({...b,uid:context.uid}));}
  let m=path.match(/^\/api\/v1\/x42\/transactions\/([^/]+)$/);if(req.method==='GET'&&m){const s=await system.x42.status(decodeURIComponent(m[1]));if(s.requestedByUid!==context.uid)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});return json(res,200,s);}
  m=path.match(/^\/api\/v1\/x42\/balance\/([^/]+)$/);if(req.method==='GET'&&m)return json(res,200,await system.x42.balance(decodeURIComponent(m[1]),context.uid));
  m=path.match(/^\/api\/v1\/accounts\/([^/]+)\/balance$/);if(req.method==='GET'&&m)return json(res,200,await system.x42.balance(decodeURIComponent(m[1]),context.uid));
  if(req.method==='POST'&&path==='/api/v1/transfers/internal'){const b=await body(req);return json(res,201,await system.internalTransfers.transfer({...b,uid:context.uid,idempotencyKey:req.headers['idempotency-key']}));}
  if(req.method==='POST'&&path==='/api/v1/transfers/interbank/validate'){const b=await body(req);return json(res,200,await system.peers.validateDestination({destinationIfsc:b.destinationIfsc,destinationAccountNumber:b.destinationAccountNumber}));}
  if(req.method==='POST'&&path==='/api/v1/transfers/interbank'){const b=await body(req);return json(res,202,await system.peers.sendInterbank({...b,uid:context.uid,idempotencyKey:req.headers['idempotency-key']}));}
  m=path.match(/^\/api\/v1\/transfers\/([^/]+)$/);if(req.method==='GET'&&m){const s=await system.x42.status(decodeURIComponent(m[1]));if(s.requestedByUid!==context.uid)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});return json(res,200,s);}
  if(req.method==='POST'&&path==='/api/v1/beneficiaries'){const b=await body(req);return json(res,201,await system.beneficiaries.create({...b,uid:context.uid}));}
  if(req.method==='GET'&&path==='/api/v1/beneficiaries')return json(res,200,{beneficiaries:await system.beneficiaries.list(context.uid)});
  m=path.match(/^\/api\/v1\/beneficiaries\/([^/]+)$/);if(req.method==='DELETE'&&m)return json(res,200,await system.beneficiaries.remove({uid:context.uid,beneficiaryId:decodeURIComponent(m[1])}));
  if(req.method==='POST'&&path==='/api/v1/loans'){const b=await body(req);return json(res,201,await system.loans.apply({...b,uid:context.uid}));}
  const loanRepayMatch=path.match(/^\/api\/v1\/loans\/([^/]+)\/repay$/);if(req.method==='POST'&&loanRepayMatch){const b=await body(req);return json(res,200,await system.loans.repay({uid:context.uid,loanId:decodeURIComponent(loanRepayMatch[1]),fromAccountId:b.fromAccountId,amountMinor:b.amountMinor,idempotencyKey:req.headers['idempotency-key']}));}
  adminMatch=path.match(/^\/api\/v1\/admin\/loans\/([^/]+)$/);if(req.method==='PATCH'&&adminMatch){if(!isAdmin)throw Object.assign(new Error('Forbidden'),{code:'FORBIDDEN'});const b=await body(req);return json(res,200,await system.loans.decide({loanId:decodeURIComponent(adminMatch[1]),adminUid:context.uid,decision:b.decision,reason:b.reason}));}
  if(req.method==='GET'&&path==='/api/v1/portfolio')return json(res,200,await system.portfolio.get(context.uid));
  return json(res,404,{error:'NOT_FOUND'});
 }catch(e){return json(res,statusFor(e),{error:e.code||'INTERNAL_ERROR',message:e.message});}});
}
