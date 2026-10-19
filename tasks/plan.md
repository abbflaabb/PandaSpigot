# PandaSpigot open issue implementation plan

Scope: all 33 open issues returned by GitHub on 2026-10-16 at root revision `1afa565`, including feature suggestions explicitly requested by the user. Closed historical issues are not reopened. Each issue is inspected with its discussion and mapped to code or a documented reproduction gap.

## Design and ordering

1. Generate the upstream source trees and establish a build using the existing Gradle wrapper. Preserve the user's wrapper edit.
2. Fix independently reproducible inventory, network, persistence, and coordinate errors. Preserve Bukkit event cancellation semantics and plugin compatibility.
3. Add optional gameplay and performance configuration, with existing behavior as the default. Validate numerical settings and document interactions.
4. Add supported plugin API/build conveniences and an optional source naming workflow. Preserve thin Maven artifacts and original runtime names.
5. Run focused regression tests, the complete test/build tasks, and package all generated-source changes as additional patches. Review each issue against the final implementation.

## Parallel work boundaries

| Module | Responsibility | Dependencies |
| --- | --- | --- |
| build-tools | Source setup, standalone API artifact, reversible mappings | existing build |
| inventory | Item use, custom menus, books, stale attributes | generated sources |
| network | Unix sockets, restart, signs, titles, equipment | generated sources |
| world | Biomes, coordinate calculations, chunk delivery, projectiles | generated sources |
| gameplay | Knockback profiles, regeneration, rods | inventory foundations |
| performance | Tick controls and monitoring | world foundations |

Agents edit disjoint files or explicitly allocated sections. Only the root integrates generated-tree commits and patch export. No upstream GitHub issue is closed or commented on.

## Risks and verification

- Reports with video-only or unspecified reproduction steps require source evidence and explicit verification limits; no speculative behavior change is labelled a verified fix.
- Disabling simulation changes gameplay and must be opt-in. Tick-rate changes must preserve scheduler operation and connection handling.
- Public API additions must compile to Java 8 and retain existing methods and fields where binary compatibility matters.
- Network input is untrusted; bounds must be applied before expensive parsing, without breaking normal clients.
- Final acceptance requires reproducible patches, passing appropriate tests, and an issue-by-issue status report. Known unverified reports remain visible.
