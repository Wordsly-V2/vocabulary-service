import { CurrentUser } from '@/auth/jwt/current-user.decorator';
import { ADMIN_ROLE, Roles } from '@/auth/jwt/roles.decorator';
import type { Pagination } from '@/types/common/pagination.type';
import {
    Body,
    Controller,
    Get,
    HttpCode,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminDictionarySyncService } from './admin-dictionary-sync.service';
import {
    StartSyncDto,
    type SyncItem,
    SyncItemsQueryDto,
    type SyncJob,
    SyncJobsQueryDto,
    type SyncPreview,
    SyncScopeDto,
} from './dto/admin-dictionary-sync.dto';

/**
 * Langeek sync runs over any words, with progress and history, under
 * `/admin/vocabulary/sync` (the gateway routes `/admin/vocabulary` here).
 * Admins only.
 */
@ApiTags('admin-dictionary-sync')
@Roles(ADMIN_ROLE)
@Controller('admin/vocabulary/sync')
export class AdminDictionarySyncController {
    constructor(private readonly sync: AdminDictionarySyncService) {}

    @Post('preview')
    @HttpCode(200)
    @ApiOperation({ summary: 'How many words a scope covers' })
    preview(@Body() dto: SyncScopeDto): Promise<SyncPreview> {
        return this.sync.preview(dto);
    }

    @Post('jobs')
    @ApiOperation({
        summary: 'Start a sync (409 while another runs, 503 without Kafka)',
    })
    start(
        @CurrentUser() actorId: string,
        @Body() dto: StartSyncDto,
    ): Promise<SyncJob> {
        return this.sync.start(actorId, dto);
    }

    @Get('jobs')
    @ApiOperation({ summary: 'Sync runs, newest first' })
    jobs(@Query() query: SyncJobsQueryDto): Promise<Pagination<SyncJob>> {
        return this.sync.jobs(query);
    }

    @Get('jobs/:id')
    @ApiOperation({ summary: 'One run and its progress' })
    job(@Param('id', ParseUUIDPipe) id: string): Promise<SyncJob> {
        return this.sync.job(id);
    }

    @Get('jobs/:id/items')
    @ApiOperation({ summary: "A run's words and what happened to each" })
    items(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() query: SyncItemsQueryDto,
    ): Promise<Pagination<SyncItem>> {
        return this.sync.items(id, query);
    }

    @Post('jobs/:id/cancel')
    @HttpCode(200)
    @ApiOperation({ summary: 'Stop a running sync' })
    cancel(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<SyncJob> {
        return this.sync.cancel(actorId, id);
    }

    @Post('jobs/:id/retry')
    @ApiOperation({
        summary: "A new run over a finished run's failed and unfinished words",
    })
    retry(
        @CurrentUser() actorId: string,
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<SyncJob> {
        return this.sync.retry(actorId, id);
    }
}
