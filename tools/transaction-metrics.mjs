// Cancun intrinsic accounting and Prague calldata floor, no assumed gas price.
export function transactionMetrics(data, gasUsed, creation = false, gasLimit) {
  const bytes = Buffer.from(data.replace(/^0x/u,''),'hex');
  const zeroBytes = [...bytes].filter(x => x === 0).length;
  const nonzeroBytes = bytes.length-zeroBytes;
  const tokens=zeroBytes+4*nonzeroBytes;
  const intrinsicGas=21000+tokens*4+(creation?32000+2*Math.ceil(bytes.length/32):0);
  const eip7623Floor=21000+tokens*10;
  const declaredGasLimit=gasLimit===undefined?null:Number(gasLimit);
  return {calldataBytes:bytes.length,zeroBytes,nonzeroBytes,intrinsicGas,eip7623Floor,gasUsed:Number(gasUsed),declaredGasLimit,netExecutionGas:Number(gasUsed)-intrinsicGas,withinEip7825Ceiling:declaredGasLimit===null?null:Number(gasUsed)<=declaredGasLimit&&declaredGasLimit<=16777216};
}
