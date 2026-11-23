import 'dotenv/config';
import {connectFirebase} from '../src/infra/firebase.js';
import {createBankSystem} from '../src/services/system.js';
import {createApiServer} from '../src/api/server.js';
import {createArgon2PasswordHasher} from '../src/infra/password-hasher.js';
const env=process.env;
if(!env.BANK_ID)throw new Error('BANK_ID is required.');
const {db,sharedDb,storage}=connectFirebase(env);
let peerSecrets={};try{peerSecrets=JSON.parse(env.PEER_SHARED_SECRETS_JSON||'{}');}catch{throw new Error('PEER_SHARED_SECRETS_JSON must be valid JSON.');}
const system=createBankSystem({db,sharedDb,storage,bankId:env.BANK_ID,peerSecrets,passwordHasher:createArgon2PasswordHasher()});
const server=createApiServer({system,bankId:env.BANK_ID,cookieSecure:env.COOKIE_SECURE==='true'||env.NODE_ENV==='production'});
const port=Number(env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`Bank API listening on ${port} for ${env.BANK_ID}`));
