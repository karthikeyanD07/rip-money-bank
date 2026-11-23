export async function writeAudit(db,{actorUid='SYSTEM',action,targetType,targetId,details={}}) {
  await db.collection('audit_logs').add({actorUid,action,targetType,targetId,details,createdAt:new Date()});
}
