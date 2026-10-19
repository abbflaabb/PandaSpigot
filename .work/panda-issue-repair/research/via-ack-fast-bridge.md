# Triage: fast bridging through ViaVersion to PandaSpigot 1.8.8

Checked 2026-10-19 from the local project and public official sources.

## Issue evidence
- ViaVersion issue #3643 is still marked **Open** on the fetched issue page. Its reported symptom is a just-placed block reverting to air then returning 1–2 ticks later; rapid placements on top of newly placed blocks become blocked/chaotic. The reporter says raising ACK delay to 20 ticks made placement feel smoother but left cancelled placements visible longer (including levitation), and disabling/immediately sending ACKs did not fix it. The issue's reproduction was a 1.19+ client joining a 1.8 server with ViaVersion on the backend. URL: https://github.com/ViaVersion/ViaVersion/issues/3643
- The analyzed user video shows several rapid wool placements, two blocks appearing briefly and disappearing, apparent movement over a ghost block, then a fall/rubber-band to the platform. This strongly matches the symptoms in #3643; it is visual evidence of rollback, not direct evidence of packet ordering.

## Version direction
- ViaVersion's official release page lists 5.12.0 and includes protocol translations involving 1.21.11; this is current enough to connect a modern client to an older server, but its release notes do not claim to fix the ACK-ordering issue. URL: https://github.com/ViaVersion/ViaVersion/releases
- ViaBackwards explicitly describes its direction as older clients connecting to newer servers and states that it requires ViaVersion. Thus ViaBackwards is not required for a 1.21.11 client joining a 1.8.8 backend; ViaVersion handles that direction. URL: https://github.com/ViaVersion/ViaBackwards
- ViaBackwards 5.12.0 release notes mention a different client-side block prediction correction in 26.1 -> 1.21.11, not the 1.21.11 -> 1.8.8 ACK ordering case. URL: https://github.com/ViaVersion/ViaBackwards/releases

## Project state / reproduction limits
- `compatibility/via-ack` contains `OrderedAckSequenceProvider` and an ordering queue that schedules the captured ACK after the backend packet and its main-thread effects. Its unit tests simulate task order, but were not run.
- The plugin currently reports compilation against ViaVersion 5.12.1, while the official GitHub release pages retrieved here list 5.12.0. This API/version discrepancy should be confirmed before installing it against a real ViaVersion JAR.
- No PandaSpigot server JAR or running server was found in the project; 1.21.11 was absent from the default `%APPDATA%\\.minecraft\\versions` folder checked on the Desktop, and port 25565 had no listener. Prior server build attempt is blocked earlier by unresolved Bukkit API classes. A real-client reproduction therefore has not occurred.

## Preliminary assessment
The ACK queue fix is plausible and testable, but cannot yet be called fixed: the upstream report remains open, the local test only verifies modeled ordering, and no ViaVersion+1.21.11 client session has exercised the plugin. A live test must compare baseline and ViaAck under repeated tower placements and confirm both placement acceptance and correction timing.
