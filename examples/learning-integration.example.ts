/**
 * Example Integration: Vocabulary Learning App
 * 
 * This file demonstrates how to integrate the spaced repetition system
 * into a real-world vocabulary learning application.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface WordProgress {
    id: string;
    wordId: string;
    userLoginId: string;
    easeFactor: number;
    interval: number;
    repetitions: number;
    lastReviewedAt?: Date;
    nextReviewAt: Date;
    totalReviews: number;
    correctReviews: number;
    successRate: number;
}

interface DueWord extends WordProgress {
    word: {
        id: string;
        word: string;
        meaning: string;
        pronunciation?: string;
        partOfSpeech?: string;
        audioUrl?: string;
        lessonId: string;
    };
    isNew: boolean;
}

interface ProgressStats {
    totalWords: number;
    newWords: number;
    learningWords: number;
    reviewWords: number;
    dueToday: number;
    overallSuccessRate: number;
}

enum AnswerQuality {
    COMPLETE_BLACKOUT = 0,
    INCORRECT = 1,
    INCORRECT_BUT_EASY = 2,
    CORRECT_WITH_DIFFICULTY = 3,
    CORRECT_WITH_HESITATION = 4,
    PERFECT = 5,
}

// ============================================================================
// API CLIENT
// ============================================================================

class VocabularyLearningClient {
    constructor(
        private baseUrl: string = 'http://localhost:3000',
        private apiKey?: string
    ) {}

    private async request<T>(
        endpoint: string,
        options?: RequestInit
    ): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
            ...options?.headers,
        };

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    /**
     * Get words due for review
     */
    async getDueWords(
        userLoginId: string,
        options?: {
            courseId?: string;
            lessonId?: string;
            limit?: number;
            includeNew?: boolean;
        }
    ): Promise<DueWord[]> {
        const params = new URLSearchParams();
        if (options?.courseId) params.append('courseId', options.courseId);
        if (options?.lessonId) params.append('lessonId', options.lessonId);
        if (options?.limit) params.append('limit', options.limit.toString());
        if (options?.includeNew !== undefined) {
            params.append('includeNew', options.includeNew.toString());
        }

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<DueWord[]>(
            `/users/${userLoginId}/word-progress/due-words${query}`
        );
    }

    /**
     * Record a single answer
     */
    async recordAnswer(
        userLoginId: string,
        wordId: string,
        quality: AnswerQuality
    ): Promise<WordProgress> {
        return this.request<WordProgress>(
            `/users/${userLoginId}/word-progress/record-answer`,
            {
                method: 'POST',
                body: JSON.stringify({ wordId, quality }),
            }
        );
    }

    /**
     * Record multiple answers (bulk operation)
     */
    async recordAnswers(
        userLoginId: string,
        answers: Array<{ wordId: string; quality: AnswerQuality }>
    ): Promise<WordProgress[]> {
        return this.request<WordProgress[]>(
            `/users/${userLoginId}/word-progress/record-answers`,
            {
                method: 'POST',
                body: JSON.stringify({ answers }),
            }
        );
    }

    /**
     * Get learning statistics
     */
    async getStats(
        userLoginId: string,
        options?: { courseId?: string; lessonId?: string }
    ): Promise<ProgressStats> {
        const params = new URLSearchParams();
        if (options?.courseId) params.append('courseId', options.courseId);
        if (options?.lessonId) params.append('lessonId', options.lessonId);

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<ProgressStats>(
            `/users/${userLoginId}/word-progress/stats${query}`
        );
    }

    /**
     * Get progress for a specific word
     */
    async getWordProgress(
        userLoginId: string,
        wordId: string
    ): Promise<WordProgress | null> {
        return this.request<WordProgress | null>(
            `/users/${userLoginId}/word-progress/words/${wordId}`
        );
    }

    /**
     * Reset progress for a word
     */
    async resetProgress(
        userLoginId: string,
        wordId: string
    ): Promise<{ success: boolean }> {
        return this.request<{ success: boolean }>(
            `/users/${userLoginId}/word-progress/words/${wordId}/reset`,
            { method: 'DELETE' }
        );
    }
}

