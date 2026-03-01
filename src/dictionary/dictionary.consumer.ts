import { DICTIONARY_SYNC_WORD_LANGEEK_TOPIC } from '@/messaging/constants';
import { commitCurrentMessage } from '@/messaging/kafka-helpers';
import { Controller } from '@nestjs/common';
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
    partOfSpeech: string | null;
}

/**
 * Handles Kafka events for dictionary: processes one word sync (Langeek lookup + DB update) per message.
 */
@Controller()
export class DictionaryConsumer {
    constructor(private readonly dictionaryService: DictionaryService) {}

    @EventPattern(DICTIONARY_SYNC_WORD_LANGEEK_TOPIC)
    async handleSyncWordLangeek(
        @Payload() payload: SyncWordLangeekPayload,
        @Ctx() context: KafkaContext,
    ): Promise<{ status: string; reason?: string }> {
        const result = await this.dictionaryService.processOneWordSync(
            payload.wordId,
            payload.word,
            payload.partOfSpeech ?? null,
        );
        await commitCurrentMessage(context);
        return result;
    }
}
