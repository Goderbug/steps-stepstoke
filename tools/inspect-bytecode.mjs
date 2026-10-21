// Disassemble PUSH widths, separating immediate data and unreachable compiler data. Same
// reachability floor as the supplied launch check; this is not a formal control-flow proof.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { keccak256 } from '../vendor/ethers/ethers.mjs';
export function inspect(hex) {
  const bytes=Buffer.from(hex.replace(/^0x/u,''),'hex'); let reachable=true;
  const forbidden=[],instructions=[]; let pushDataBytes=0,unreachableBytes=0;
  for(let pc=0;pc<bytes.length;pc++) {
    const op=bytes[pc]; if(op===0x5b)reachable=true;
    const width=op>=0x60&&op<=0x7f?op-0x5f:0;
    const row={pc,opcode:'0x'+op.toString(16).padStart(2,'0'),reachable};
    if(width){row.immediate='0x'+bytes.subarray(pc+1,pc+1+width).toString('hex');pushDataBytes+=width;}
    if(reachable&&[0xf2,0xf4,0xff].includes(op))forbidden.push(row);
    if(!reachable)unreachableBytes+=1+width;
    instructions.push(row);pc+=width;
    if([0,0x56,0xf3,0xfd,0xfe,0xff].includes(op))reachable=false;
  }
  return {bytes:bytes.length,keccak256:keccak256(hex),forbidden,pushDataBytes,unreachableBytes,instructions};
}
const contracts={};
for(const name of ['RelayEncoder','RelayVerifier','RelayFactory','RelayBranch']) {
  const a=JSON.parse(await readFile(new URL(`../out/${name}.sol/${name}.json`,import.meta.url)));
  assert.equal(Object.keys(a.bytecode.linkReferences??{}).length,0,'No external linked libraries');
  contracts[name]={};
  for(const [label,obj] of [['creation',a.bytecode],['runtime',a.deployedBytecode]]) {
    const r=inspect(obj.object);assert.ok(r.bytes<= (label==='runtime'?24576:49152));
    assert.equal(r.forbidden.length,0,`${name} ${label} forbidden opcode`);
    if(!process.argv.includes('--disassemble')&&!process.argv.includes('--compact-disassembly'))delete r.instructions;
    contracts[name][label]=r;
  }
}
if(process.argv.includes('--compact-disassembly')) {
  console.log('Exact disassembly. Each line is one opcode byte, followed by PUSH immediate data in brackets. Byte offsets are reconstructible from instruction widths; absolute offsets label JUMPDEST. R/U track the supplied reachability floor, not a formal control-flow proof.');
  for(const [name,parts] of Object.entries(contracts))for(const [label,r] of Object.entries(parts)) {
    console.log(`${name} ${label} bytes=${r.bytes} keccak=${r.keccak256} forbidden=${r.forbidden.length}`);
    let previous;
    for(const row of r.instructions) {
      if(previous!==row.reachable){console.log(row.reachable?'R':'U');previous=row.reachable;}
      console.log(row.opcode+(row.immediate?' ['+row.immediate+']':'')+(row.opcode==='0x5b'?' @0x'+row.pc.toString(16):''));
    }
  }
} else console.log(JSON.stringify({rule:'supplied protected reachability scanner, including runtime child',externalLinkedLibraries:0,contracts},null,2));