// ============================================================================
// LEARNING SESSION MANAGER
// ============================================================================

class LearningSession {
    private words: DueWord[] = [];
    private currentIndex: number = 0;
    private answers: Array<{ wordId: string; quality: AnswerQuality }> = [];

    constructor(
        private client: VocabularyLearningClient,
        private userLoginId: string
    ) {}

    /**
     * Start a new learning session
     */
    async start(options?: {
        courseId?: string;
        lessonId?: string;
        limit?: number;
    }): Promise<void> {
        this.words = await this.client.getDueWords(
            this.userLoginId,
            options
        );
        this.currentIndex = 0;
        this.answers = [];
    }

    /**
     * Get the current word
     */
    getCurrentWord(): DueWord | null {
        return this.words[this.currentIndex] || null;
    }

    /**
     * Record answer for current word and move to next
     */
    recordAnswer(quality: AnswerQuality): void {
        const currentWord = this.getCurrentWord();
        if (!currentWord) {
            throw new Error('No current word');
        }

        this.answers.push({
            wordId: currentWord.wordId,
            quality,
        });

        this.currentIndex++;
    }

    /**
     * Check if session is complete
     */
    isComplete(): boolean {
        return this.currentIndex >= this.words.length;
    }

    /**
     * Get session progress
     */
    getProgress(): { current: number; total: number; percentage: number } {
        const current = Math.min(this.currentIndex, this.words.length);
        const total = this.words.length;
        const percentage = total > 0 ? (current / total) * 100 : 0;

        return { current, total, percentage };
    }

    /**
     * Submit all answers to the server
     */
    async submit(): Promise<WordProgress[]> {
        if (!this.isComplete()) {
            throw new Error('Session not complete');
        }

        return this.client.recordAnswers(this.userLoginId, this.answers);
    }

    /**
     * Get session statistics
     */
    getSessionStats(): {
        total: number;
        correct: number;
        incorrect: number;
        successRate: number;
    } {
        const total = this.answers.length;
        const correct = this.answers.filter(a => a.quality >= 3).length;
        const incorrect = total - correct;
        const successRate = total > 0 ? (correct / total) * 100 : 0;

        return { total, correct, incorrect, successRate };
    }
}

// ============================================================================
// QUIZ TYPES
// ============================================================================

/**
 * Multiple Choice Quiz
 */
class MultipleChoiceQuiz {
    /**
     * Determine answer quality based on user's choice
     */
    static evaluateAnswer(
        userChoice: string,
        correctAnswer: string,
        responseTimeMs: number
    ): AnswerQuality {
        if (userChoice !== correctAnswer) {
            return AnswerQuality.INCORRECT;
        }

        // Correct answer - determine quality based on response time
        if (responseTimeMs < 2000) {
            return AnswerQuality.PERFECT; // Fast recall
        } else if (responseTimeMs < 5000) {
            return AnswerQuality.CORRECT_WITH_HESITATION; // Some hesitation
        } else {
            return AnswerQuality.CORRECT_WITH_DIFFICULTY; // Slow recall
        }
    }
}

/**
 * Flashcard Quiz (self-assessment)
 */
class FlashcardQuiz {
    /**
     * Get quality based on user's self-assessment
     */
    static userSelfAssessment(): {
        buttons: Array<{ label: string; quality: AnswerQuality }>;
    } {
        return {
            buttons: [
                { label: "I didn't know 😰", quality: AnswerQuality.COMPLETE_BLACKOUT },
                { label: 'Wrong ❌', quality: AnswerQuality.INCORRECT },
                { label: 'Hard 😅', quality: AnswerQuality.CORRECT_WITH_DIFFICULTY },
                { label: 'Good 👍', quality: AnswerQuality.CORRECT_WITH_HESITATION },
                { label: 'Easy ✅', quality: AnswerQuality.PERFECT },
            ],
        };
    }
}

