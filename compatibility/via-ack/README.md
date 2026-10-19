# PandaSpigot ViaVersion block acknowledgements

Optional compatibility plugin for modern clients (including 1.21.11) on
the patched PandaSpigot 1.8.8 from this repository with ViaVersion installed
**on the backend server**. It requires the core
`NetworkManager.executeAfterQueuedPackets` extension; an upstream server jar
without that extension is not sufficient.
Requires Java 17. Compiles against ViaVersion **5.12.1**; ViaVersion, Bukkit,
and Netty remain provided dependencies and are not included in the plugin jar.
ViaBackwards can remain installed. Proxy-only ViaVersion is not supported.

Build with `./gradlew :pandaspigot-server:assemble :pandaspigot-via-ack:build`.
Stop the server, replace its server jar with
`PandaSpigot-Server/build/libs/pandaspigot-server-1.8.8-R0.1-SNAPSHOT.jar`, then copy
`compatibility/via-ack/build/libs/pandaspigot-via-ack-1.0.1.jar` into the server's
`plugins` directory and restart. Remove the jar and restart to undo the change.
The startup log confirms whether the provider was installed. A different
third-party ACK provider is left in place and this plugin disables itself.

Version 1.0.1 waits for ViaVersion's post-enable callback and provider readiness
for up to 60 seconds, instead of relying on a single delayed attempt. Both the
official base and Bukkit ACK providers are supported after post-enable finishes.
Startup and timeout messages include the actual ViaVersion version; the
ViaBackwards jar name does not identify that version. A timeout reports whether
Via initialized, whether post-enable ran, and the provider class for diagnosis.
If the server is already running the r2 core, only replace the old addon jar.
Use a full server restart, not `/reload`.

ViaVersion's Bukkit ACK provider stores the latest received sequence and sends
it from a delayed Bukkit task. A newer packet can update that sequence before
PandaSpigot has processed the translated packet. This plugin captures each
sequence, waits until the current network pipeline call has returned, queues a
marker in the same FIFO main-thread queue used by inbound PandaSpigot packets,
and places a barrier behind the connection's queued outbound packets. Even
deferred chunk/block packets must become ready and be flushed before the ACK
is sent on that connection's event loop. Cancelled placements
still receive ACKs after the server's correction; closed connections and plugin
shutdown drop pending work. It does not change placement permissions or physics.

Verification on 2026-10-19 used a running server, ViaVersion 5.12.1, and actual
TCP protocol clients. All 80 chained placements (40 Creative, 40 Survival) and
one Adventure-mode rejection delivered the authoritative target block update
before the corresponding ACK. A native 1.8.9 placement also passed, as did three
equipment re-tracking cycles with both clients. The thirteen plugin unit tests and
three native barrier tests cover ordering, interleaving, deferred outbound
packets, cancellation, disconnect, disable, shutdown, and startup transitions.

Real startup regression tests reproduce the old 1.0.0 error by delaying Via's
platform initialization by 40 ticks, then pass with 1.0.1 under the same delay.
They also cover the official base provider, late addon enable, restoration of
the original provider on disable, and startup alongside ViaVersion 5.5.1 and
ViaBackwards 5.5.1. That last check validates plugin startup, not 1.21.11 client
support in ViaVersion 5.5.1. The 1.21.11 protocol test uses ViaVersion 5.12.1.

This establishes packet ordering through the real translation pipeline; it
does not establish that every symptom in a graphical game with arbitrary
minigame/anticheat plugins has the same cause. Verify the supplied video scenario
on the actual server, including latency and low TPS. ViaBackwards was not needed
or installed in the protocol test; the tested route is newer client to 1.8.8.
Plugins that asynchronously hold and later reinject inbound packets require
separate compatibility verification.

See [integration/README.md](integration/README.md) to reproduce the protocol test.

Upstream references:

- [BukkitAckSequenceProvider (5.12.1)](https://github.com/ViaVersion/ViaVersion/blob/5.12.1/bukkit/src/main/java/com/viaversion/viaversion/bukkit/providers/BukkitAckSequenceProvider.java)
- [AckSequenceTask (5.12.1)](https://github.com/ViaVersion/ViaVersion/blob/5.12.1/bukkit/src/main/java/com/viaversion/viaversion/bukkit/tasks/v1_18_2to1_19/AckSequenceTask.java)
