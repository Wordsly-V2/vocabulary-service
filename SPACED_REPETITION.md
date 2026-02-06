# Word Progress & Spaced Repetition System

## Overview

This module implements a production-ready spaced repetition system for vocabulary learning using the **SuperMemo SM-2 algorithm**. It tracks learning progress for each word and optimizes review schedules to maximize retention.

## Features

✅ **SM-2 Spaced Repetition Algorithm** - Industry-standard algorithm used by Anki and other popular learning apps
✅ **Proficiency Tracking** - Records ease factor, interval, and repetitions for each word
✅ **Smart Review Scheduling** - Automatically calculates optimal review times
✅ **Comprehensive Statistics** - Track learning progress, success rates, and due words
✅ **Bulk Operations** - Record multiple answers efficiently
✅ **Filtering** - Get due words by course, lesson, or overall
✅ **Production Ready** - Full error handling, validation, and database indexes

## Database Schema

### WordProgress Model

```prisma
model WordProgress {
  id              String   @id @db.Uuid
  wordId          String   @db.Uuid
  userLoginId     String   @db.Uuid
  
  // SM-2 Algorithm fields
  easeFactor      Float    @default(2.5)  // How easy the word is (1.3-3.0+)
  interval        Int      @default(0)     // Days until next review
  repetitions     Int      @default(0)     // Consecutive correct answers
  
  // Review tracking
  lastReviewedAt  DateTime?
  nextReviewAt    DateTime  @default(now())
  
  // Statistics
  totalReviews    Int      @default(0)
  correctReviews  Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@unique([wordId, userLoginId])
  @@index([userLoginId, nextReviewAt])
}
```

## API Endpoints

### Base URL: `/users/:userLoginId/word-progress`

### 1. Record Answer
**POST** `/record-answer`

Records a single answer and updates the spaced repetition schedule.

**Request Body:**
```json
{
  "wordId": "01936b3e-7c8f-7890-abcd-ef1234567890",
  "quality": 4
}
```