/**
 * Fill in the Blank Quiz
 */
class FillInBlankQuiz {
    /**
     * Evaluate answer with fuzzy matching
     */
    static evaluateAnswer(
        userAnswer: string,
        correctAnswer: string,
        responseTimeMs: number
    ): AnswerQuality {
        const userNormalized = userAnswer.toLowerCase().trim();
        const correctNormalized = correctAnswer.toLowerCase().trim();

        // Exact match
        if (userNormalized === correctNormalized) {
            if (responseTimeMs < 3000) {
                return AnswerQuality.PERFECT;
            } else if (responseTimeMs < 7000) {
                return AnswerQuality.CORRECT_WITH_HESITATION;
            } else {
                return AnswerQuality.CORRECT_WITH_DIFFICULTY;
            }
        }

        // Close match (typo tolerance)
        const similarity = this.calculateSimilarity(userNormalized, correctNormalized);
        if (similarity > 0.8) {
            return AnswerQuality.CORRECT_WITH_DIFFICULTY;
        }

        return AnswerQuality.INCORRECT;
    }

    private static calculateSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private static levenshteinDistance(s1: string, s2: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= s2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= s1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[s2.length][s1.length];
    }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

async function exampleUsage() {
    const client = new VocabularyLearningClient();
    const userId = 'user123';

    // Example 1: Check user's progress
    console.log('=== Example 1: Check Progress ===');
    const stats = await client.getStats(userId);
    console.log('User Statistics:', stats);
    console.log(`Due today: ${stats.dueToday} words`);
    console.log(`Success rate: ${stats.overallSuccessRate}%`);

    // Example 2: Start a learning session
    console.log('\n=== Example 2: Learning Session ===');
    const session = new LearningSession(client, userId);
    await session.start({ limit: 10 });

    while (!session.isComplete()) {
        const word = session.getCurrentWord();
        if (!word) break;

        console.log(`\nWord: ${word.word.word}`);
        console.log(`Meaning: ${word.word.meaning}`);
        console.log(`Is new: ${word.isNew}`);

        // Simulate user answering (in real app, this would be from UI)
        const quality = Math.random() > 0.3 
            ? AnswerQuality.PERFECT 
            : AnswerQuality.INCORRECT;
        
        session.recordAnswer(quality);

        const progress = session.getProgress();
        console.log(`Progress: ${progress.current}/${progress.total} (${progress.percentage.toFixed(0)}%)`);
    }

    // Submit all answers
    await session.submit();
    
    const sessionStats = session.getSessionStats();
    console.log('\nSession Results:');
    console.log(`Correct: ${sessionStats.correct}/${sessionStats.total}`);
    console.log(`Success Rate: ${sessionStats.successRate.toFixed(1)}%`);

    // Example 3: Multiple choice quiz
    console.log('\n=== Example 3: Multiple Choice Quiz ===');
    const startTime = Date.now();
    const userChoice = 'correct answer';
    const correctAnswer = 'correct answer';
    const responseTime = Date.now() - startTime;

    const quality = MultipleChoiceQuiz.evaluateAnswer(
        userChoice,
        correctAnswer,
        responseTime
    );
    console.log(`Answer quality: ${quality}`);

    // Example 4: Flashcard self-assessment
    console.log('\n=== Example 4: Flashcard Self-Assessment ===');
    const flashcardUI = FlashcardQuiz.userSelfAssessment();
    console.log('Available buttons:');
    flashcardUI.buttons.forEach(btn => {
        console.log(`  - ${btn.label} (quality: ${btn.quality})`);
    });
}

// Uncomment to run examples:
// exampleUsage().catch(console.error);

// ============================================================================
// EXPORTS
// ============================================================================

export {
    VocabularyLearningClient,
    LearningSession,
    MultipleChoiceQuiz,
    FlashcardQuiz,
    FillInBlankQuiz,
    AnswerQuality,
    type WordProgress,
    type DueWord,
    type ProgressStats,
};
