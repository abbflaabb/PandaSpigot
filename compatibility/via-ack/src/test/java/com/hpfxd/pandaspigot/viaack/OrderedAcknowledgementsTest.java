package com.hpfxd.pandaspigot.viaack;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import org.junit.Test;
import static org.junit.Assert.*;

public class OrderedAcknowledgementsTest {
    private final QueueExecutor eventLoop = new QueueExecutor();
    private final QueueExecutor mainThread = new QueueExecutor();
    private final List<String> actions = new ArrayList<>();
    private boolean connected = true;
    private boolean enabled = true;
    private final OrderedAcknowledgements queue = new OrderedAcknowledgements(mainThread, () -> enabled,
        error -> { throw new AssertionError(error); });

    @Test
    public void ackWaitsForTranslatedPacketAndBlockUpdate() {
        queue.submit(eventLoop, () -> connected, () -> actions.add("ack:7"));
        mainThread.execute(() -> {
            actions.add("place:7");
            eventLoop.execute(() -> actions.add("update:7"));
        });
        assertTrue(actions.isEmpty());
        eventLoop.drain();
        assertTrue(actions.isEmpty());
        mainThread.drain();
        eventLoop.drain();
        assertEquals(Arrays.asList("place:7", "update:7", "ack:7"), actions);
    }

    @Test
    public void laterSequenceCannotBeAcknowledgedByEarlierMarker() {
        receive(10);
        eventLoop.drain();
        mainThread.runNext(); // process placement 10, leave its ACK marker queued
        receive(11); // decoder receives 11 before the main thread reaches marker 10
        mainThread.runNext(); // marker 10
        eventLoop.drain();
        assertEquals(Arrays.asList("place:10", "ack:10"), actions);
        mainThread.drain();
        eventLoop.drain();
        assertEquals(Arrays.asList("place:10", "ack:10", "place:11", "ack:11"), actions);
    }

    @Test
    public void ackAlsoWaitsForDeferredOutboundChunkAndBlockPackets() {
        QueueExecutor outgoingPackets = new QueueExecutor();
        outgoingPackets.execute(() -> actions.add("block-update"));
        queue.submit(eventLoop, () -> connected, outgoingPackets, () -> actions.add("ack"));
        mainThread.execute(() -> actions.add("place"));
        eventLoop.drain();
        mainThread.drain();
        assertEquals(Arrays.asList("place"), actions);
        outgoingPackets.drain();
        assertEquals(Arrays.asList("place", "block-update", "ack"), actions);
    }

    @Test
    public void cancelledPlacementStillAcknowledgesAfterCorrection() {
        queue.submit(eventLoop, () -> connected, () -> actions.add("ack"));
        mainThread.execute(() -> eventLoop.execute(() -> actions.add("correction")));
        eventLoop.drain();
        mainThread.drain();
        eventLoop.drain();
        assertEquals(Arrays.asList("correction", "ack"), actions);
    }

    @Test
    public void translatedPacketCancelledBeforeServerStillAcknowledges() {
        queue.submit(eventLoop, () -> connected, () -> actions.add("ack"));
        eventLoop.drain();
        mainThread.drain();
        eventLoop.drain();
        assertEquals(Arrays.asList("ack"), actions);
    }

    @Test
    public void disconnectBeforeMainThreadDropsPendingAck() {
        receive(1);
        eventLoop.drain();
        connected = false;
        mainThread.drain();
        eventLoop.drain();
        assertEquals(Arrays.asList("place:1"), actions);
    }

    @Test
    public void disableAfterMainThreadDropsPendingAck() {
        receive(1);
        eventLoop.drain();
        mainThread.drain();
        enabled = false;
        eventLoop.drain();
        assertEquals(Arrays.asList("place:1"), actions);
    }

    @Test
    public void shutdownRejectionDoesNotSendEarlyAck() {
        queue.submit(task -> { throw new RejectedExecutionException(); }, () -> connected,
            () -> actions.add("ack"));
        assertTrue(actions.isEmpty());
    }

    private void receive(final int sequence) {
        queue.submit(eventLoop, () -> connected, () -> actions.add("ack:" + sequence));
        mainThread.execute(() -> actions.add("place:" + sequence));
    }

    private static final class QueueExecutor implements Executor {
        private final Queue<Runnable> tasks = new ArrayDeque<>();

        @Override
        public void execute(Runnable task) { tasks.add(task); }

        void runNext() { tasks.remove().run(); }

        void drain() { while (!tasks.isEmpty()) { runNext(); } }
    }
}
