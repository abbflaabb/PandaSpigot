# New gameplay and performance controls

PandaSpigot options use **camelCase** in `pandaspigot.yml`. Regeneration is the
exception: its existing section is in **spigot.yml**, as shown in the root README.
Worlds inherit omitted values from `worlds.default`; a named world can override
individual values without resetting all other settings.

## Knockback and fishing rods

```yaml
worlds:
  default:
    defaultKnockbackProfile: default
    knockback:
      enabled: true
      stopSprint: true
      friction: 2.0
      horizontal: 0.4
      vertical: 0.4
      verticalLimit: 0.4000000059604645
      extraHorizontal: 0.5
      extraVertical: 0.1
    knockbackProfiles:
      practice:
        frictionHorizontal: 2.0
        frictionVertical: 2.0
        horizontalMin: 0.38
        horizontalMax: 0.42
        vertical: 0.4
        stopSprint: false
        arrowHorizontal: 1.0
        arrowVertical: 1.0
        snowballHorizontal: 1.0
        snowballVertical: 1.0
        eggHorizontal: 1.0
        eggVertical: 1.0
        rodHorizontal: 1.0
        rodVertical: 1.0
    fishingRod:
      randomTrajectory: true
      launchSpeed: 1.5
      horizontalMultiplier: 1.0
      verticalMultiplier: 1.0
      gravity: 0.03999999910593033
      maximumDistance: 32.0
```

`frictionHorizontal` and `frictionVertical` inherit `friction` when omitted.
Friction, horizontal/vertical and extraHorizontal/extraVertical accept optional
`Min`/`Max` pairs sampled per hit. Values must be finite and nonnegative;
friction must be strictly positive. Named profiles use their own default values
for omitted members. `default` is reserved for the legacy `knockback` section.

`Player.setKnockbackProfile("practice")` selects incoming knockback for that
player. The attacker's `stopSprint` controls their sprint after hitting.
`null` follows the world's default; `"default"` explicitly chooses the legacy
section. Selection lasts for the session. If the selected profile is absent in
a destination world, its default is used. Query names through
`getAvailableKnockbackProfiles()` and the effective name with `getKnockbackProfile()`.
PlayerVelocityEvent cancellation continues to prevent the velocity packet.

## Server tick controls

```yaml
performance:
  tickRate: 20
  hibernateWhenEmpty: false
  idleTickRate: 1
  disableTabListPingUpdates: false
```

Tick rates range from 1 to 20; idleTickRate cannot exceed tickRate. A lower rate
slows gameplay, plugin tick timers and connection housekeeping as well as world
work. Hibernation restores the active rate on the tick after a player joins.
`Bukkit.getMspt()` reports average execution time for the last 100 completed
ticks, excluding waiting (zero before the first completed tick). Turning off
tab-list ping broadcasts preserves keepalives and measured connection latency.

## Per-world simulation controls

All of these default to `false` under `worlds.<name>.performance`:

| Key | Effect |
|---|---|
| `pauseWhenEmpty` | Pause simulation in an empty world; unloading, chunk GC and saving still run. |
| `disableChunkTicking` | Skip random chunk ticks, lightning, ice/snow and chunk lighting maintenance; scheduled block ticks remain separate. |
| `disableTileEntityTicking` | Freeze tile-entity ticks (for example furnaces). |
| `disableWeatherTicking` | Freeze weather timers; existing rain and plugin weather changes remain possible. |
| `disableNaturalLightning` | Disable naturally generated lightning. |
| `disableNaturalMobSpawning` | Disable natural spawn attempts; plugin spawning remains possible. |
| `disableVillagers` | Reject new villagers and freeze existing villagers, preserving their saved data. |
| `disableNonPlayerEntityTicking` | Freeze non-player entity simulation; entities remain visible and collidable. |
| `disableEntityTrackingUpdates` | Stop periodic entity tracking packets; initial spawns/removals still work. |
| `disableFallingBlockPhysics` | Keep falling blocks static and freeze existing falling-block entities. |
| `disableLiquidFlow` | Stop water/lava flow updates. |
| `disableLeafDecay` | Stop leaf decay. |
| `disableRedstoneTicking` | Skip scheduled ticks for repeaters/comparators, torches, lamps, buttons, pressure plates, tripwires and dispensers/droppers. Direct interactions remain possible; updating circuits may be needed after re-enabling. |
| `useFastRandom` | Use xorshift64* for world Random. Requires world reload/restart and changes random outcomes. It is optional and no workload-wide speedup is claimed. |

These controls deliberately change gameplay; enable only those appropriate for
the world. `disableFallingBlockPhysics` is not an automatic fix for unlimited
sand accumulating in cobwebs. Frozen entities are retained, not removed to reclaim memory.

Spigot's **activation range 0 means always active**, so it must not be used as
a way to disable entity ticking. Use `disableNonPlayerEntityTicking` when that
behavior is wanted. The existing dirty-chunk save predicate already skips
unchanged terrain while periodically saving entity-bearing chunks; eliminating
those entity saves would lose changes and is not part of these controls.

## View distance and ViaVersion

`Player.spigot().setViewDistance(-1)` follows the current world's view distance.
Explicit distances are clamped to 3–32 and survive world changes.

Modern block prediction compatibility requires **both** the patched server jar
and the optional [ViaAck plugin](../compatibility/via-ack/README.md), with ViaVersion
on the backend. It is independent of the gameplay/performance settings above.
