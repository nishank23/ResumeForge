import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {Client,validateVectorDatabase} from './local-vector-config.mjs';
const root=process.env.RESUME_FORGE_LOCAL_ROOT;
if(!root)throw new Error('Set RESUME_FORGE_LOCAL_ROOT to the managed local configuration directory.');
const url=validateVectorDatabase(parseEnv(readFileSync(resolve(root,'.local/database.env'),'utf8')).DATABASE_URL);
const client=new Client({connectionString:url.href});
try {
 await client.connect();
 const counts=async()=> (await client.query('SELECT (SELECT count(*)::int FROM "Resume") AS resumes, (SELECT count(*)::int FROM "ResumeVersion") AS versions')).rows[0];
 const before=await counts();
 const result=spawnSync('pnpm',['exec','prisma','migrate','deploy'],{cwd:new URL('../packages/prisma-client/',import.meta.url),env:{...process.env,DATABASE_URL:url.href},encoding:'utf8'});
 if(result.status!==0)throw new Error('Local migration failed. Inspect Prisma diagnostics locally; credentials are not logged.');
 const after=await counts();
 if(before.resumes!==after.resumes||before.versions!==after.versions)throw new Error('Source counts changed unexpectedly.');
 console.log('Local vector migration applied; source resume/version counts unchanged.');
} finally {await client.end();}
