import 'dotenv/config';
import {connectFirebase} from '../src/infra/firebase.js';
import {createNotificationOutboxService} from '../src/services/outbox.js';
const env=process.env;let nodemailer;try{nodemailer=await import('nodemailer');}catch{throw new Error('Install Nodemailer before processing email events: npm install nodemailer');}
if(!env.SMTP_HOST||!env.SMTP_FROM)throw new Error('SMTP_HOST and SMTP_FROM are required.');
const {db}=connectFirebase(env);const transport=nodemailer.default.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||587),secure:env.SMTP_SECURE==='true',auth:env.SMTP_USER?{user:env.SMTP_USER,pass:env.SMTP_PASSWORD}:undefined});
const worker=createNotificationOutboxService({db,transport:{sendMail:message=>transport.sendMail({...message,from:env.SMTP_FROM})}});
console.log(JSON.stringify(await worker.process(),null,2));
