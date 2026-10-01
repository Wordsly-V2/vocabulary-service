import { KafkaContext } from '@nestjs/microservices';
import { UserDataService } from './user-data.service';
import { UserDeletedConsumer } from './user-deleted.consumer';
import { parseUserDeletedPayload } from './user-deleted.payload';

const USER = '0190a000-0000-7000-8000-000000000001';

describe('parseUserDeletedPayload', () => {
    it('accepts a uuid userLoginId', () => {
        expect(parseUserDeletedPayload({ userLoginId: USER })).toBe(USER);
    });

    it.each([
        ['a missing field', {}],
        ['a non-uuid', { userLoginId: 'nope' }],
        ['null', null],
    ])('rejects %s', (_label, payload) => {
        expect(parseUserDeletedPayload(payload)).toBeNull();
    });
});

describe('UserDeletedConsumer', () => {
    const commitOffsets = jest.fn().mockResolvedValue(undefined);
    const context = {
        getMessage: () => ({ offset: '4', value: Buffer.from('{}') }),
        getConsumer: () => ({ commitOffsets }),
        getTopic: () => 'user_deleted',
        getPartition: () => 1,
    } as unknown as KafkaContext;

    let deleteMany: jest.Mock;
    let invalidateUser: jest.Mock;
    let consumer: UserDeletedConsumer;

    beforeEach(() => {
        commitOffsets.mockClear();
        deleteMany = jest
            .fn()
            .mockResolvedValueOnce({ count: 2 })
            .mockResolvedValue({ count: 0 });
        invalidateUser = jest.fn().mockResolvedValue(undefined);
        const service = new UserDataService(
            { course: { deleteMany } } as never,
            { invalidateUser } as never,
        );
        consumer = new UserDeletedConsumer(service);
    });

    it("deletes the user's courses, clears their cache and commits", async () => {
        await consumer.handleUserDeleted({ userLoginId: USER }, context);

        expect(deleteMany).toHaveBeenCalledWith({
            where: { userLoginId: USER },
        });
        expect(invalidateUser).toHaveBeenCalledWith(USER);
        expect(commitOffsets).toHaveBeenCalledWith([
            { topic: 'user_deleted', partition: 1, offset: '5' },
        ]);
    });

    it('is idempotent: a redelivery removes nothing and still commits', async () => {
        await consumer.handleUserDeleted({ userLoginId: USER }, context);
        await consumer.handleUserDeleted({ userLoginId: USER }, context);

        expect(await deleteMany.mock.results[1].value).toEqual({ count: 0 });
        expect(commitOffsets).toHaveBeenCalledTimes(2);
    });

    it('commits a malformed message without deleting anything', async () => {
        await consumer.handleUserDeleted({ userLoginId: null }, context);

        expect(deleteMany).not.toHaveBeenCalled();
        expect(commitOffsets).toHaveBeenCalledTimes(1);
    });

    it('never touches courses without an owner (official courses)', async () => {
        await consumer.handleUserDeleted({}, context);
        expect(deleteMany).not.toHaveBeenCalled();
    });
});
