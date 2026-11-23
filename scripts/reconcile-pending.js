import 'dotenv/config';
import {connectFirebase} from '../src/infra/firebase.js';
import {createBankSystem} from '../src/services/system.js';
const env=process.env;if(!env.BANK_ID)throw new Error('BANK_ID is required.');let peerSecrets={};try{peerSecrets=JSON.parse(env.PEER_SHARED_SECRETS_JSON||'{}');}catch{throw new Error('PEER_SHARED_SECRETS_JSON must be valid JSON.');}
const {db,sharedDb}=connectFirebase(env);const system=createBankSystem({db,sharedDb,bankId:env.BANK_ID,peerSecrets});console.log(JSON.stringify(await system.peers.reconcilePending({limit:Number(env.RECONCILE_TRANSFER_LIMIT||100)}),null,2));
