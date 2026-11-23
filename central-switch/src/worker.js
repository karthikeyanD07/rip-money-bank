import 'dotenv/config';
import {connectStore,connectSharedDirectory} from './firebase.js';
import {createSwitch} from './switch.js';
const env=process.env;let secrets={};try{secrets=JSON.parse(env.X42_BANK_SECRETS_JSON||'{}')}catch{throw new Error('X42_BANK_SECRETS_JSON must be valid JSON.');}
const db=connectStore(env),directoryDb=connectSharedDirectory(env);const x42=createSwitch({db,directoryDb,bankSecrets:secrets,timeoutMs:Number(env.X42_REQUEST_TIMEOUT_MS||10000),maxAttempts:Number(env.X42_MAX_ATTEMPTS||8),allowLocalHttp:env.NODE_ENV!=='production'});
const poll=Number(env.X42_WORKER_POLL_MS||1000),limit=Number(env.X42_WORKER_CONCURRENCY||10);let stopped=false;
process.on('SIGTERM',()=>{stopped=true});process.on('SIGINT',()=>{stopped=true});
while(!stopped){try{await x42.recoverExpired();const result=await x42.processBatch({limit});if(result.length)console.log(JSON.stringify({event:'batch_processed',count:result.length}));}catch(e){console.error(JSON.stringify({event:'worker_error',code:e.code||'ERROR'}));}await new Promise(r=>setTimeout(r,poll));}
