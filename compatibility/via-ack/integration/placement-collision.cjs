// Real packets through Via and native 1.8.9, targeting the placing player's body.
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const mc = require('minecraft-protocol');
const root = path.resolve(__dirname, '../../..');
const expectedBlocked = process.argv[2] !== 'baseline';
const work = path.join(root, 'build/issue-audit/placement-collision', expectedBlocked ? 'fixed' : 'baseline');
fs.mkdirSync(path.join(work, 'plugins'), { recursive: true });
const javaExe = name => path.join(process.env.JAVA_HOME, 'bin', name + (process.platform === 'win32' ? '.exe' : ''));
const fixtureClasses = path.join(work, 'observer-classes');
fs.mkdirSync(fixtureClasses, { recursive: true });
execFileSync(javaExe('javac'), ['--release', '17', '-cp', path.join(root,
  'PandaSpigot-API/build/libs/pandaspigot-api-1.8.8-R0.1-SNAPSHOT-bundle.jar'), '-d', fixtureClasses,
  path.join(__dirname, 'startup/PlacementObserver.java')], { windowsHide: true });
fs.writeFileSync(path.join(fixtureClasses, 'plugin.yml'), 'name: PlacementObserver\nversion: 1\nmain: integration.PlacementObserver\n');
execFileSync(javaExe('jar'), ['cf', path.join(work, 'plugins/PlacementObserver.jar'), '-C', fixtureClasses, '.'], { windowsHide: true });
for (const [source, name] of [
  ['build/issue-audit/live-server/plugins/ViaVersion-5.12.1.jar', 'ViaVersion.jar'],
  ['compatibility/via-ack/build/libs/pandaspigot-via-ack-1.0.1.jar', 'PandaSpigotViaAck.jar']
]) fs.copyFileSync(path.join(root, source), path.join(work, 'plugins', name));
fs.rmSync(path.join(work, 'result.json'), { force: true });
fs.writeFileSync(path.join(work, 'eula.txt'), 'eula=true\n');
fs.writeFileSync(path.join(work, 'server.properties'), [
  'server-ip=127.0.0.1', 'server-port=25580', 'online-mode=false', 'spawn-protection=0',
  'level-type=FLAT', 'generate-structures=false', 'view-distance=2', 'allow-flight=true',
  'spawn-monsters=false', 'spawn-animals=false', 'spawn-npcs=false', 'gamemode=1', 'allow-nether=false'
].join('\n') + '\n');
const serverJar = process.env.PANDA_TEST_SERVER_JAR || path.join(root,
  'PandaSpigot-Server/build/libs/pandaspigot-server-1.8.8-R0.1-SNAPSHOT.jar');
