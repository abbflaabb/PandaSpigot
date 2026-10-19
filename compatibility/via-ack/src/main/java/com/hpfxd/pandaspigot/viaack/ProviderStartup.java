package com.hpfxd.pandaspigot.viaack;

import java.util.function.LongSupplier;
import java.util.function.Supplier;

/** Bounded startup polling; a slow platform initialization is not a failure. */
final class ProviderStartup {
    enum Result { WAITING, INSTALLED, FAILED, TIMED_OUT, STOPPED }

    private final Supplier<Result> installer;
    private final LongSupplier clock;
    private final long started;
    private final long timeout;
    private Result result = Result.WAITING;

    ProviderStartup(Supplier<Result> installer, LongSupplier clock, long timeout) {
        this.installer = installer;
        this.clock = clock;
        this.started = clock.getAsLong();
        this.timeout = timeout;
    }

    Result poll() {
        if (result != Result.WAITING) return result;
        result = installer.get();
        if (result == Result.WAITING && clock.getAsLong() - started >= timeout) {
            result = Result.TIMED_OUT;
        }
        return result;
    }

    void stop() {
        result = Result.STOPPED;
    }

    static boolean supportedProvider(String name) {
        return name.equals("com.viaversion.viaversion.bukkit.providers.BukkitAckSequenceProvider")
                || name.equals("com.viaversion.viaversion.protocols.v1_18_2to1_19.provider.AckSequenceProvider");
    }
}
