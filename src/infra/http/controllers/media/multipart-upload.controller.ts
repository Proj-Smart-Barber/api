import type {StorageService} from "../../../../domain/application/services/storage-service";
import {z} from 'zod';
import {sql} from 'drizzle-orm';
import {db} from '../../../drizzle';
import {getStorageService} from '../../../storage/storage-service-factory';
import type {Controller} from '../../../../core/infra/controller';
import type {HttpResponse} from '../../../../core/infra/http-response';
const schema=z.object({userId:z.string().uuid(),mediaId:z.string().uuid(),part:z.number().int().min(1).max(20).optional()});
export class MultipartUploadController implements Controller {
 constructor(private action:'start'|'part'|'complete',private adapter:StorageService=getStorageService()){}
 async handle(request:unknown):Promise<HttpResponse>{
  const parsed=schema.safeParse(request);if(!parsed.success)return {statusCode:400,body:{error:'Dados de multipart inválidos.'}};
  const {userId,mediaId,part}=parsed.data;const storage=this.adapter;
  if(!storage.beginMultipart||!storage.signMultipartPart||!storage.listMultipartParts||!storage.finishMultipart)return {statusCode:503,body:{error:'Envio retomável indisponível.'}};
  try{return await db.transaction(async tx=>{
   const result=await tx.execute(sql`SELECT m.object_key,m.mime_type,m.file_size FROM media m WHERE m.id=${mediaId}::uuid AND m.owner_id=${userId}::uuid AND m.status='PENDING' AND m.mime_type IN ('video/mp4','video/quicktime') AND EXISTS(SELECT 1 FROM media_upload_reservations quota WHERE quota.media_id=m.id) AND EXISTS(SELECT 1 FROM membership ms WHERE ms.user_id=m.owner_id AND ms.barbershop_id=m.owner_entity_id AND ms.role='OWNER' AND ms.state='ACTIVE') FOR UPDATE`);
   const item=result.rows[0];if(!item)return {statusCode:403,body:{error:'Upload não autorizado ou encerrado.'}};
   const session=await tx.execute(sql`SELECT upload_id,state,expires_at FROM media_multipart_sessions WHERE media_id=${mediaId}::uuid`);let current=session.rows[0];
   if(current?.state==='COMPLETE')return {statusCode:200,body:{complete:true}};
   if(current&&(current.state!=='ACTIVE'||new Date(String(current.expires_at)).getTime()<=Date.now()))return {statusCode:409,body:{error:'Sessão de upload encerrada.'}};
   const key=String(item.object_key),mime=String(item.mime_type),size=Number(item.file_size);const partSize=5*1024*1024;const partCount=Math.ceil(size/partSize);
   if(size>100*1024*1024||size<=0)return {statusCode:400,body:{error:'Tamanho do vídeo inválido.'}};
   if(!current){
    if(this.action!=='start')return {statusCode:409,body:{error:'Inicie a sessão de upload.'}};
    const uploadId=await storage.beginMultipart!(key,mime);
    try{await tx.execute(sql`INSERT INTO media_multipart_sessions(media_id,upload_id) VALUES(${mediaId}::uuid,${uploadId})`);}catch(error){await storage.abortMultipart?.(key,uploadId);throw error;}
    current={upload_id:uploadId,state:'ACTIVE',expires_at:new Date(Date.now()+86400000)};
   }
   const uploadId=String(current.upload_id);await tx.execute(sql`UPDATE media SET updated_at=NOW() WHERE id=${mediaId}::uuid`);
   if(this.action==='part'){
    if(!part||part>partCount)return {statusCode:400,body:{error:'Parte inválida.'}};
    const expected=Math.min(partSize,size-(part-1)*partSize);const uploadUrl=await storage.signMultipartPart!(key,uploadId,part,expected);return {statusCode:200,body:{uploadUrl}};
   }
   const parts=await storage.listMultipartParts!(key,uploadId);
   if(this.action==='start')return {statusCode:200,body:{partSize,parts,complete:false}};
   if(parts.length!==partCount||parts.some((entry,index)=>entry.part!==index+1||entry.size!==Math.min(partSize,size-index*partSize)))return {statusCode:409,body:{error:'Ainda faltam partes do vídeo.'}};
   await storage.finishMultipart!(key,uploadId,parts);await tx.execute(sql`UPDATE media_multipart_sessions SET state='COMPLETE' WHERE media_id=${mediaId}::uuid`);return {statusCode:200,body:{complete:true}};
  });}catch{return {statusCode:503,body:{error:'Envio interrompido. Tente retomar novamente.'}};}
 }
}
