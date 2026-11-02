import {sql} from 'drizzle-orm';
import {db} from '../drizzle';
import {getStorageService} from './storage-service-factory';
export async function abortMediaMultipart(mediaId:string):Promise<void>{
 const result=await db.execute(sql`SELECT s.upload_id,m.object_key FROM media_multipart_sessions s JOIN media m ON m.id=s.media_id WHERE s.media_id=${mediaId}::uuid AND s.state='ACTIVE'`);
 if(!result.rows[0])return;const storage=getStorageService();if(!storage.abortMultipart)throw new Error('Multipart indisponível.');
 await storage.abortMultipart(String(result.rows[0].object_key),String(result.rows[0].upload_id));
 await db.execute(sql`UPDATE media_multipart_sessions SET state='ABORTED' WHERE media_id=${mediaId}::uuid`);
}
