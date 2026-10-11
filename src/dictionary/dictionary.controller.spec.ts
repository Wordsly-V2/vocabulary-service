import { THROTTLERS } from '@/common/throttler/throttlers';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';

jest.mock('uuid', () => ({ v7: () => '0190a000-0000-7000-8000-000000000000' }));

const JOB = '0190a000-0000-7000-8000-000000000b01';

/**
 * The real throttler guard over HTTP, with the app's buckets: which routes
 * each limit actually reaches. Every named throttler applies to every route
 * unless skipped by name, which is how the 5-a-minute sync limit once capped
 * every lookup and the status poll.
 */
describe('DictionaryController throttling', () => {
    let app: INestApplication<App>;
    let user = 0;

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ThrottlerModule.forRoot(THROTTLERS)],
            controllers: [DictionaryController],
            providers: [
                {
                    provide: DictionaryService,
                    useValue: {
                        getWordPronunciation: () =>
                            Promise.resolve({ pronunciation: [], ipas: [] }),
                        syncWordsWithLangeek: () =>
                            Promise.resolve({
                                jobId: JOB,
                                total: 0,
                                enqueued: 0,
                            }),
                        getSyncJob: () => Promise.resolve({ jobId: JOB }),
                    },
                },
            ],
        }).compile();
        app = moduleRef.createNestApplication();
        // A fresh caller per test, so the in-memory buckets never carry over.
        const sub = `user-${++user}`;
        app.use((req: Request, _res: Response, next: NextFunction) => {
            (req as Request & { user: { sub: string } }).user = { sub };
            next();
        });
        await app.init();
    });

    afterEach(() => app.close());

    const times = async (n: number, send: () => request.Test) => {
        const codes: number[] = [];
        for (let i = 0; i < n; i += 1) codes.push((await send()).status);
        return codes;
    };

    it('lets a lookup through 60 times a minute, not 5', async () => {
        const codes = await times(61, () =>
            request(app.getHttpServer()).get('/dictionary/pronunciation/apple'),
        );
        expect(codes.slice(0, 60).every((code) => code === 200)).toBe(true);
        expect(codes[60]).toBe(429);
    });

    it('limits starting a sync to 5 a minute', async () => {
        const codes = await times(6, () =>
            request(app.getHttpServer())
                .post('/dictionary/sync-words-langeek')
                .send({}),
        );
        expect(codes.slice(0, 5).every((code) => code === 201)).toBe(true);
        expect(codes[5]).toBe(429);
    });

    it('never limits polling a sync job', async () => {
        const codes = await times(70, () =>
            request(app.getHttpServer()).get(
                `/dictionary/sync-words-langeek/jobs/${JOB}`,
            ),
        );
        expect(codes.every((code) => code === 200)).toBe(true);
    });
});
