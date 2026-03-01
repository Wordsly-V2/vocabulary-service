/**
 * Kafka event / topic names used by this service.
 * Use these constants in both producers (if any) and consumers so they stay in sync.
 */
export const WORD_PROGRESS_EVENTS = {
    RECORD_ANSWER: 'word-progress_record-answer',
} as const;

/** Topic for syncing a single word with Langeek (one message per word). */
export const DICTIONARY_SYNC_WORD_LANGEEK_TOPIC =
    'dictionary_sync-word-langeek';
