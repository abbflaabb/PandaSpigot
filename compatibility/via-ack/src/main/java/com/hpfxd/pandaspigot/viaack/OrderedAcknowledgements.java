package com.hpfxd.pandaspigot.viaack;

import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Orders an acknowledgement behind the packet currently being decoded. */
final class OrderedAcknowledgements {
    private final Executor mainThread;
    private final BooleanSupplier enabled;
    private final Consumer<RuntimeException> failureHandler;

    OrderedAcknowledgements(Executor mainThread, BooleanSupplier enabled,
                            Consumer<RuntimeException> failureHandler) {
        this.mainThread = mainThread;
        this.enabled = enabled;
        this.failureHandler = failureHandler;
    }

    void submit(Executor eventLoop, BooleanSupplier connected, Runnable acknowledge) {
        submit(eventLoop, connected, eventLoop, acknowledge);
    }

    void submit(Executor eventLoop, BooleanSupplier connected, Executor outboundQueue, Runnable acknowledge) {
        // Via calls its provider inside the decoder, before the translated packet reaches
        // PlayerConnectionUtils. A queued event-loop task runs after that pipeline call,
        // so its main-thread marker follows the packet in PandaSpigot's FIFO task queue.
        enqueue(eventLoop, connected, () -> enqueue(mainThread, connected,
            () -> enqueue(outboundQueue, connected, acknowledge)));
    }

    private void enqueue(Executor executor, BooleanSupplier connected, Runnable task) {
        if (!enabled.getAsBoolean() || !connected.getAsBoolean()) {
            return;
        }
        try {
            executor.execute(() -> {
                if (enabled.getAsBoolean() && connected.getAsBoolean()) {
                    try {
                        task.run();
                    } catch (RuntimeException failure) {
                        failureHandler.accept(failure);
                    }
                }
            });
        } catch (RejectedExecutionException ignored) {
            // The channel/server is shutting down; never send an early fallback ACK.
        } catch (RuntimeException failure) {
            failureHandler.accept(failure);
        }
    }
}
