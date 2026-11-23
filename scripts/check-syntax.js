import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.js')){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0){process.stderr.write(r.stderr);process.exitCode=1;}}}}
walk('src');walk('scripts');walk('tests');
if(!process.exitCode) console.log('All JavaScript files passed syntax checks.');
