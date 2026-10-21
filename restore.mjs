import readline from 'node:readline';
import {Archive} from './core.mjs';
const archive=new Archive(process.env.DATA_DIR||'./data');let count=0;
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
  if(!line.trim())continue;const item=JSON.parse(line);if(item.format!=='photo-archive-v1')throw Error('Unsupported backup format.');if(archive.restore(item))count++;
}
console.log(`Restored ${count} photographs. Existing records were skipped.`);
