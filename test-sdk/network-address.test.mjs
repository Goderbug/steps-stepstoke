import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isPublicArtifactAddress } from '../sdk/files.mjs';

test('artifact address admission rejects private, mapped and transition IPv6 forms', () => {
  for (const address of [
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:0a00:1',
    '::ffff:192.168.1.1', '::127.0.0.1', '64:ff9b::7f00:1', '64:ff9b:1::a00:1',
    'fc00::1', 'fdff::1', 'fe80::1', 'fec0::1', 'ff02::1', 'fe80::1%eth0',
    '2001::1', '2001:1ff::1', '2001:db8::1', '2002:7f00:1::1', '3fff::1',
    '3fff:fff::1', '4000::1', 'not-an-address', '[::1]'
  ]) assert.equal(isPublicArtifactAddress(address), false, address);
  for (const address of ['2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4001::1']) {
    assert.equal(isPublicArtifactAddress(address), true, address);
  }
});

test('artifact address admission rejects private and special IPv4 ranges', () => {
  for (const address of [
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '100.64.0.1', '100.127.255.254',
    '169.254.169.254', '172.16.0.1', '172.31.255.254', '192.168.1.1', '192.0.0.1',
    '192.0.2.1', '198.18.0.1', '198.19.255.254', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '255.255.255.255'
  ]) assert.equal(isPublicArtifactAddress(address), false, address);
  for (const address of ['1.1.1.1', '8.8.8.8', '100.128.0.1', '172.32.0.1']) {
    assert.equal(isPublicArtifactAddress(address), true, address);
  }
});

test('actual fetch path rejects mapped-private DNS answers before HTTPS and pins public answers', async () => {
  // SourceTextModule runs the actual fetch implementation with synthetic DNS/transport
  // dependencies. A child enables VM modules without changing the default test command.
  const sourceURL = new URL('../sdk/files.mjs', import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import vm from 'node:vm';
    import { readFileSync } from 'node:fs';
    import { isIP } from 'node:net';
    let answers, connection;
    const dependencies = {
      'node:fs/promises': { open() {}, lstat() {}, readdir() {} },
      'node:fs': { constants: {} }, 'node:path': { join() {} },
      'node:dns/promises': { lookup: async () => answers },
      'node:net': { isIP },
      'node:https': { request(options) { connection = options; throw new Error('CHECKED_TRANSPORT'); } },
      './index.mjs': { LIMITS: { document: 65536 }, verifyFile() {} }
    };
    const module = new vm.SourceTextModule(readFileSync(new URL(${JSON.stringify(sourceURL)}), 'utf8'));
    await module.link(async name => {
      const exports = dependencies[name];
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      });
    });
    await module.evaluate();
    for (const candidate of [
      [{address:'::ffff:7f00:1', family:6}],
      [{address:'::ffff:127.0.0.1', family:6}],
      [{address:'fec0::1', family:6}],
      [{address:'64:ff9b::7f00:1', family:6}],
      [{address:'8.8.8.8', family:4}, {address:'::ffff:a00:1', family:6}],
      []
    ]) {
      answers = candidate; connection = undefined;
      await assert.rejects(module.namespace.fetchPublicArtifact('https://artifact.example/file.md',
        {mediaType:'text/markdown'}, {locations:[{origin:'https://artifact.example',pathPrefix:'/'}]}), error => error.code === 'PRIVATE_NETWORK');
      assert.equal(connection, undefined);
    }
    answers = [{address:'2606:4700:4700::1111', family:6}];
    await assert.rejects(module.namespace.fetchPublicArtifact('https://artifact.example/file.md',
      {mediaType:'text/markdown'}, {locations:[{origin:'https://artifact.example',pathPrefix:'/'}]}), /CHECKED_TRANSPORT/);
    assert.equal(connection.hostname, answers[0].address);
    assert.equal(connection.servername, 'artifact.example');
    assert.equal(connection.headers.host, 'artifact.example');
    await new Promise(resolve => connection.lookup('ignored.example', {}, (error, ip, family) => {
      assert.equal(error, null); assert.equal(ip, answers[0].address); assert.equal(family, 6); resolve();
    }));
    console.log('DNS_TRANSPORT_REGRESSIONS_PASS');
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ['--experimental-vm-modules', '--input-type=module', '-e', script], { timeout: 15_000 });
  assert.match(stdout, /DNS_TRANSPORT_REGRESSIONS_PASS/u);
});
