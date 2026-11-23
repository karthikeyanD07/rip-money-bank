import fs from 'node:fs';
import {cert,getApps,initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
function credentialOptions(env,jsonKey,fileKey){
 const options={};
 if(env[jsonKey]) options.credential=cert(JSON.parse(env[jsonKey]));
 else if(env[fileKey]) options.credential=cert(JSON.parse(fs.readFileSync(env[fileKey],'utf8')));
 else if(!env.FIRESTORE_EMULATOR_HOST) options.credential=applicationDefault();
 return options;
}
export function connectStore(env=process.env){
 const projectId=env.X42_FIREBASE_PROJECT_ID;if(!projectId)throw new Error('X42_FIREBASE_PROJECT_ID is required.');
 const appName='x42-central';
 const app=getApps().find(x=>x.name===appName)||initializeApp({projectId,...credentialOptions(env,'X42_SERVICE_ACCOUNT_JSON','X42_SERVICE_ACCOUNT')},appName);
 const db=getFirestore(app,env.X42_FIREBASE_DATABASE_ID||'(default)');
 if(env.FIRESTORE_EMULATOR_HOST)db.settings({host:env.FIRESTORE_EMULATOR_HOST,ssl:false});
 return db;
}
export function connectSharedDirectory(env=process.env){
 const projectId=env.X42_SHARED_FIREBASE_PROJECT_ID;
 if(!projectId) throw new Error('X42_SHARED_FIREBASE_PROJECT_ID is required for the shared bank directory.');
 const appName='x42-shared-directory';
 const app=getApps().find(x=>x.name===appName)||initializeApp({projectId,...credentialOptions(env,'X42_SHARED_SERVICE_ACCOUNT_JSON','X42_SHARED_SERVICE_ACCOUNT')},appName);
 const db=getFirestore(app,env.X42_SHARED_FIREBASE_DATABASE_ID||'(default)');
 if(env.FIRESTORE_EMULATOR_HOST) db.settings({host:env.FIRESTORE_EMULATOR_HOST,ssl:false});
 return db;
}
