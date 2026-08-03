"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
function v(fd:FormData,k:string){return String(fd.get(k)||"").trim();}
async function requireHrAdmin(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect('/login');const {data:p}=await s.from('profiles').select('app_role').eq('id',user.id).single();if(!['admin','hr'].includes(p?.app_role))throw new Error('HR or Administrator access is required.');return user;}
export async function generateAnnualRota(fd:FormData){
 const user=await requireHrAdmin(); const admin=createAdminClient(); const year=Number(v(fd,'rota_year')); const selected=fd.getAll('employee_ids').map(String).filter(Boolean); const scope=v(fd,'employee_scope')||'all'; const offDays=fd.getAll('off_weekdays').map(Number); const workCode=v(fd,'work_status_code')||'D'; const offCode=v(fd,'off_status_code')||'R';
 if(!year||offDays.length===0)throw new Error('Select a year and at least one weekly OFF day.');
 let q=admin.from('profiles').select('id').eq('employment_status','active'); if(scope==='selected')q=q.in('id',selected); const {data:employees,error:e}=await q; if(e)throw new Error(e.message); if(!employees?.length)throw new Error('No employees matched the selected scope.');
 const start=new Date(Date.UTC(year,0,1)), end=new Date(Date.UTC(year,11,31)); const rows:any[]=[]; for(const emp of employees){for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1)){const js=d.getUTCDay(); const mondayIndex=(js+6)%7; rows.push({employee_id:emp.id,work_date:d.toISOString().slice(0,10),status_code:offDays.includes(mondayIndex)?offCode:workCode,source:'annual_pattern',updated_by:user.id,updated_at:new Date().toISOString()});}}
 for(let i=0;i<rows.length;i+=1000){const {error}=await admin.from('rota_assignments').upsert(rows.slice(i,i+1000),{onConflict:'employee_id,work_date'});if(error)throw new Error(error.message);}
 await admin.from('annual_rota_batches').insert({rota_year:year,name:v(fd,'name')||`${year} Annual Rota`,employee_scope:scope,selected_employee_ids:selected,working_weekdays:[0,1,2,3,4,5,6].filter(x=>!offDays.includes(x)),off_weekdays:offDays,work_status_code:workCode,off_status_code:offCode,created_by:user.id});
 revalidatePath('/year-rota');revalidatePath('/rota');revalidatePath('/dashboard');
}
