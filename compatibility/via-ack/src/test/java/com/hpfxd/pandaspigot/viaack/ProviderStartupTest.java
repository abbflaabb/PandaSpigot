package com.hpfxd.pandaspigot.viaack;

import java.util.concurrent.TimeUnit;
import org.junit.Test;
import static org.junit.Assert.*;

public class ProviderStartupTest {
    private long now;
    private int attempts;
    private boolean ready;

    private ProviderStartup startup() {
        return new ProviderStartup(() -> {
            attempts++;
            return ready ? ProviderStartup.Result.INSTALLED : ProviderStartup.Result.WAITING;
        }, () -> now, TimeUnit.SECONDS.toNanos(60));
    }

    @Test
    public void waitsForDelayedInitializationAndInstallsOnlyOnce() {
        ProviderStartup startup = startup();
        for (int tick = 0; tick < 40; tick++) {
            now += TimeUnit.MILLISECONDS.toNanos(50);
            assertEquals(ProviderStartup.Result.WAITING, startup.poll());
        }
        ready = true;
        assertEquals(ProviderStartup.Result.INSTALLED, startup.poll());
        assertEquals(ProviderStartup.Result.INSTALLED, startup.poll());
        assertEquals(41, attempts);
    }

    @Test
    public void timesOutByElapsedTimeEvenWhenServerTicksAreSlow() {
        ProviderStartup startup = startup();
        assertEquals(ProviderStartup.Result.WAITING, startup.poll());
        now = TimeUnit.SECONDS.toNanos(61);
        assertEquals(ProviderStartup.Result.TIMED_OUT, startup.poll());
        ready = true;
        assertEquals(ProviderStartup.Result.TIMED_OUT, startup.poll());
        assertEquals(2, attempts);
    }

    @Test
    public void disablingWhileWaitingPreventsLaterInstallation() {
        ProviderStartup startup = startup();
        startup.poll();
        startup.stop();
        ready = true;
        assertEquals(ProviderStartup.Result.STOPPED, startup.poll());
        assertEquals(1, attempts);
    }

    @Test
    public void foreignProviderFailureIsTerminal() {
        ProviderStartup startup = new ProviderStartup(() -> {
            attempts++;
            return ProviderStartup.Result.FAILED;
        }, () -> now, TimeUnit.SECONDS.toNanos(60));
        assertEquals(ProviderStartup.Result.FAILED, startup.poll());
        assertEquals(ProviderStartup.Result.FAILED, startup.poll());
        assertEquals(1, attempts);
    }

    @Test
    public void acceptsBothOfficialProvidersButNotThirdPartyReplacements() {
        assertTrue(ProviderStartup.supportedProvider("com.viaversion.viaversion.protocols.v1_18_2to1_19.provider.AckSequenceProvider"));
        assertTrue(ProviderStartup.supportedProvider("com.viaversion.viaversion.bukkit.providers.BukkitAckSequenceProvider"));
        assertFalse(ProviderStartup.supportedProvider("example.CustomAckSequenceProvider"));
    }
}
