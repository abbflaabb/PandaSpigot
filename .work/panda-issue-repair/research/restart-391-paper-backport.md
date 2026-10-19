# Issue #391 research note

- Issue: `The custom message from /restart was not sent`; body reports the client receives `Server closed` and points to a Paper backport.
- Source patch: [Paper archive patch 0206](https://raw.githubusercontent.com/PaperMC/Paper-archive/ver/1.12.2/Spigot-Server-Patches/0206-Properly-handle-async-calls-to-restart-the-server.patch)
- Source commit: `46b3f0b41023c5857dd0af9997e4f44570c9bedc` (patch subject: “Properly handle async calls to restart the server”).
- Relevant upstream behavior: use an immutable player snapshot while disconnecting; distinguish server-thread shutdown from watchdog/async calls; route async shutdown through `safeShutdown(isRestarting)`; preserve restart-versus-shutdown message when PlayerList closes remaining connections; wait for safe shutdown and use the existing forced-stop fallback only if it does not complete.
- Adapted implementation in this project: `RestartCommand`, `MinecraftServer`, and `PlayerList`. The synchronous route also marks restart state after firing kick events so a plugin-cancelled kick cannot revert to the default shutdown reason.
- Validation limitation: this worktree's full test tasks remain blocked by existing API test compilation errors; see `tasks/todo.md` and the final report for current status.
