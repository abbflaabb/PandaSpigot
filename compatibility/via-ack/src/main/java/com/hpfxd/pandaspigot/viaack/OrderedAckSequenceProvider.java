package com.hpfxd.pandaspigot.viaack;

import com.viaversion.viaversion.api.connection.UserConnection;
import com.viaversion.viaversion.api.protocol.packet.PacketWrapper;
import com.viaversion.viaversion.api.protocol.version.ProtocolVersion;
import com.viaversion.viaversion.api.type.Types;
import com.viaversion.viaversion.protocols.v1_18_2to1_19.Protocol1_18_2To1_19;
import com.viaversion.viaversion.protocols.v1_18_2to1_19.packet.ClientboundPackets1_19;
import com.viaversion.viaversion.protocols.v1_18_2to1_19.provider.AckSequenceProvider;
import io.netty.channel.Channel;
import java.util.logging.Level;
import java.util.logging.Logger;

final class OrderedAckSequenceProvider extends AckSequenceProvider {
    private final AckSequenceProvider original;
    private final OrderedAcknowledgements acknowledgements;
    private final Logger logger;
    private final java.util.function.BiConsumer<UserConnection, Runnable> outboundQueue;

    OrderedAckSequenceProvider(AckSequenceProvider original, OrderedAcknowledgements acknowledgements,
                               Logger logger, java.util.function.BiConsumer<UserConnection, Runnable> outboundQueue) {
        this.original = original;
        this.acknowledgements = acknowledgements;
        this.logger = logger;
        this.outboundQueue = outboundQueue;
    }

    @Override
    public void handleSequence(UserConnection connection, final int sequence) {
        if (!connection.getProtocolInfo().serverProtocolVersion().equals(ProtocolVersion.v1_8)) {
            original.handleSequence(connection, sequence);
            return;
        }
        Channel channel = connection.getChannel();
        if (channel == null) {
            return;
        }
        acknowledgements.submit(channel.eventLoop(),
            () -> channel.isOpen() && !connection.isPendingDisconnect(),
            task -> outboundQueue.accept(connection, task), () -> {
                try {
                    // Capture this packet's sequence, never a mutable "latest received" value.
                    PacketWrapper packet = PacketWrapper.create(ClientboundPackets1_19.BLOCK_CHANGED_ACK, connection);
                    packet.write(Types.VAR_INT, sequence);
                    packet.send(Protocol1_18_2To1_19.class);
                } catch (Exception exception) {
                    logger.log(Level.WARNING, "Could not send ordered block acknowledgement", exception);
                }
            });
    }
}
