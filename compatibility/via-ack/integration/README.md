# Real protocol regression test

Requires Java 17, Node.js, the built server/addon jars, and ViaVersion 5.12.1.
The harness creates an isolated offline test world bound to **127.0.0.1:25577**
under `build/issue-audit/live-server`. It writes `eula=true` for that test server;
run it only if you accept the Minecraft EULA. It never uses a production world.

From the repository root:

1. Build `:pandaspigot-server:assemble :pandaspigot-via-ack:build`.
2. Place [ViaVersion 5.12.1](https://github.com/ViaVersion/ViaVersion/releases/tag/5.12.1)
   and `compatibility/via-ack/build/libs/pandaspigot-via-ack-1.0.1.jar` in
   `build/issue-audit/live-server/plugins/`.
3. Run `npm install --prefix compatibility/via-ack/integration --ignore-scripts`.
4. Set `JAVA_HOME` to a Java 17+ installation and run
   `node compatibility/via-ack/integration/bridge.cjs`.

The server stops in a `finally` block. Results, packet order, equipment packets,
and server logs are written in that test directory. A nonzero exit status means
the test failed; an old `result.json` is not evidence of a subsequent passing run.
The client library version is pinned in `package.json`.

Scenarios: 40 Creative and 40 Survival chained placements, one rejected
Adventure placement, one native 1.8.9 placement, and three cycles in which the
native observer leaves/enters tracking range and receives all five equipment slots.

## Startup regression

`node compatibility/via-ack/integration/startup.cjs` compiles a test-only Bukkit
fixture and runs isolated servers on **127.0.0.1:25579**, with outputs under
`build/issue-audit/via-provider/`. Requires `JAVA_HOME` pointing to a JDK 17+,
the built API bundle and core, ViaVersion 5.12.1 at the bridge-test location
above, and official ViaVersion/ViaBackwards 5.5.1 jars in the output directory.
The historical 1.0.0 addon is read from
`build/releases/2026-10-19-r2/PandaSpigotViaAck-1.0.0.jar` for the negative test.
It also writes `eula=true` only for these isolated test servers.

The fixture postpones Via's real platform initialization by 40 ticks, verifies
that 1.0.0 reproduces the reported error and 1.0.1 installs, checks the official
base provider and late enable paths, and verifies original provider restoration.
The final case starts ViaVersion and ViaBackwards 5.5.1 together. It does not
test 1.21.11 support in that old ViaVersion release. Never install the fixture
on a production server: delaying Via's tasks is deliberate test instrumentation.
