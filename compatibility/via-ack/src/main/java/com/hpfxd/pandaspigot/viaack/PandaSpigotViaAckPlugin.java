package com.hpfxd.pandaspigot.viaack;

import com.viaversion.viaversion.api.Via;
import com.viaversion.viaversion.protocols.v1_18_2to1_19.provider.AckSequenceProvider;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

public final class PandaSpigotViaAckPlugin extends JavaPlugin {
    private volatile boolean active;
    private AckSequenceProvider original;
    private OrderedAckSequenceProvider replacement;
    private ProviderStartup startup;
    private BukkitTask startupTask;
    private boolean viaPostEnabled;
    private java.util.function.BiConsumer<com.viaversion.viaversion.api.connection.UserConnection, Runnable> outboundQueue;

    @Override
    public void onEnable() {
        try {
            if (!getServer().getName().equals("PandaSpigot") || !getServer().getBukkitVersion().startsWith("1.8.8-")) {
                throw new IllegalStateException("This compatibility plugin requires PandaSpigot 1.8.8");
            }
            final Object minecraftServer = getServer().getClass().getMethod("getServer").invoke(getServer());
            final Method postToMainThread = minecraftServer.getClass().getMethod("postToMainThread", Runnable.class);
            Class<?> networkManager = Class.forName(minecraftServer.getClass().getPackage().getName() + ".NetworkManager");
            final Method afterPackets = networkManager.getMethod("executeAfterQueuedPackets", Runnable.class);
            outboundQueue = (connection, task) -> {
                Object handler = connection.getChannel().pipeline().get("packet_handler");
                if (!networkManager.isInstance(handler)) {
                    throw new IllegalStateException("Native PandaSpigot packet handler is unavailable");
                }
                try {
                    afterPackets.invoke(handler, task);
                } catch (IllegalAccessException | InvocationTargetException exception) {
                    throw new IllegalStateException("Could not queue acknowledgement after block updates", exception);
                }
            };
            Executor mainThread = task -> {
                try {
                    postToMainThread.invoke(minecraftServer, task);
                } catch (IllegalAccessException | InvocationTargetException exception) {
                    throw new IllegalStateException("Could not queue PandaSpigot acknowledgement", exception);
                }
            };
            startup = new ProviderStartup(() -> install(mainThread), System::nanoTime, TimeUnit.SECONDS.toNanos(60));
            try {
                // Via's platform loader installs Bukkit providers during post-enable,
                // after protocol initialization. Installing earlier can be overwritten.
                Via.getManager().addPostEnableListener(() -> {
                    if (!isEnabled()) return;
                    viaPostEnabled = true;
                    getServer().getScheduler().runTask(this, this::pollStartup);
                });
            } catch (NullPointerException alreadyPostEnabled) {
                // ViaVersion 5.x clears this listener list after running it. This is
                // its behavior when an addon is enabled after post-enable completed.
                viaPostEnabled = true;
            }
            startupTask = getServer().getScheduler().runTaskTimer(this, this::pollStartup, 1L, 1L);
            getLogger().info("Waiting for ViaVersion " + Via.getPlatform().getPluginVersion() + " to finish initialization");
        } catch (ReflectiveOperationException | LinkageError | RuntimeException failure) {
            getLogger().log(Level.SEVERE, "Cannot install ordered ACK support; use PandaSpigot 1.8.8 and compatible ViaVersion", failure);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    private void pollStartup() {
        if (!isEnabled() || startup == null) return;
        try {
            ProviderStartup.Result result = startup.poll();
            if (result == ProviderStartup.Result.WAITING) return;
            if (startupTask != null) startupTask.cancel();
            if (result == ProviderStartup.Result.TIMED_OUT) {
                AckSequenceProvider provider = Via.getManager().getProviders().get(AckSequenceProvider.class);
                getLogger().severe("ViaVersion ACK initialization timed out after 60 seconds: ViaVersion="
                        + Via.getPlatform().getPluginVersion() + ", initialized=" + Via.getManager().isInitialized()
                        + ", postEnabled=" + viaPostEnabled + ", provider="
                        + (provider == null ? "missing" : provider.getClass().getName())
                        + ". Check earlier ViaVersion startup errors.");
            }
            if (result == ProviderStartup.Result.FAILED || result == ProviderStartup.Result.TIMED_OUT) {
                getServer().getPluginManager().disablePlugin(this);
            }
        } catch (LinkageError | RuntimeException failure) {
            getLogger().log(Level.SEVERE, "Cannot initialize ordered ACK support with ViaVersion "
                    + Via.getPlatform().getPluginVersion(), failure);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    private ProviderStartup.Result install(Executor mainThread) {
        if (!viaPostEnabled || !Via.getManager().isInitialized()) return ProviderStartup.Result.WAITING;
        AckSequenceProvider provider = Via.getManager().getProviders().get(AckSequenceProvider.class);
        if (provider == null) return ProviderStartup.Result.WAITING;
        if (!ProviderStartup.supportedProvider(provider.getClass().getName())) {
            getLogger().severe("Another ACK provider is installed; refusing to replace " + provider.getClass().getName());
            return ProviderStartup.Result.FAILED;
        }
        original = provider;
        active = true;
        OrderedAcknowledgements queue = new OrderedAcknowledgements(mainThread, () -> active,
            error -> getLogger().log(Level.SEVERE, "Could not queue ordered block acknowledgement", error));
        replacement = new OrderedAckSequenceProvider(original, queue, getLogger(), outboundQueue);
        Via.getManager().getProviders().use(AckSequenceProvider.class, replacement);
        getLogger().info("Ordered block ACKs enabled with ViaVersion " + Via.getPlatform().getPluginVersion()
                + " (replaced " + original.getClass().getSimpleName() + ")");
        return ProviderStartup.Result.INSTALLED;
    }

    @Override
    public void onDisable() {
        active = false;
        if (startup != null) startup.stop();
        if (startupTask != null) startupTask.cancel();
        if (replacement != null && Via.getManager().getProviders().get(AckSequenceProvider.class) == replacement) {
            Via.getManager().getProviders().use(AckSequenceProvider.class, original);
        }
    }
}
