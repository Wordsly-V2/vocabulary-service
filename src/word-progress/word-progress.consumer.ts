import { WORD_PROGRESS_EVENTS } from '@/messaging/constants';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import {
    RecordAnswerDto,
    WordProgressResponseDto,
} from './dto/word-progress.dto';
import { WordProgressService } from './word-progress.service';

/**
 * Handles Kafka events for word-progress. Delegates to WordProgressService.
 * HTTP endpoints stay in WordProgressController.
 */
@Controller()
export class WordProgressConsumer {
    constructor(private readonly wordProgressService: WordProgressService) {}

    @EventPattern(WORD_PROGRESS_EVENTS.RECORD_ANSWER)
    async handleRecordAnswer(
        @Payload() payload: RecordAnswerDto,
    ): Promise<WordProgressResponseDto> {
        return this.wordProgressService.recordAnswer(payload);
    }
}