**Answer Quality Scale (0-5):**
- `0` - Complete blackout (couldn't recall)
- `1` - Incorrect, but remembered when shown
- `2` - Incorrect, but it seemed easy when shown
- `3` - Correct, but with serious difficulty
- `4` - Correct, after some hesitation
- `5` - Perfect recall

**Response:**
```json
{
  "id": "01936b3e-7c8f-7890-abcd-ef1234567890",
  "wordId": "01936b3e-7c8f-7890-abcd-ef1234567890",
  "userLoginId": "user123",
  "easeFactor": 2.6,
  "interval": 6,
  "repetitions": 2,
  "lastReviewedAt": "2026-02-06T09:15:44.000Z",
  "nextReviewAt": "2026-02-12T09:15:44.000Z",
  "totalReviews": 3,
  "correctReviews": 2,
  "successRate": 66.7
}
```

### 2. Record Multiple Answers (Bulk)
**POST** `/record-answers`

Records multiple answers at once for better performance.

**Request Body:**
```json
{
  "answers": [
    { "wordId": "word-id-1", "quality": 5 },
    { "wordId": "word-id-2", "quality": 3 },
    { "wordId": "word-id-3", "quality": 4 }
  ]
}
```

### 3. Get Due Words
**GET** `/due-words`

Retrieves words that are due for review based on spaced repetition.

**Query Parameters:**
- `courseId` (optional) - Filter by specific course
- `lessonId` (optional) - Filter by specific lesson
- `limit` (optional, default: 20, max: 100) - Number of words to return
- `includeNew` (optional, default: true) - Include new words not yet reviewed

**Example:**
```
GET /users/user123/word-progress/due-words?limit=10&courseId=course-123
```

**Response:**
```json
[
  {
    "id": "progress-id",
    "wordId": "word-id",
    "userLoginId": "user123",
    "easeFactor": 2.5,
    "interval": 1,
    "repetitions": 1,
    "lastReviewedAt": "2026-02-05T09:15:44.000Z",
    "nextReviewAt": "2026-02-06T09:15:44.000Z",
    "totalReviews": 2,
    "correctReviews": 1,
    "successRate": 50,
    "word": {
      "id": "word-id",
      "word": "serendipity",
      "meaning": "The occurrence of events by chance in a happy way",
      "pronunciation": "/ˌserənˈdɪpəti/",
      "partOfSpeech": "noun",
      "audioUrl": "https://example.com/audio.mp3",
      "lessonId": "lesson-id"
    },
    "isNew": false
  }
]
```

### 4. Get Progress Statistics
**GET** `/stats`

Retrieves comprehensive learning statistics.

**Query Parameters:**
- `courseId` (optional) - Filter by specific course
- `lessonId` (optional) - Filter by specific lesson

**Response:**
```json
{
  "totalWords": 150,
  "newWords": 30,
  "learningWords": 45,
  "reviewWords": 75,
  "dueToday": 20,
  "overallSuccessRate": 85.5
}
```

### 5. Get Word Progress
**GET** `/words/:wordId`

Gets the learning progress for a specific word.

### 6. Reset Progress
**DELETE** `/words/:wordId/reset`

Resets all learning progress for a word, allowing a fresh start.

## SM-2 Algorithm Explanation

The **SuperMemo SM-2** algorithm is used to calculate optimal review intervals:

### Key Concepts

1. **Ease Factor (EF)**: Represents how easy a word is to remember
   - Initial value: 2.5
   - Minimum: 1.3
   - Updated after each review based on quality

2. **Interval (I)**: Days until next review
   - Starts at 0 (new word)
   - First review: 1 day
   - Second review: 6 days
   - Subsequent: Previous interval × Ease Factor

3. **Repetitions (R)**: Consecutive correct answers
   - Resets to 0 if quality < 3
   - Increments by 1 if quality ≥ 3

### Algorithm Formula

**Ease Factor Calculation:**
```
EF' = EF + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
```
Where `q` is the answer quality (0-5)

**Interval Calculation:**
- If quality < 3: I = 1, R = 0 (restart)
- If R = 1: I = 1
- If R = 2: I = 6
- If R > 2: I = I(previous) × EF

### Example Learning Path

```
Review 1: Quality 4 → Next review in 1 day (EF: 2.5)
Review 2: Quality 5 → Next review in 6 days (EF: 2.6)
Review 3: Quality 4 → Next review in 16 days (EF: 2.7)
Review 4: Quality 3 → Next review in 43 days (EF: 2.56)
Review 5: Quality 2 → Next review in 1 day (EF: 2.24, R reset)
```

## Word States

Words are categorized into three states:

1. **New** - Not yet reviewed (`repetitions = 0`, no progress record)
2. **Learning** - Being learned (`repetitions < 3`)
3. **Review** - In review phase (`repetitions ≥ 3`)

## Usage Example - Frontend Integration

### 1. Start a Learning Session

```typescript
// Get 20 words due for review
const response = await fetch(
  '/users/user123/word-progress/due-words?limit=20&includeNew=true'
);
const dueWords = await response.json();
```

### 2. Record User Answers

```typescript
// After user completes a quiz
const answers = [
  { wordId: 'word-1', quality: 5 }, // Perfect
  { wordId: 'word-2', quality: 3 }, // Correct but difficult
  { wordId: 'word-3', quality: 1 }, // Incorrect
];

await fetch('/users/user123/word-progress/record-answers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ answers })
});
```

### 3. Display Statistics

```typescript
// Show user their progress
const stats = await fetch('/users/user123/word-progress/stats')
  .then(r => r.json());

console.log(`
  Total Words: ${stats.totalWords}
  Due Today: ${stats.dueToday}
  Success Rate: ${stats.overallSuccessRate}%
`);
```

## Best Practices

### 1. Answer Quality Guidelines

Help users understand the quality scale:

```
5 = "I knew it instantly!" 😊
4 = "I got it, but needed a moment" 🤔
3 = "That was hard, but I got it" 😅
2 = "I was wrong, but it makes sense now" 😔
1 = "I was wrong, but I remembered seeing it" 😓
0 = "I have no idea" 😰
```

### 2. Review Session Size

- Recommended: 10-20 words per session
- Maximum: 50 words to prevent fatigue
- Mix of new words and reviews for variety

### 3. Daily Practice

- Show `dueToday` count to encourage daily reviews
- Gamify with streaks and achievements
- Send notifications when words are due

### 4. Performance Optimization

- Use bulk endpoints (`/record-answers`) when possible
- Cache due words on the client side during a session
- Prefetch word audio/images before starting a session

## Database Indexes

The following indexes ensure optimal query performance:

```prisma
@@unique([wordId, userLoginId])           // Fast progress lookup
@@index([userLoginId, nextReviewAt])      // Fast due words query
@@index([wordId])                         // Fast word-based queries
```

## Error Handling

All endpoints include proper error handling:

- `404` - Word not found or user doesn't have access
- `400` - Invalid input (quality out of range, invalid UUID)
- `500` - Server error (logged for debugging)

## Testing

The system should be tested with:

1. **Unit Tests** - SM-2 algorithm calculations
2. **Integration Tests** - Database operations
3. **E2E Tests** - Full user learning flow
4. **Load Tests** - Bulk operations with many words

## Migration Guide

To apply the database changes:

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate deploy
```

## Future Enhancements

Potential improvements for future versions:

- [ ] SM-17 or SM-18 algorithm (more advanced)
- [ ] Configurable algorithm parameters per user
- [ ] Difficulty prediction using machine learning
- [ ] Word grouping and context-based learning
- [ ] Forgetting curve visualization
- [ ] Export/import learning data
- [ ] Learning analytics dashboard

## References

- [SuperMemo SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Anki Manual - Spaced Repetition](https://docs.ankiweb.net/background.html)
- [Spaced Repetition Research](https://www.gwern.net/Spaced-repetition)

## Support

For questions or issues, please contact the development team or create an issue in the repository.
