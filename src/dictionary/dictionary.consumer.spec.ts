import { KafkaContext } from '@nestjs/microservices';
import { DictionaryConsumer } from './dictionary.consumer';

jest.mock('uuid', () => ({ v7: () => '0190a000-0000-7000-8000-000000000000' }));

describe('DictionaryConsumer', () => {
    const commitOffsets = jest.fn().mockResolvedValue(undefined);
    const context = {
        getMessage: () => ({ offset: '7', value: Buffer.from('{}') }),
        getConsumer: () => ({ commitOffsets }),
        getTopic: () => 'dictionary_sync-word-langeek',
        getPartition: () => 0,
    } as unknown as KafkaContext;

    let dictionary: Record<string, jest.Mock>;
    let adminSync: {
        runSettings: jest.Mock;
        record: jest.Mock;
        delayMs: number;
    };
    let consumer: DictionaryConsumer;

    beforeEach(() => {
        commitOffsets.mockClear();
        dictionary = {
            processOneWordSync: jest.fn().mockResolvedValue({
                status: 'updated',
                changedFields: ['image'],
            }),
            recordSyncProgress: jest.fn().mockResolvedValue(undefined),
        };
        adminSync = {
            runSettings: jest.fn().mockResolvedValue({
                fields: ['image'],
                mode: 'overwrite',
                running: true,
            }),
            record: jest.fn().mockResolvedValue(undefined),
            delayMs: 0,
        };
        consumer = new DictionaryConsumer(
            dictionary as never,
            { send: jest.fn() } as never,
            adminSync as never,
        );
    });

    const payload = { wordId: 'w1', word: 'cat', partOfSpeech: 'noun' };

    it('keeps the learner sync on its Redis job', async () => {
        await consumer.handleSyncWordLangeek(
            { ...payload, jobId: 'learner-job' },
            context,
        );
        expect(dictionary.processOneWordSync).toHaveBeenCalledWith(
            'w1',
            'cat',
            'noun',
        );
        expect(dictionary.recordSyncProgress).toHaveBeenCalledWith(
            'learner-job',
            'updated',
        );
        expect(adminSync.record).not.toHaveBeenCalled();
        expect(commitOffsets).toHaveBeenCalled();
    });

    it("runs an admin word with the run's fields and mode, fresh", async () => {
        await consumer.handleSyncWordLangeek(
            { ...payload, adminJobId: 'run' },
            context,
        );
        expect(dictionary.processOneWordSync).toHaveBeenCalledWith(
            'w1',
            'cat',
            'noun',
            { fields: ['image'], mode: 'overwrite', refresh: true },
        );
        expect(adminSync.record).toHaveBeenCalledWith('run', 'w1', {
            status: 'updated',
            changedFields: ['image'],
        });
        expect(dictionary.recordSyncProgress).not.toHaveBeenCalled();
        expect(commitOffsets).toHaveBeenCalled();
    });

    it('skips the words of a cancelled run without fetching', async () => {
        adminSync.runSettings.mockResolvedValue({
            fields: ['image'],
            mode: 'overwrite',
            running: false,
        });
        await consumer.handleSyncWordLangeek(
            { ...payload, adminJobId: 'run' },
            context,
        );
        expect(dictionary.processOneWordSync).not.toHaveBeenCalled();
        expect(adminSync.record).not.toHaveBeenCalled();
        expect(commitOffsets).toHaveBeenCalled();
    });
});
