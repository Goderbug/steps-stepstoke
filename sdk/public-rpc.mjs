// Anonymous read transport only. The optional policy is an inventoried export asset,
// separate from the unchanged official network object. It cannot authorize a wallet action.
export const PUBLIC_RPC_POLICY_ASSET = 'public-read-transport.json';
export const DEFAULT_PUBLIC_RPC_URLS = Object.freeze(['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org']);
const READ_METHODS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_call', 'eth_getCode', 'eth_getBlockByNumber', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getTransactionCount', 'eth_getLogs', 'debug_traceTransaction']);
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export function publicRpcURL(value) {
  let u; try { u = new URL(value); } catch { throw new Error('Public RPC must use credential-free HTTPS'); }
  // No credentials, query tokens, fragments, loopback/private IPv4 or literal IPv6.
  const h = u.hostname.toLowerCase(), ip = h.split('.').map(Number);
  const privateIP = /^\d+\.\d+\.\d+\.\d+$/u.test(h) && (ip[0] === 0 || ip[0] === 10 || ip[0] === 127 || ip[0] >= 224 || (ip[0] === 169 && ip[1] === 254) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) || (ip[0] === 192 && ip[1] === 168));
  if (typeof value !== 'string' || u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.includes(':') || privateIP) throw new Error('Public RPC must use credential-free HTTPS');
  return u.href;
}

export function validatePublicRpcPolicy(policy) {
  if (!policy || Object.keys(policy).sort().join(',') !== 'chainId,rpcUrls,version' || policy.version !== 1 || policy.chainId !== 1 || !Array.isArray(policy.rpcUrls) || policy.rpcUrls.length < 1 || policy.rpcUrls.length > 3) throw new Error('Invalid public read transport policy');
  const rpcUrls = policy.rpcUrls.map(publicRpcURL);
  if (new Set(rpcUrls).size !== rpcUrls.length) throw new Error('Duplicate public RPC endpoint');
  return Object.freeze({ version: 1, chainId: 1, rpcUrls: Object.freeze(rpcUrls) });
}

export function defaultPublicRpcPolicy(primary = DEFAULT_PUBLIC_RPC_URLS[0]) {
  const rpcUrls = [...new Set([publicRpcURL(primary), ...DEFAULT_PUBLIC_RPC_URLS.map(publicRpcURL)])];
  return validatePublicRpcPolicy({ version: 1, chainId: 1, rpcUrls });
}

class AvailabilityError extends Error {}
function unavailableRPC(error) {
  // Providers sometimes wrap execution reverts in an "internal" error, including
  // nested data. Do not retry these against a provider that may return another state.
  if (/\brevert(?:ed)?\b|\bout of gas\b|\binvalid (?:params|argument)\b/iu.test(JSON.stringify(error))) return false;
  return [-32601, -32004, -32005].includes(error?.code)
    || (error?.code === -32000 && /missing trie node|historical state|archive (?:node|access|request)|rate limit|timed? out|method .*not (?:supported|available)/iu.test(error.message ?? ''));
}

export function createPublicReadProvider({ rpcUrls = DEFAULT_PUBLIC_RPC_URLS, fetch: fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  const policy = validatePublicRpcPolicy({ version: 1, chainId: 1, rpcUrls });
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) throw new Error('Invalid bounded public RPC transport');
  const checked = new Set(), preferred = new Map(); let id = 0;
  async function requestOne(url, method, params) {
    const requestId = ++id, body = JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params });
    if (new TextEncoder().encode(body).length > 1024 * 1024) throw new Error('Public RPC request too large');
    let response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body,
        credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) { throw new AvailabilityError(`Public RPC network unavailable: ${e?.name ?? 'Error'}`); }
    if (response.redirected) throw new Error('Public RPC redirect refused');
    const httpUnavailable = () => new AvailabilityError(`Public RPC HTTP ${response.status}`);
    const reader = response.body?.getReader(); if (!reader) throw response.ok ? new Error('Malformed public RPC response') : httpUnavailable();
    const chunks = []; let size = 0;
    for (;;) {
      let part; try { part = await reader.read(); } catch { throw new AvailabilityError('Public RPC response interrupted'); }
      if (part.done) break; size += part.value.length;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Public RPC response too large'); }
      chunks.push(part.value);
    }
    const raw = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.length; }
    let result; try { result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { throw response.ok ? new Error('Malformed public RPC response') : httpUnavailable(); }
    // A plain proxy/HTTP availability response can fall back. A JSON-RPC response,
    // including one sent with HTTP 500, must still pass identity and semantic checks.
    const rpcEnvelope = result && typeof result === 'object' && ['jsonrpc','id','result'].some(k => Object.hasOwn(result,k))
      || typeof result?.error?.code === 'number';
    if (!response.ok && !rpcEnvelope) throw httpUnavailable();
    if (!result || result.jsonrpc !== '2.0' || result.id !== requestId || (Object.hasOwn(result, 'result') === Object.hasOwn(result, 'error'))) throw new Error('Public RPC response identity mismatch');
    if (Object.hasOwn(result, 'error')) {
      if (!result.error || typeof result.error !== 'object' || !Number.isInteger(result.error.code) || typeof result.error.message !== 'string') throw new Error('Malformed public RPC error');
      // PublicNode's historical reads use a valid -32602 envelope with HTTP 403 for
      // archive-tier access. That explicit availability response is not an EVM revert.
      if (response.status === 403 && result.error.code === -32602 && /^Archive requests require a personal token\b/iu.test(result.error.message) && !/\brevert(?:ed)?\b/iu.test(JSON.stringify(result.error))) throw httpUnavailable();
      if (unavailableRPC(result.error)) throw new AvailabilityError(`Public RPC method unavailable: ${method}`);
      throw new Error(`${method}: ${result.error.message ?? 'RPC request rejected'}`);
    }
    if (!response.ok) throw new Error(`Public RPC result returned with HTTP ${response.status}`);
    return result.result;
  }
  return {
    rpcUrls: policy.rpcUrls,
    async request({ method, params = [] }) {
      if (!READ_METHODS.has(method) || !Array.isArray(params)) throw new Error('Read-only public RPC method required');
      if (method === 'debug_traceTransaction' && (params.length !== 2 || params[1]?.tracer !== 'callTracer' || Object.keys(params[1]).some(k => k !== 'tracer'))) throw new Error('Only the deployment callTracer read is supported');
      const first = preferred.get(method), urls = first ? [first, ...policy.rpcUrls.filter(u => u !== first)] : policy.rpcUrls;
      const failures = [];
      for (const url of urls) {
        try {
          let chain;
          if (!checked.has(url) || method === 'eth_chainId') {
            chain = await requestOne(url, 'eth_chainId', []);
            if (chain !== '0x1') throw new Error('Wrong chain; no implicit switch');
            checked.add(url);
          }
          const value = method === 'eth_chainId' ? chain : await requestOne(url, method, params);
          // Null, empty code and malformed semantic results are returned to the verifier.
          // Never shop other endpoints for a result that happens to pass verification.
          preferred.set(method, url); return value;
        } catch (e) {
          if (!(e instanceof AvailabilityError)) throw e;
          checked.delete(url); failures.push(`${url}: ${e.message}`);
        }
      }
      throw new Error(`Public RPC unavailable for ${method}; ${failures.join('; ')}`);
    }
  };
}
