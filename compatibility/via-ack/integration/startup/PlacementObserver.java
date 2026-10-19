package integration;

import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockCanBuildEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.plugin.java.JavaPlugin;

/** Logs only interactions on the isolated protocol test server. */
public final class PlacementObserver extends JavaPlugin implements Listener {
    @Override public void onEnable() { getServer().getPluginManager().registerEvents(this, this); }
    @EventHandler(priority = EventPriority.MONITOR)
    public void interact(PlayerInteractEvent event) {
        getLogger().info("INTERACT " + event.getAction() + " item=" + event.getItem()
                + " use=" + event.useItemInHand() + " pos=" + event.getPlayer().getLocation());
    }
    @EventHandler(priority = EventPriority.MONITOR)
    public void build(BlockCanBuildEvent event) {
        getLogger().info("CAN_BUILD " + event.getBlock().getLocation() + " buildable=" + event.isBuildable());
    }
    @EventHandler(priority = EventPriority.MONITOR)
    public void place(BlockPlaceEvent event) {
        getLogger().info("PLACE " + event.getBlock().getLocation() + " cancelled=" + event.isCancelled()
                + " buildable=" + event.canBuild());
    }
}