const server = spawn(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'),
  ['-Xms128M', '-Xmx512M', '-jar', serverJar, 'nogui'],
  { cwd: work, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let log = '', exited = false;
server.stdout.on('data', data => { log += data; });
server.stderr.on('data', data => { log += data; });
server.on('exit', () => { exited = true; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, description) {
  const deadline = Date.now() + 60000;
  while (!test()) {
    if (exited || Date.now() > deadline) throw new Error(description + '\n' + log.slice(-4000));
    await sleep(10);
  }
}
const command = text => server.stdin.write(text + '\n');
let client, movement;
const results = [];
(async () => {
  try {
    await until(() => log.includes('Ordered block ACKs enabled'), 'startup');
    command('fill -4 63 -4 8 63 8 stone');
    command('fill -4 64 -4 8 70 8 air');
    command('setworldspawn 0 64 0');
    for (const version of ['1.21.11', '1.8.9']) {
      const modern = version !== '1.8.9';
      const name = modern ? 'ModernBody' : 'LegacyBody';
      const events = [];
      const data = require('minecraft-data')(version);
      let position;
      client = mc.createClient({ host: '127.0.0.1', port: 25580, username: name, auth: 'offline', version });
      const sendMove = () => {
        if (position && client.state === 'play') client.write('position_look', { ...position,
          ...(modern ? { flags: { onGround: true, hasHorizontalCollision: false } } : { onGround: true }) });
      };
      client.on('position', packet => {
        position = { x: packet.x, y: packet.y, z: packet.z, yaw: packet.yaw, pitch: packet.pitch };
        if (modern) client.write('teleport_confirm', { teleportId: packet.teleportId });
        sendMove();
      });
      client.on('block_change', packet => events.push({ kind: 'block', ...packet.location, type: packet.type }));
      client.on('acknowledge_player_digging', packet => events.push({ kind: 'ack', sequence: packet.sequenceId }));
      client.on('error', error => events.push({ kind: 'error', message: error.message }));
      await until(() => position, 'login');
      movement = setInterval(sendMove, 50);
      command(`gamemode 1 ${name}`);
      command(`clear ${name}`);
      command(`give ${name} wool 64 14`);
      await sleep(200);
      let sequence = 0;
      for (const scenario of [
        { name: 'clear-space-control', feet: 64, target: { x: 2, y: 64, z: 0 }, clicked: { x: 2, y: 63, z: 0 }, face: 1, intersects: false },
        { name: 'feet-overlap', feet: 64, target: { x: 0, y: 64, z: 0 }, clicked: { x: 0, y: 63, z: 0 }, face: 1, intersects: true },
        { name: 'head-overlap', feet: 64, target: { x: 0, y: 65, z: 0 }, clicked: { x: 1, y: 65, z: 0 }, face: 4, intersects: true },
        { name: 'jump-not-clear', feet: 64.9, target: { x: 0, y: 64, z: 0 }, clicked: { x: 0, y: 63, z: 0 }, face: 1, intersects: true },
        { name: 'jump-clear', feet: 65, target: { x: 0, y: 64, z: 0 }, clicked: { x: 0, y: 63, z: 0 }, face: 1, intersects: false }
      ]) {
        command('fill -2 64 -2 2 68 2 air');
        command(`setblock ${scenario.clicked.x} ${scenario.clicked.y} ${scenario.clicked.z} stone`);
        command(`tp ${name} 0.5 ${scenario.feet} 0.5`);
        await sleep(200);
        assert(Math.abs(position.y - scenario.feet) < 0.001, 'Unexpected test position');
        const start = events.length;
        sequence++;
        client.write('block_place', modern
          ? { hand: 0, location: scenario.clicked, direction: scenario.face, cursorX: 0.5, cursorY: 0.5,
            cursorZ: 0.5, insideBlock: false, worldBorderHit: false, sequence }
          : { location: scenario.clicked, direction: scenario.face,
            heldItem: { blockId: 35, itemCount: 64, itemDamage: 14 }, cursorX: 8, cursorY: 8, cursorZ: 8 });
        const targetUpdate = e => e.kind === 'block' && e.x === scenario.target.x && e.y === scenario.target.y && e.z === scenario.target.z;
        await until(() => events.slice(start).some(modern ? e => e.kind === 'ack' && e.sequence === sequence : targetUpdate), scenario.name);
        const received = events.slice(start);
        const updates = received.filter(targetUpdate);
        assert(updates.length, 'Missing target correction');
        const expectedType = expectedBlocked && scenario.intersects ? 0 : modern ? data.blocksByName.red_wool.defaultState : (35 << 4 | 14);
        assert.equal(updates.at(-1).type, expectedType, `${version} ${scenario.name} unexpected placement`);
        if (modern) assert(received.findIndex(targetUpdate) < received.findIndex(e => e.kind === 'ack'), 'ACK preceded correction');
        results.push({ version, scenario: scenario.name, intersects: scenario.intersects,
          actualBlockType: updates.at(-1).type, blocked: updates.at(-1).type === 0 });
      }
      clearInterval(movement);
      client.end();
      await sleep(150);
    }
    fs.writeFileSync(path.join(work, 'result.json'), JSON.stringify({ expectedBlocked, passed: true, results }, null, 2));
    console.log(JSON.stringify({ expectedBlocked, passed: true, results }));
  } finally {
    clearInterval(movement);
    if (client) client.end();
    if (!exited) server.stdin.write('stop\n');
    const deadline = Date.now() + 15000;
    while (!exited && Date.now() < deadline) await sleep(50);
    if (!exited) server.kill();
    fs.writeFileSync(path.join(work, 'console.log'), log);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
