// Insert-only launch sync; existing records are never overwritten.
import {createClient} from '@supabase/supabase-js';
import {NEW_YORK_LOCATIONS} from '../src/data/newYorkLocations.js';
import {PUBLIC_LOCATION_FIELDS} from '../src/lib/venueCatalog.js';
const apply=process.argv.includes('--apply');
const db=createClient(process.env.VITE_SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY,{auth:{persistSession:false}});
const {data,error}=await db.from('locations').select('id,name,slug').gte('id',900000);
if(error)throw new Error(error.code);
const byId=new Map(data.map(r=>[r.id,r]));
for(const r of NEW_YORK_LOCATIONS){if(byId.has(r.id)&&byId.get(r.id).slug!==r.slug)throw new Error('Reserved ID conflict: '+r.id);}
const rows=NEW_YORK_LOCATIONS.filter(r=>!byId.has(r.id)).map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>PUBLIC_LOCATION_FIELDS.includes(k))));
console.log({existing:data.length,newRows:rows.length,apply});
if(apply&&rows.length){const result=await db.from('locations').insert(rows).select('id');if(result.error)throw new Error(JSON.stringify({code:result.error.code,message:result.error.message}));console.log('Inserted',result.data.length);}
