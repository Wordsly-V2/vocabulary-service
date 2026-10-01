/** Topic for syncing a single word with Langeek (one message per word). */
export const DICTIONARY_SYNC_WORD_LANGEEK_TOPIC =
    'dictionary_sync-word-langeek';

/** Topic for word deletion (one message per word). Learning-service removes word progress. */
export const WORDS_DELETED_TOPIC = 'words_deleted';

/**
 * Published by auth-service (through its outbox) after an admin deletes an
 * account: `{ userLoginId, deletedAt }`, keyed by user. Consumed to delete the
 * user's courses, lessons and words.
 */
export const USER_DELETED_TOPIC = 'user_deleted';

/** Every topic this service consumes; created at boot if missing (main.ts). */
export const CONSUMED_TOPICS = [
    DICTIONARY_SYNC_WORD_LANGEEK_TOPIC,
    USER_DELETED_TOPIC,
];
