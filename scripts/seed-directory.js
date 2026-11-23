import 'dotenv/config';
import fs from 'node:fs';
import {connectSharedFirebase} from '../src/infra/firebase.js';
import {seedBankDirectory} from '../src/services/bank-registry.js';
const file=process.argv[2]||'shared_db/bank_directory_seed.json';if(!fs.existsSync(file))throw new Error(`Directory seed not found: ${file}. Copy the example and supply verified bank records; do not invent IFSCs or peer URLs.`);
const banks=JSON.parse(fs.readFileSync(file,'utf8'));const {sharedDb}=connectSharedFirebase(process.env);const result=await seedBankDirectory(sharedDb,banks);console.log(JSON.stringify(result,null,2));
