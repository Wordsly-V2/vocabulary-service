import { CacheService } from '@/cache/cache.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';

/** Everything vocabulary-service holds for one user, as a whole. */
@Injectable()
export class UserDataService {
    private readonly logger = new Logger(UserDataService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: CacheService,
    ) {}

    /**
     * Delete a deleted account's courses; their lessons and words go with
     * them (cascade). Idempotent. Unlike a learner's own course delete this
     * publishes no `words_deleted`: learning-service gets the same
     * `user_deleted` and drops all of that user's progress itself.
     */
    async purgeUser(userLoginId: string): Promise<{ courses: number }> {
        const { count } = await this.prisma.course.deleteMany({
            where: { userLoginId },
        });
        await this.cache.invalidateUser(userLoginId);
        this.logger.log(
            `user_purged ${JSON.stringify({ userLoginId, purged: { courses: count } })}`,
        );
        return { courses: count };
    }
}
