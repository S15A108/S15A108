package com.beez.backend.validation.worker;

import com.beez.backend.validation.config.ValidationProperties;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** One scheduler delegates both accepted jobs and lease recovery to the semantic executor. */
@Component
public class ValidationWorker {
    private final ValidationProperties properties;
    private final com.beez.backend.validation.service.ValidationWorker executor;

    public ValidationWorker(ValidationProperties properties,
                            com.beez.backend.validation.service.ValidationWorker executor) {
        this.properties = properties;
        this.executor = executor;
    }

    @Scheduled(fixedDelayString = "${beez.validation.poll-millis:2000}")
    public void poll() {
        if (!properties.workerEnabled()) return;
        try { runOnce(); }
        catch (RuntimeException e) {
            LoggerFactory.getLogger(getClass()).error("Validation worker failed: {}", e.getClass().getSimpleName());
        }
    }

    public boolean runOnce() { return executor.runOnce(); }

    public boolean recoverExpired() { return executor.recoverExpired(); }
}
