import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const fields = ['title_en','title_ar','description_en','description_ar','collection','creator','date_taken','date_note','event','people','organizations','location_shown','location_created','keywords_en','keywords_ar','ocr_text','source','copyright_owner','usage_terms','access','physical_location','related_items'];
export const aiFields = ['title_en','title_ar','description_en','description_ar','keywords_en','keywords_ar','ocr_text'];
export function imageInfo(b){
  if(b.length>10*1024*1024) throw Error('Image exceeds 10 MB.');
  if(b.length>=24 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    const width=b.readUInt32BE(16),height=b.readUInt32BE(20);
    if(!width||!height||width*height>100000000)throw Error('Invalid image dimensions.');
    return {mime:'image/png',width,height,extension:'png'};
  }
  if(b[0]===255 && b[1]===216){
    let p=2;
    while(p+4<b.length){
      if(b[p]!==255) break;
      while(b[p]===255)p++;
      const marker=b[p++];
      if(marker===217||marker===218)break;
      if(marker===1||(marker>=208&&marker<=215))continue;
      const len=b.readUInt16BE(p); if(len<2||p+len>b.length)break;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&len>=7){
        const height=b.readUInt16BE(p+3),width=b.readUInt16BE(p+5);
        if(!width||!height||width*height>100000000)throw Error('Invalid image dimensions.');
        return {mime:'image/jpeg',width,height,extension:'jpg'};
      } p+=len;
    }
  } throw Error('Use a valid JPEG or PNG photograph.');
}
export class Archive{
  constructor(dir){this.dir=dir;mkdirSync(path.join(dir,'originals'),{recursive:true});this.db=new DatabaseSync(path.join(dir,'archive.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS photographs(id TEXT PRIMARY KEY, sha TEXT UNIQUE NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, photo_id TEXT, time TEXT, action TEXT, details TEXT);`);}
  list(){return this.db.prepare('SELECT json FROM photographs ORDER BY rowid DESC').all().map(r=>JSON.parse(r.json));}
  get(id){const r=this.db.prepare('SELECT json FROM photographs WHERE id=?').get(id);if(!r)throw Error('Record not found.');return JSON.parse(r.json);}
  log(id,action,details){this.db.prepare('INSERT INTO audit(photo_id,time,action,details) VALUES (?,?,?,?)').run(id,new Date().toISOString(),action,JSON.stringify(details));}
  save(r){this.db.prepare('INSERT INTO photographs(id,sha,json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(r.id,r.sha,JSON.stringify(r));return r;}
  upload(name,base64,context={}){
    if(typeof base64!=='string'||base64.length>14*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Invalid image encoding or size.');
    const b=Buffer.from(base64,'base64'), info=imageInfo(b),sha=createHash('sha256').update(b).digest('hex');
    const found=this.db.prepare('SELECT json FROM photographs WHERE sha=?').get(sha);if(found)return {record:JSON.parse(found.json),duplicate:true};
    const id=randomUUID(),now=new Date().toISOString();
    const r={id,reference_code:`PHOTO-${id.slice(0,8).toUpperCase()}`,sha,filename:String(name).replaceAll('\\','/').split('/').pop().slice(0,200),...info,bytes:b.length,created_at:now,updated_at:now,level:'Item',extent:'1 digital photograph',status:'Draft',revision:1,fields:{},evidence:{}};
    for(const f of fields){r.fields[f]=f==='access'?'Internal':'';r.evidence[f]={status:f==='access'?'System default':'Needs review',source:f==='access'?'Initial policy setting':''};}
    for(const f of ['collection','event','date_taken','creator','source'])if(context[f]){r.fields[f]=String(context[f]).slice(0,5000);r.evidence[f]={status:'User supplied',source:'Batch context'};}
    writeFileSync(path.join(this.dir,'originals',`${id}.${info.extension}`),b,{flag:'wx'});
    this.save(r);this.log(id,'upload',{filename:r.filename,sha});return {record:r,duplicate:false};
  }
  edit(id,values,revision,approve=false){
    const r=this.get(id);if(r.revision!==revision)throw Error('This record changed. Reload it before saving.');
    for(const f of fields){if(values[f]!==undefined && (typeof values[f]!=='string'||values[f].length>15000))throw Error('Invalid field value.');}
    if(values.access!==undefined&&!['Internal','Restricted','Public'].includes(values.access))throw Error('Invalid access label.');
    const changed=[];for(const f of fields)if(values[f]!==undefined && values[f]!==r.fields[f]){changed.push({field:f,previous:r.fields[f],value:values[f]});r.fields[f]=values[f];r.evidence[f]={status:'User supplied',source:'Administrator edit'};}
    if(approve && !(r.fields.title_en||r.fields.title_ar))throw Error('Add a title before approval.');
    if(approve){for(const f of fields)if(r.fields[f])r.evidence[f]={...r.evidence[f],status:'User confirmed'};}
    r.status=approve?'Approved':'Draft';r.revision++;r.updated_at=new Date().toISOString();this.save(r);this.log(id,approve?'approve':'edit',{changed});return r;
  }
  applyAI(id,values,revision,model){const r=this.get(id);if(r.revision!==revision)throw Error('Record edited during analysis; AI output discarded.');let n=0;
    for(const f of aiFields)if(!r.fields[f]&&typeof values[f]==='string'&&values[f].length<=15000&&values[f].trim()){r.fields[f]=values[f].trim();r.evidence[f]={status:'AI suggested',source:`OpenAI / ${model} — image analysis; requires review`};n++;}
    r.status='Draft';r.revision++;r.updated_at=new Date().toISOString();this.save(r);this.log(id,'analyze',{model,fields_filled:n});return r;
  }
  original(r){return readFileSync(path.join(this.dir,'originals',`${r.id}.${r.extension}`));}
  history(id){return this.db.prepare('SELECT time,action,details FROM audit WHERE photo_id=? ORDER BY id DESC').all(id);}
  restore(item){const r=item.record,b=Buffer.from(item.original_base64,'base64'),info=imageInfo(b);
    if(!/^[0-9a-f-]{36}$/.test(r.id)||createHash('sha256').update(b).digest('hex')!==r.sha||info.extension!==r.extension)throw Error('Invalid backup record.');
    if(this.db.prepare('SELECT id FROM photographs WHERE id=? OR sha=?').get(r.id,r.sha))return false;
    writeFileSync(path.join(this.dir,'originals',`${r.id}.${r.extension}`),b,{flag:'wx'});this.save(r);
    for(const a of item.history||[])this.db.prepare('INSERT INTO audit(photo_id,time,action,details) VALUES(?,?,?,?)').run(r.id,a.time,a.action,a.details);
    this.log(r.id,'restore',{});return true;
  }
}
