import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createHaebi,stepHaebi,choose,type HaebiOpts} from '../src/raid/haebi.ts'
import {botInput,botChoice} from '../src/raid/haebi-replay.ts'
import {startRecord,recInput,recPick,sealInput,replayRaid} from '../src/raid/runlog.ts'
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const baseline=[{"rules": "53B", "state": "8e8cd97585ed43afc74f93a0801a85013fb8b140061f33a9fd432f2b1dd83842", "record": "4bc938736395afbc2841bf464fb1204cca7c70ae4d9843b52baf0e7d52763ea3", "steps": 7200, "picks": 8, "level": 9, "damage": 28830.470162911035}, {"rules": "56A", "state": "cbfdf30a12656ef4b5203c0ff2ac85fc01244108e8d4bbd56114141551e338f2", "record": "78b615718ba8c80e5027918c4a066d12bf92bf56780166a973d70e522c772e04", "steps": 7200, "picks": 8, "level": 9, "damage": 28829.400718776273}, {"rules": "56B", "state": "8f2762e834bd91f62395ad516de4aae3e71f5770f5f9ca4f67b63f54b727bb93", "record": "5facbb30caa32a22c9bd92d23ce041a7df61bd70d08bae7ff1a1928d7ea0110f", "steps": 7200, "picks": 8, "level": 9, "damage": 27990.330222032917}, {"rules": "versionless", "state": "8e8cd97585ed43afc74f93a0801a85013fb8b140061f33a9fd432f2b1dd83842", "record": "79050ffa1df9fe71a19f396fa586021fb12d2bfb32ed086d4ad495e730c10432", "steps": 7200, "picks": 8, "level": 9, "damage": 28830.470162911035}]
for(const expected of baseline)test('55 preserves exact old '+expected.rules+' state/record/replay',()=>{
 const rules=expected.rules,opts:HaebiOpts={stage:'ford',simRules:rules==='versionless'?'53B':rules as NonNullable<HaebiOpts['simRules']>,permanentAwake:true,appearanceAwake:false}
 const run=createHaebi(257,'stage','sword',opts)
 const recorder=startRecord(run,{id:'legacy-55-'+rules,started:'2026-11-21T00:00:00Z',mode:'stage',stage:'ford',hero:'ara',kit:'sword',sprite:'ara',seed:257,opts,from:null})
 for(let i=0;i<60*120;i++){
  while(run.offers.length){const pick=botChoice(run,'storm');choose(run,pick);recPick(recorder,pick)}
  stepHaebi(run,recInput(recorder,{...botInput(run,.5),shortCutin:i%31===0}),1/120)
 }
 const game=sealInput(recorder)
 if(rules==='versionless')Reflect.deleteProperty(game,'rules')
 assert.equal(hash(run),expected.state)
 assert.equal(hash(game),expected.record)
 assert.equal(hash(replayRaid(game)),expected.state)
})


test('55 new run records its separate rule and replays the same ordinary inputs/picks',()=>{
 const opts:HaebiOpts={stage:'ford',simRules:'55-IMUGI',permanentAwake:true,appearanceAwake:false}
 const run=createHaebi(257,'stage','sword',opts),r=startRecord(run,{id:'new55',started:'2026-11-21T00:00:00Z',mode:'stage',stage:'ford',hero:'ara',kit:'sword',sprite:'ara',seed:257,opts,from:null})
 for(let i=0;i<30*120;i++){
  while(run.offers.length){const pick=botChoice(run,'storm');choose(run,pick);recPick(r,pick)}
  stepHaebi(run,recInput(r,{...botInput(run,.5),shortCutin:i%31===0}),1/120)
 }
 const game=sealInput(r),copy=replayRaid(game)
 assert.equal(game.rules,'55-IMUGI');assert.equal(game.opts.simRules,'55-IMUGI')
 assert.ok(copy.giantFlow);assert.equal(hash(copy),hash(run))
})
