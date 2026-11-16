import { z } from 'zod';
import { graphSchema, scenarioSchema, requestSchema, resultSchema } from './schemas';
import type { SimulateRequest } from './types';
import graph from '../mocks/graph.json';
import scenarios from '../mocks/scenarios.json';
import sub from '../mocks/simulate_sub.json';
import water from '../mocks/simulate_water.json';
import dual from '../mocks/simulate_dual.json';
let mock = import.meta.env.VITE_USE_MOCK !== 'false';
export const isMockMode = () => mock;
export const useDemoMode = () => {mock = true;};
const base = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/,'');
async function response<T>(path: string, schema: z.ZodType<T>, fixture: unknown, body?: SimulateRequest): Promise<T> {
 let data: unknown;
 if (mock) {await new Promise(resolve=>setTimeout(resolve,300)); data=fixture;}
 else {
  const res=await fetch(`${base}/api/${path}`,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!res.ok) {const error: unknown=await res.json().catch(()=>null);throw new Error(error && typeof error==='object' && 'detail' in error ? String(error.detail) : `API request failed (${res.status})`);}
  data=await res.json();
 }
 const parsed=schema.safeParse(data);
 if(!parsed.success) {if(import.meta.env.DEV)console.error('API validation:',parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`));throw new Error(`Unexpected API response at ${parsed.error.issues[0]?.path.join('.') || path}.`);}
 return parsed.data;
}
export const getGraph=()=>response('graph',graphSchema,graph);
export const getScenarios=()=>response('scenarios',z.array(scenarioSchema),scenarios);
export async function simulate(req: SimulateRequest) {
 requestSchema.parse(req);
 const ids=[...req.trigger_node_ids].sort().join(',');
 const fixture=ids==='sub1'?sub:ids==='pump1'?water:ids==='sub1,sub2'?dual:undefined;
 if(mock && (!fixture || (req.horizon_minutes!==undefined && req.horizon_minutes!==360))) throw new Error('Demo mode includes three recorded scenarios. Choose a preset, or connect the backend to simulate custom triggers.');
 const result=await response('simulate',resultSchema,fixture,req);
 if([...result.scenario.trigger_node_ids].sort().join(',')!==ids)throw new Error('The API returned results for different trigger nodes.');
 return result;
}
