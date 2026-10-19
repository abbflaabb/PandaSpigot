// Test-only localhost servers. Requires prepared official Via jars; see README.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const audit = path.join(root, 'build/issue-audit/via-provider');
const javaBin = path.join(process.env.JAVA_HOME, 'bin');
const exe = name => path.join(javaBin, name + (process.platform === 'win32' ? '.exe' : ''));
const via512 = path.join(root, 'build/issue-audit/live-server/plugins/ViaVersion-5.12.1.jar');
const classes = path.join(audit, 'fixture-classes');
fs.mkdirSync(classes, { recursive: true });
execFileSync(exe('javac'), ['--release', '17', '-cp', [
  path.join(root, 'PandaSpigot-API/build/libs/pandaspigot-api-1.8.8-R0.1-SNAPSHOT-bundle.jar'), via512
].join(path.delimiter), '-d', classes, path.join(__dirname, 'startup/StartupFixture.java')], { windowsHide: true });
fs.copyFileSync(path.join(__dirname, 'startup/plugin.yml'), path.join(classes, 'plugin.yml'));
const fixture = path.join(audit, 'startup-fixture.jar');
execFileSync(exe('jar'), ['cf', fixture, '-C', classes, '.'], { windowsHide: true });
const addon = path.join(root, 'compatibility/via-ack/build/libs/pandaspigot-via-ack-1.0.1.jar');
const oldAddon = path.join(root, 'build/releases/2026-10-19-r2/PandaSpigotViaAck-1.0.0.jar');
const tests = [
  { name: 'delayed-old', mode: 'delayed', via: via512, addon: oldAddon, enabled: false },
  { name: 'delayed-new', mode: 'delayed', via: via512, addon, enabled: true },
  { name: 'base-provider', mode: 'base', via: via512, addon, enabled: true },
  { name: 'late-enable', mode: 'late', via: via512, addon, enabled: true },
  { name: 'via-5.5.1', mode: 'normal', via: path.join(audit, 'ViaVersion-5.5.1.jar'), addon,
    backwards: path.join(audit, 'ViaBackwards-5.5.1.jar'), enabled: true }
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run(test) {
  const dir = path.join(audit, test.name);
  const plugins = path.join(dir, 'plugins');
  fs.mkdirSync(plugins, { recursive: true });
  fs.rmSync(path.join(dir, 'result.json'), { force: true });
  fs.copyFileSync(test.via, path.join(plugins, 'ViaVersion.jar'));
  fs.copyFileSync(fixture, path.join(plugins, 'StartupFixture.jar'));
  fs.copyFileSync(test.addon, path.join(test.mode === 'late' ? dir : plugins, test.mode === 'late' ? 'addon.jar' : 'ViaAck.jar'));
  if (test.backwards) fs.copyFileSync(test.backwards, path.join(plugins, 'ViaBackwards.jar'));
  fs.writeFileSync(path.join(dir, 'eula.txt'), 'eula=true\n');
  fs.writeFileSync(path.join(dir, 'server.properties'), [
    'server-ip=127.0.0.1', 'server-port=25579', 'online-mode=false', 'view-distance=2',
    'level-type=FLAT', 'generate-structures=false', 'spawn-npcs=false', 'spawn-monsters=false',
    'spawn-animals=false', 'allow-nether=false', 'enable-query=false', 'enable-rcon=false'
  ].join('\n') + '\n');
  const server = spawn(exe('java'), ['-Xms128M', '-Xmx512M', `-Dviaack.test.mode=${test.mode}`,
    `-Dviaack.test.enabled=${test.enabled}`, '-jar',
    path.join(root, 'PandaSpigot-Server/build/libs/pandaspigot-server-1.8.8-R0.1-SNAPSHOT.jar'), 'nogui'],
  { cwd: dir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let log = '', exited = false;
  server.stdout.on('data', data => { log += data; });
  server.stderr.on('data', data => { log += data; });
  server.on('exit', () => { exited = true; });
  server.on('error', error => { log += error.stack; exited = true; });
  try {
    const deadline = Date.now() + 120000;
    while (!exited && !log.includes('STARTUP_VERIFIED') && !log.includes('FIXTURE_FAILED') && Date.now() < deadline) await sleep(100);
    assert(log.includes('STARTUP_VERIFIED'), log.slice(-9000));
    assert(!log.includes('FIXTURE_FAILED'), log.slice(-9000));
    if (!test.enabled) assert(log.includes('ViaVersion ACK provider unavailable'), 'Old addon did not reproduce the reported error');
    if (test.backwards) assert(log.includes('Enabling ViaBackwards v5.5.1'), 'ViaBackwards did not enable');
    const result = { name: test.name, enabled: test.enabled, passed: true,
      verification: log.split(/\r?\n/).find(line => line.includes('STARTUP_VERIFIED')) };
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    if (!exited) server.stdin.write('stop\n');
    const deadline = Date.now() + 15000;
    while (!exited && Date.now() < deadline) await sleep(100);
    if (!exited) server.kill();
    fs.writeFileSync(path.join(dir, 'console.log'), log);
  }
}
(async () => { for (const test of tests) await run(test); })().catch(error => { console.error(error); process.exitCode = 1; });
