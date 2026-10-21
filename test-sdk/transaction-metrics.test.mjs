import test from 'node:test';
import assert from 'node:assert/strict';
import {transactionMetrics} from '../tools/transaction-metrics.mjs';
test('network gas ceiling applies to declared gas limit even when receipt usage is small',()=>{
 assert.equal(transactionMetrics('0x',21000,false,30000000).withinEip7825Ceiling,false);
 assert.equal(transactionMetrics('0x',21000,false,16777216).withinEip7825Ceiling,true);
});
test('intrinsic accounting preserves zero/nonzero calldata and creation word charges',()=>{
 const call=transactionMetrics('0x0001',21050,false,22000);
 assert.equal(call.zeroBytes,1);assert.equal(call.nonzeroBytes,1);assert.equal(call.intrinsicGas,21020);assert.equal(call.eip7623Floor,21050);
 assert.equal(transactionMetrics('0x0001',100000,true,100000).intrinsicGas,53022);
});
