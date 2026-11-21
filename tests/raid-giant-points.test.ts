import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHaebi,spawnGiant} from '../src/raid/haebi.ts'
import {beginImugiMove} from '../src/raid/imugi.ts'
import {closestPoint,freezeTell} from '../src/raid/giant-core.ts'
function hasReference(value:unknown,target:object,seen=new Set<object>()):boolean{
 if(value===target)return true
 if(value===null||typeof value!=='object'||seen.has(value))return false
 seen.add(value);return Object.values(value).some(v=>hasReference(v,target,seen))
}
test('integration: an ACTUAL HaebiRun target never becomes a motion point reference or circular state',()=>{
 const run=createHaebi(257,'stage','sword',{stage:'ford',simRules:'55-IMUGI'}),e=spawnGiant(run)!,g=e.giant!
 run.x=e.x-200;run.y=e.y;g.phase=3;g.state='recover';g.timer=0
 assert.ok(beginImugiMove(g,e,run,'emerge',1))
 assert.doesNotThrow(()=>JSON.stringify(run))
 assert.deepEqual(Object.keys(g.motion.desiredLanding).sort(),['x','y'])
 assert.notEqual(g.motion.desiredLanding,run)
 assert.equal(hasReference(g,run),false)
 assert.deepEqual(g.motion.desiredLanding,{x:run.x,y:run.y})
})
test('integration: closestPoint returns only coordinates even when the input is inside and has run fields',()=>{
 const run=createHaebi(257,'stage','sword',{stage:'ford',simRules:'55-IMUGI'})
 for(const shape of [{kind:'capsule' as const,from:{x:run.x,y:run.y},to:{x:run.x,y:run.y},radius:20},{kind:'ellipse' as const,center:{x:run.x,y:run.y},rx:20,ry:10,angle:0}]){
  const point=closestPoint(run,shape)
  assert.notEqual(point,run);assert.deepEqual(Object.keys(point).sort(),['x','y']);assert.deepEqual(point,{x:run.x,y:run.y})
 }
})
test('integration: frozen shapes canonicalize every point and omit extra application fields',()=>{
 const run=createHaebi(257,'stage','sword',{stage:'ford',simRules:'55-IMUGI'})
 const shape=freezeTell({kind:'union',shapes:[{kind:'circle',center:run,radius:20},{kind:'capsule',from:run,to:run,radius:3}]})
 assert.equal(shape.kind,'union');if(shape.kind!=='union')throw new Error('union')
 for(const child of shape.shapes){if(child.kind==='circle')assert.deepEqual(Object.keys(child.center).sort(),['x','y']);if(child.kind==='capsule'){assert.deepEqual(Object.keys(child.from).sort(),['x','y']);assert.deepEqual(Object.keys(child.to).sort(),['x','y'])}}
 assert.equal(hasReference(shape,run),false);assert.equal(Object.isFrozen(run),false)
 assert.doesNotThrow(()=>JSON.stringify(shape))
})
