import 'dotenv/config';
import {createHash} from 'node:crypto';
import {connectFirebase} from '../src/infra/firebase.js';
import {createArgon2PasswordHasher} from '../src/infra/password-hasher.js';
const env=process.env;if(!env.BANK_ID||!env.ADMIN_EMAIL||!env.ADMIN_PASSWORD)throw new Error('BANK_ID, ADMIN_EMAIL and ADMIN_PASSWORD are required.');
const {db}=connectFirebase(env),email=env.ADMIN_EMAIL.trim().toLowerCase(),users=db.collection('users'),emailRef=db.collection('email_registry').doc(createHash('sha256').update(email).digest('hex'));
const found=await users.where('email','==',email).limit(1).get();if(!found.empty){const u=found.docs[0].data();if(u.role!=='ADMIN')throw new Error('Refusing to promote an existing non-admin user.');await emailRef.set({uid:found.docs[0].id,email,createdAt:new Date()},{merge:true});console.log(`Admin already provisioned: ${found.docs[0].id}`);process.exit(0);}
const uid=env.ADMIN_UID||`admin_${env.BANK_ID.toLowerCase()}`,passwordHash=await createArgon2PasswordHasher().hash(env.ADMIN_PASSWORD);
await db.runTransaction(async tx=>{const registry=await tx.get(emailRef);if(registry.exists)throw new Error('Admin email is already reserved in email_registry.');tx.create(emailRef,{uid,email,createdAt:new Date()});tx.create(users.doc(uid),{uid,bankId:env.BANK_ID,fullName:env.ADMIN_NAME||'Bank Administrator',email,passwordHash,role:'ADMIN',status:'ACTIVE',createdAt:new Date()});});
console.log(`Provisioned admin UID: ${uid}`);
