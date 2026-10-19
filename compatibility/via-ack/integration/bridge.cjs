// Run only against the isolated localhost test server created below.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const mc = require('minecraft-protocol');
const data = require('minecraft-data')('1.21.11');
const root = path.resolve(__dirname, '../../..');
const work = path.join(root, 'build/issue-audit/live-server');
const serverJar = path.join(root, 'PandaSpigot-Server/build/libs/pandaspigot-server-1.8.8-R0.1-SNAPSHOT.jar');
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, description, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await sleep(20);
  }
}
fs.mkdirSync(work, { recursive: true });
// Do not leave a stale success result behind if this run fails.
fs.rmSync(path.join(work, 'result.json'), { force: true });
fs.writeFileSync(path.join(work, 'eula.txt'), 'eula=true\n');
fs.writeFileSync(path.join(work, 'server.properties'), [
  'server-ip=127.0.0.1', 'server-port=25577', 'online-mode=false', 'spawn-protection=0',
  'level-name=protocol-test', 'level-type=FLAT', 'generate-structures=false',
  'max-players=8', 'view-distance=3', 'allow-flight=true', 'difficulty=0',
  'spawn-npcs=false', 'spawn-monsters=false', 'spawn-animals=false', 'gamemode=1',
  'enable-query=false', 'enable-rcon=false'
].join('\n') + '\n');
const server = spawn(java, ['-Xms256M', '-Xmx768M', '-jar', serverJar, 'nogui'],
  { cwd: work, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let serverLog = '';
let serverExited = false;
const output = chunk => { serverLog += chunk.toString(); };
server.stdout.on('data', output);
server.stderr.on('data', output);
server.on('exit', () => { serverExited = true; });
const command = text => server.stdin.write(text + '\n');
let client, movement, legacyClient;
const events = [];
let sequence = 0;
let position;
async function place(location, direction, expected, expectedType) {
  const id = ++sequence;
  const start = events.length;
  client.write('block_place', { hand: 0, location, direction, cursorX: 0.5, cursorY: 0.5,
    cursorZ: 0.5, insideBlock: false, worldBorderHit: false, sequence: id });
  return { id, start, expected, expectedType };
}
async function verify(request) {
  await until(() => events.some(e => e.kind === 'ack' && e.sequence === request.id), `ACK ${request.id}`, 10000);
  const ackIndex = events.findIndex(e => e.kind === 'ack' && e.sequence === request.id);
  assert(events.slice(request.start, ackIndex).some(e => e.kind === 'block'
    && e.type === request.expectedType && e.x === request.expected.x
    && e.y === request.expected.y && e.z === request.expected.z),
  `ACK ${request.id} arrived without its authoritative block update`);
}
(async () => {
  try {
    await until(() => serverLog.includes('Done (') || serverExited, 'server startup', 120000);
    assert(!serverExited, serverLog.slice(-7000));
    await until(() => serverLog.includes('Ordered block ACKs enabled') || serverLog.includes('Disabling PandaSpigotViaAck'), 'Via provider startup');
    assert(serverLog.includes('Ordered block ACKs enabled'), serverLog.slice(-7000));
    command('fill -4 63 -4 8 63 8 stone');
    command('fill -4 64 -4 8 70 8 air');
    command('setworldspawn 1 64 -2');
    client = mc.createClient({ host: '127.0.0.1', port: 25577, username: 'BridgeTest', auth: 'offline', version: '1.21.11' });
    client.on('error', error => events.push({ kind: 'error', message: error.message }));
    client.on('kick_disconnect', packet => events.push({ kind: 'kick', packet }));
    client.on('position', packet => {
      position = { x: packet.x, y: packet.y, z: packet.z, yaw: packet.yaw, pitch: packet.pitch,
        flags: { onGround: true, hasHorizontalCollision: false } };
      client.write('teleport_confirm', { teleportId: packet.teleportId });
      client.write('position_look', position);
    });
    client.on('block_change', packet => events.push({ kind: 'block', ...packet.location, type: packet.type }));
    client.on('acknowledge_player_digging', packet => events.push({ kind: 'ack', sequence: packet.sequenceId }));
    await until(() => position, 'modern client login');
    command('op BridgeTest');
    command('tp BridgeTest 1.5 64 -2');
    command('gamemode 1 BridgeTest');
    command('clear BridgeTest');
    command('give BridgeTest wool 64 14');
    movement = setInterval(() => { if (position && client.state === 'play') client.write('position_look', position); }, 50);
    await sleep(700);
    // Terrain around the target is guaranteed loaded only after the client teleport.
    command('fill -4 63 -4 8 63 8 stone');
    command('fill -4 64 -4 8 70 8 air');
    await sleep(250);
    // Burst chained placements: each later packet relies on the block just placed.
    for (let round = 0; round < 20; round++) {
      if (round === 10) {
        command('gamemode 0 BridgeTest');
        await sleep(150);
      }
      command('fill 0 64 0 3 64 0 air');
      await sleep(100);
      const requests = [await place({ x: 0, y: 63, z: 0 }, 1, { x: 0, y: 64, z: 0 }, data.blocksByName.red_wool.defaultState)];
      for (let x = 0; x < 3; x++) {
        requests.push(await place({ x, y: 64, z: 0 }, 5, { x: x + 1, y: 64, z: 0 }, data.blocksByName.red_wool.defaultState));
      }
      for (const request of requests) await verify(request);
    }
    command('gamemode 2 BridgeTest');
    await sleep(150);
    await verify(await place({ x: 3, y: 64, z: 0 }, 5, { x: 4, y: 64, z: 0 }, data.blocksByName.air.defaultState));
    assert.equal(events.filter(e => e.kind === 'error' || e.kind === 'kick').length, 0);
    // A native 1.8.9 client must continue placing blocks without modern ACKs.
    legacyClient = mc.createClient({ host: '127.0.0.1', port: 25577, username: 'LegacyTest', auth: 'offline', version: '1.8.9' });
    let legacyPosition, legacyPlaced = false;
    const tracking = [];
    legacyClient.on('named_entity_spawn', packet => tracking.push({ kind: 'spawn', ...packet }));
    legacyClient.on('entity_equipment', packet => tracking.push({ kind: 'equipment', ...packet }));
    legacyClient.on('entity_destroy', packet => tracking.push({ kind: 'destroy', ...packet }));
    legacyClient.on('position', packet => {
      legacyPosition = packet;
      legacyClient.write('position_look', { x: packet.x, y: packet.y, z: packet.z,
        yaw: packet.yaw, pitch: packet.pitch, onGround: true });
    });
    legacyClient.on('block_change', packet => {
      if (packet.location.x === 0 && packet.location.y === 64 && packet.location.z === 1 && packet.type === (35 << 4 | 14)) legacyPlaced = true;
    });
    legacyClient.on('error', error => events.push({ kind: 'error', message: error.message }));
    await until(() => legacyPosition, 'native client login');
    command('tp LegacyTest 1.5 64 -2');
    command('gamemode 1 LegacyTest');
    command('clear LegacyTest');
    command('give LegacyTest wool 64 14');
    command('setblock 0 64 1 air');
    await sleep(350);
    legacyClient.write('block_place', { location: { x: 0, y: 63, z: 1 }, direction: 1,
      heldItem: { blockId: 35, itemCount: 64, itemDamage: 14 }, cursorX: 8, cursorY: 8, cursorZ: 8 });
    await until(() => legacyPlaced, 'native client placement', 10000);
    // Re-entering tracking range must resend the complete current equipment.
    for (const [slot, item] of [['slot.hotbar.0', 'diamond_sword'], ['slot.armor.feet', 'diamond_boots'],
      ['slot.armor.legs', 'diamond_leggings'], ['slot.armor.chest', 'diamond_chestplate'], ['slot.armor.head', 'diamond_helmet']]) {
      command(`replaceitem entity BridgeTest ${slot} ${item}`);
    }
    await sleep(250);
    const spawn = tracking.find(e => e.kind === 'spawn');
    assert(spawn, 'Observer did not see the other player spawn');
    for (let attempt = 0; attempt < 3; attempt++) {
      const leaving = tracking.length;
      command('tp LegacyTest 400 64 400');
      await until(() => tracking.slice(leaving).some(e => e.kind === 'destroy' && e.entityIds.includes(spawn.entityId)), 'leave tracking range');
      const entering = tracking.length;
      command('tp LegacyTest 1.5 64 -2');
      await until(() => tracking.slice(entering).filter(e => e.kind === 'equipment' && e.entityId === spawn.entityId).length >= 5, 'equipment after re-entering range');
      const received = tracking.slice(entering);
      const spawnIndex = received.findIndex(e => e.kind === 'spawn' && e.entityId === spawn.entityId);
      assert(spawnIndex >= 0, 'Equipment must follow entity spawn');
      for (const [slot, blockId] of [[0, 276], [1, 313], [2, 312], [3, 311], [4, 310]]) {
        assert(received.slice(spawnIndex + 1).some(e => e.kind === 'equipment' && e.entityId === spawn.entityId
          && e.slot === slot && e.item.blockId === blockId), `Missing equipment in slot ${slot}`);
      }
    }
    fs.writeFileSync(path.join(work, 'tracking.json'), JSON.stringify(tracking, null, 2));
    const result = { client: '1.21.11', viaVersion: '5.12.1', chainedPlacements: 80,
      creativeChainedPlacements: 40, survivalChainedPlacements: 40, native189Placements: 1,
      equipmentRetrackingCycles: 3,
      rejectedPlacements: 1, acknowledgements: events.filter(e => e.kind === 'ack').length,
      assertion: 'Authoritative target block update arrived before every corresponding ACK', passed: true };
    fs.writeFileSync(path.join(work, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.stack);
    console.error(JSON.stringify(events.slice(-30)));
    process.exitCode = 1;
  } finally {
    clearInterval(movement);
    if (client) client.end();
    if (legacyClient) legacyClient.end();
    if (!serverExited) command('stop');
    await until(() => serverExited, 'server shutdown', 30000).catch(() => server.kill());
    fs.writeFileSync(path.join(work, 'integration-server.log'), serverLog);
    fs.writeFileSync(path.join(work, 'packets.json'), JSON.stringify(events, null, 2));
  }
})();
