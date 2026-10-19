package integration;

import com.viaversion.viaversion.api.Via;
import com.viaversion.viaversion.protocols.v1_18_2to1_19.provider.AckSequenceProvider;
import java.io.File;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

/** Test-only fixture. Never install on a production server. */
public final class StartupFixture extends JavaPlugin {
    private boolean postEnabled;

    @Override
    public void onEnable() {
        String mode = System.getProperty("viaack.test.mode");
        Via.getManager().addPostEnableListener(() -> {
            postEnabled = true;
            if ("base".equals(mode)) {
                Via.getManager().getProviders().use(AckSequenceProvider.class, new AckSequenceProvider());
            }
        });
        if ("delayed".equals(mode)) {
            // Defer Via's real scheduled platform initialization in this isolated server.
            getServer().getScheduler().cancelTasks(getServer().getPluginManager().getPlugin("ViaVersion"));
            getServer().getScheduler().runTaskLater(this, () -> {
                try {
                    if (postEnabled) throw new IllegalStateException("Via already post-enabled");
                    getLogger().info("Resuming Via post-enable after 40 ticks");
                    Via.getManager().getClass().getMethod("onServerLoaded").invoke(Via.getManager());
                } catch (Exception failure) {
                    getLogger().severe("FIXTURE_FAILED " + failure);
                }
            }, 40L);
        } else if ("late".equals(mode)) {
            getServer().getScheduler().runTaskLater(this, () -> {
                try {
                    if (!postEnabled) throw new IllegalStateException("Via not post-enabled");
                    Plugin addon = getServer().getPluginManager().loadPlugin(new File("addon.jar"));
                    getServer().getPluginManager().enablePlugin(addon);
                } catch (Exception failure) {
                    getLogger().severe("FIXTURE_FAILED " + failure);
                }
            }, 40L);
        }
        getServer().getScheduler().runTaskLater(this, () -> {
            try {
                if (!postEnabled) throw new IllegalStateException("Via never post-enabled");
                Plugin addon = getServer().getPluginManager().getPlugin("PandaSpigotViaAck");
                boolean expectedEnabled = Boolean.parseBoolean(System.getProperty("viaack.test.enabled"));
                if (addon == null || addon.isEnabled() != expectedEnabled) {
                    throw new IllegalStateException("Unexpected addon enable state");
                }
                if (expectedEnabled) {
                    String installed = providerName();
                    if (!installed.equals("com.hpfxd.pandaspigot.viaack.OrderedAckSequenceProvider")) {
                        throw new IllegalStateException("Provider overwritten: " + installed);
                    }
                    getServer().getPluginManager().disablePlugin(addon);
                }
                String expected = "base".equals(mode)
                        ? AckSequenceProvider.class.getName()
                        : "com.viaversion.viaversion.bukkit.providers.BukkitAckSequenceProvider";
                if (!providerName().equals(expected)) {
                    throw new IllegalStateException("Original provider not restored: " + providerName());
                }
                getLogger().info("STARTUP_VERIFIED mode=" + mode + " enabled=" + expectedEnabled
                        + " ViaVersion=" + Via.getPlatform().getPluginVersion() + " restored=" + providerName());
            } catch (Exception failure) {
                getLogger().severe("FIXTURE_FAILED " + failure);
            }
        }, 80L);
    }

    private String providerName() {
        return Via.getManager().getProviders().get(AckSequenceProvider.class).getClass().getName();
    }
}
