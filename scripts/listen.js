import 'dotenv/config';
import {connectFirebase} from '../src/infra/firebase.js';
import {createTransferService} from '../src/services/transfers.js';

const bankCode=(process.env.BANK_CODE||'').toUpperCase();
if(!/^B(?:0[1-9]|[1-4][0-9]|50)$/.test(bankCode)) throw new Error('BANK_CODE must be your assigned B01-B50 code.');
const {db,sharedDb}=connectFirebase();
const service=createTransferService({db,sharedDb,bankCode});
const stop=await service.startListening({onError:(error,transferId)=>{
  console.error(`[${new Date().toISOString()}] Interbank handler error ${transferId||''}:`,error);
}});
console.log(`Interbank Receive/Settle listeners started for ${bankCode}. Keep this process running.`);
const shutdown=()=>{stop();console.log('Interbank listeners stopped.');process.exit(0);};
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
