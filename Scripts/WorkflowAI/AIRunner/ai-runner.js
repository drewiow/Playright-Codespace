import { plan } from './planner.js';
import { executePlan } from './engine.js';

const request = process.argv.slice(2).join(' ');

const executionPlan = await plan(request);

console.log('Plan:');
console.log(JSON.stringify(executionPlan, null, 2));

await executePlan(executionPlan);