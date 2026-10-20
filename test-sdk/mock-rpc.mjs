// Test-only EIP-1193 stand-in. It models the one interface the SDK accepts for optional reads;
// it does not model an Intake, token, wallet, transaction pool, signer, or deployed contracts.
export class MockReadProvider {
  constructor(result) {
    this.result = result;
    this.calls = [];
  }

  async request(request) {
    this.calls.push(request);
    if (request.method !== 'eth_call') throw new Error('MockReadProvider permits eth_call only');
    return this.result;
  }
}
