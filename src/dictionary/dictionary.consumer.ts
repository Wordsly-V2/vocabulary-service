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
import { AdminDictionarySyncService } from '@/admin-dictionary-sync/admin-dictionary-sync.service';

/** Payload for sync-word-langeek Kafka message (one per word). */
export interface SyncWordLangeekPayload {
    wordId: string;
    word: string;
    partOfSpeech: string | null;
    /** Learner sync job this word belongs to (Redis progress). */
    jobId?: string;
    /** Admin sync run this word belongs to (`word_sync_jobs`). */
    adminJobId?: string;
}

const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Handles Kafka events for dictionary: processes one word sync (Langeek lookup + DB update) per message.
 */
@Controller()
export class DictionaryConsumer {
    private readonly logger = new Logger(DictionaryConsumer.name);

    constructor(
        private readonly dictionaryService: DictionaryService,
        private readonly kafkaProducer: KafkaProducerService,
        private readonly adminSync: AdminDictionarySyncService,
    ) {}

    @EventPattern(DICTIONARY_SYNC_WORD_LANGEEK_TOPIC)
    async handleSyncWordLangeek(
        @Payload() payload: SyncWordLangeekPayload,
        @Ctx() context: KafkaContext,
    ): Promise<void> {
        if (payload.adminJobId) {
            return this.handleAdminSyncWord(
                payload,
                payload.adminJobId,
                context,
            );
        }
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

    /**
     * One word of an admin run: the run's fields and mode, the dictionary
     * cache skipped, progress counted in Postgres. A cancelled (or deleted)
     * run's remaining words are committed without fetching anything, and the
     * pause after each word keeps a long run gentle on Langeek.
     */
    private async handleAdminSyncWord(
        payload: SyncWordLangeekPayload,
        jobId: string,
        context: KafkaContext,
    ): Promise<void> {
        await consumeWithRetry({
            context,
            logger: this.logger,
            operation: `sync "${payload.word}" with Langeek (run ${jobId})`,
            handler: async () => {
                const run = await this.adminSync.runSettings(jobId);
                if (!run?.running) return;
                const result = await this.dictionaryService.processOneWordSync(
                    payload.wordId,
                    payload.word,
                    payload.partOfSpeech,
                    { fields: run.fields, mode: run.mode, refresh: true },
                );
                await this.adminSync.record(jobId, payload.wordId, result);
                if (this.adminSync.delayMs > 0) {
                    await sleep(this.adminSync.delayMs);
                }
            },
            onDeadLetter: async ({ topic, value, error }) => {
                // As for the learner sync: a word given up on still counts, or
                // the run could never complete.
                await this.adminSync.record(jobId, payload.wordId, {
                    status: 'error',
                    reason: error,
                });
                await this.kafkaProducer.send(topic, {
                    originalPayload: value,
                    error,
                    failedAt: new Date().toISOString(),
                });
            },
        });
    }
}
