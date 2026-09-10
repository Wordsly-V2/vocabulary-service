import { DICTIONARY_SYNC_WORD_LANGEEK_TOPIC } from '@/messaging/constants';
import { consumeWithRetry } from '@/messaging/kafka-helpers';
import { Controller, Logger } from '@nestjs/common';
import { KafkaProducerService } from '@/messaging/kafka-producer.service';
import {
    Ctx,
    EventPattern,
    KafkaContext,
    Payload,
} from '@nestjs/microservices';
import { DictionaryService } from './dictionary.service';

/** Payload for sync-word-langeek Kafka message (one per word). */
export interface SyncWordLangeekPayload {
    wordId: string;
    word: string;
    partOfSpeech: string;
    /** Sync job this word belongs to, used to track progress. */
    jobId?: string;
}

/**
 * Handles Kafka events for dictionary: processes one word sync (Langeek lookup + DB update) per message.
 */
@Controller()
export class DictionaryConsumer {
    private readonly logger = new Logger(DictionaryConsumer.name);

    constructor(
        private readonly dictionaryService: DictionaryService,
        private readonly kafkaProducer: KafkaProducerService,
    ) {}

    @EventPattern(DICTIONARY_SYNC_WORD_LANGEEK_TOPIC)
    async handleSyncWordLangeek(
        @Payload() payload: SyncWordLangeekPayload,
        @Ctx() context: KafkaContext,
    ): Promise<void> {
        await consumeWithRetry({
            context,
            logger: this.logger,
            operation: `sync "${payload.word}" with Langeek`,
            handler: async () => {
                const result = await this.dictionaryService.processOneWordSync(
                    payload.wordId,
                    payload.word,
                    payload.partOfSpeech,
                );
                await this.dictionaryService.recordSyncProgress(
                    payload.jobId,
                    result.status,
                );
            },
            onDeadLetter: async ({ topic, value, error }) => {
                // Count the word as errored before giving up. The job's progress
                // counter is what marks it completed, so a message abandoned
                // without incrementing it would leave the learner polling a job
                // that can never finish.
                await this.dictionaryService.recordSyncProgress(
                    payload.jobId,
                    'error',
                );
                await this.kafkaProducer.send(topic, {
                    originalPayload: value,
                    error,
                    failedAt: new Date().toISOString(),
                });
            },
        });
    }
}
