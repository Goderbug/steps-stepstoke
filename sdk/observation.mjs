// Bounded incremental RPC observations. A cache is a hint and never settles a Branch.
import { readLogs } from './public.mjs';
const tag = n => '0x' + n.toString(16);
const number = h => Number(BigInt(h));
export class EventLogCache {
  constructor({ identity, deploymentBlock, maxBlocksPerRead = 20000, maxLogs = 10000 }) {
    if (typeof identity !== 'string' || !identity || !Number.isSafeInteger(deploymentBlock) || deploymentBlock < 0 || !Number.isInteger(maxBlocksPerRead) || maxBlocksPerRead < 1 || maxBlocksPerRead > 100000) throw new Error('Verified deployment identity and bounded cache required');
    this.identity=identity; this.start=deploymentBlock; this.budget=maxBlocksPerRead; this.maxLogs=maxLogs; this.rows=new Map(); this.inflight=new Map();
  }
  async read(provider,address) {
    const key=`${this.identity}:${address.toLowerCase()}`;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const task=this.sync(provider,key,address); this.inflight.set(key,task);
    try {return await task;} finally {this.inflight.delete(key);}
  }
  async sync(provider,key,address) {
    const head=number(await provider.request({method:'eth_blockNumber',params:[]}));
    let row=this.rows.get(key);
    if (row) {
      const b=await provider.request({method:'eth_getBlockByNumber',params:[tag(row.cursor),false]});
      if (!b || number(b.number)!==row.cursor || b.hash!==row.hash || head<row.cursor) {this.rows.delete(key);row=undefined;}
    }
    const from=row ? row.cursor+1 : this.start;
    if (head<from) return {logs:row?.logs??[],complete:true,cursor:row?.cursor??head,head};
    const to=Math.min(head,from+this.budget-1);
    const boundary=await provider.request({method:'eth_getBlockByNumber',params:[tag(to),false]});
    if (!boundary || number(boundary.number)!==to) throw new Error('Wrong RPC boundary block');
    const added=await readLogs(provider,{address,fromBlock:from,toBlock:to,maxBlocks:this.budget});
    const checked=await provider.request({method:'eth_getBlockByNumber',params:[tag(to),false]});
    if (!checked || checked.hash!==boundary.hash) throw new Error('Reorg during log observation; retry read');
    const logs=[...(row?.logs??[]),...added.filter(l=>!l.removed)].sort((a,b)=>number(a.blockNumber)-number(b.blockNumber)||number(a.logIndex)-number(b.logIndex));
    if (logs.length>this.maxLogs) throw new Error('Event cache capacity reached; use a narrower explicit history export');
    row={cursor:to,hash:boundary.hash,logs}; this.rows.set(key,row);
    return {logs,complete:to===head,cursor:to,head};
  }
}
export async function observeTransaction(provider, hash, { confirmations = 12 } = {}) {
  if (!/^0x[0-9a-f]{64}$/iu.test(hash) || !Number.isInteger(confirmations) || confirmations<1 || confirmations>256) throw new Error('Original transaction hash/finality required');
  const receipt=await provider.request({method:'eth_getTransactionReceipt',params:[hash]});
  if (!receipt) return {state:'PENDING_OR_UNKNOWN',hash,settlement:false};
  if (receipt.transactionHash && receipt.transactionHash.toLowerCase()!==hash.toLowerCase()) throw new Error('Receipt hash mismatch');
  const at=number(receipt.blockNumber);
  const [b,head]=await Promise.all([provider.request({method:'eth_getBlockByNumber',params:[tag(at),false]}),provider.request({method:'eth_blockNumber',params:[]})]);
  if (!b || number(b.number)!==at || b.hash.toLowerCase()!==receipt.blockHash.toLowerCase()) return {state:'REORGED',hash,settlement:false};
  const depth=number(head)-at+1;
  return {state:depth<confirmations?'MINED_UNFINALIZED':BigInt(receipt.status)===1n?'CONFIRMED':'REVERTED',hash,confirmations:depth,required:confirmations,receipt,settlement:false};
}
