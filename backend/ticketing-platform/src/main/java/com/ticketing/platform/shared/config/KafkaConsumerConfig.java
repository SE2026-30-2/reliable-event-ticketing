package com.ticketing.platform.shared.config;

import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.converter.RecordMessageConverter;
import org.springframework.kafka.support.converter.StringJsonMessageConverter;
import org.springframework.util.backoff.ExponentialBackOff;

/**
 * Shared Kafka consumer configuration for every {@code @KafkaListener} in this app (catalog's
 * {@code PaymentEventListener}, checkin's ticket-state listeners, notification's listeners, etc).
 * <p>
 * <b>Error handling</b>: a failed listener invocation is retried with an exponential backoff and,
 * once retries are exhausted, published to a dead-letter topic named {@code <original-topic>.DLT}
 * instead of being lost or crashing the consumer thread. The {@link DeadLetterPublishingRecoverer}
 * below derives the DLT topic name from {@code record.topic()} of whichever record actually
 * failed - entirely generic, works unmodified for every topic this app consumes.
 * <p>
 * <b>JSON conversion without type headers</b>: every producer in this app (the shared outbox
 * relay) publishes plain JSON strings with no Spring-Kafka type headers. {@code
 * spring.kafka.consumer.value-deserializer} is a plain {@code StringDeserializer} (see
 * application.properties); the {@link StringJsonMessageConverter} bean below is the single {@code
 * RecordMessageConverter} in the context, and Spring Kafka infers the JSON target type from each
 * {@code @KafkaListener} method's own declared parameter type - no type-mapping coordination
 * needed between producer and consumer, and a different class per topic/listener method works
 * from one shared converter instance.
 */
@Configuration
public class KafkaConsumerConfig {

    private static final long INITIAL_INTERVAL_MS = 1_000L;
    private static final double MULTIPLIER = 2.0;
    private static final long MAX_INTERVAL_MS = 10_000L;
    private static final long MAX_ELAPSED_TIME_MS = 30_000L;

    @Bean
    public RecordMessageConverter recordMessageConverter() {
        return new StringJsonMessageConverter();
    }

    @Bean
    public DeadLetterPublishingRecoverer deadLetterPublishingRecoverer(KafkaTemplate<Object, Object> kafkaTemplate) {
        return new DeadLetterPublishingRecoverer(kafkaTemplate,
                (record, exception) -> new TopicPartition(record.topic() + ".DLT", record.partition()));
    }

    @Bean
    public DefaultErrorHandler kafkaErrorHandler(DeadLetterPublishingRecoverer deadLetterPublishingRecoverer) {
        ExponentialBackOff backOff = new ExponentialBackOff(INITIAL_INTERVAL_MS, MULTIPLIER);
        backOff.setMaxInterval(MAX_INTERVAL_MS);
        backOff.setMaxElapsedTime(MAX_ELAPSED_TIME_MS);
        return new DefaultErrorHandler(deadLetterPublishingRecoverer, backOff);
    }
}
