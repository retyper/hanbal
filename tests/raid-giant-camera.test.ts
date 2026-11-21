import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as camera from '../src/raid/camera.ts'
import {HAEBI_RUN as C,HAEBI_ZOOM as Z} from '../src/tune/params.ts'
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`)
test('giant framing keeps the whole board centered below1x',()=>{
 assert.deepEqual(camera.clampCenter(.8,0,0),{x:C.width/2,y:C.height/2})
})
test('giant automatic zoom uses the actual camera inverse and preserves the selected level',()=>{
 const cam=camera.newCam(2);camera.followCam(cam,10,700,0,true,.8)
 near(cam.zoom,.8);assert.equal(cam.level,2)
 const native={x:-108,y:-11},px=C.width/2+(native.x-cam.x)*cam.zoom,py=C.height/2+(native.y-cam.y)*cam.zoom
 assert.ok(px>=0&&px<=C.width&&py>=0&&py<=C.height)
 const inverse=camera.toField(cam,px,py);near(inverse.x,native.x);near(inverse.y,native.y)
})
test('actual recorded native bounds and larger broken poses fit without changing world coordinates',()=>{
 assert.equal(typeof camera.bossFrameZoom,'function')
 for(const bounds of [{left:-107.9704,top:-10.7791,right:1227.4805,bottom:633.3728},{left:-240,top:-160,right:1300,bottom:790}]){
  const zoom=camera.bossFrameZoom(bounds,.8),cam=camera.newCam();camera.followCam(cam,20,50,0,true,zoom)
  const view=camera.fieldView(cam);assert.ok(view.left<=bounds.left&&view.right>=bounds.right&&view.top<=bounds.top&&view.bottom>=bounds.bottom)
  assert.ok(view.left<=0&&view.top<=0&&view.right>=C.width&&view.bottom>=C.height)
 }
})
test('ordinary camera still follows the existing selected zoom with no boss override',()=>{
 const cam=camera.newCam(1);camera.followCam(cam,0,0,0,true)
 near(cam.zoom,Z.levels[1]!);assert.deepEqual({x:cam.x,y:cam.y},camera.clampCenter(cam.zoom,0,0))
})
