# Spaced Repetition - Quick Start Guide

## 🚀 Quick Setup

### 1. Run Migration (if not already done)
```bash
npx prisma migrate deploy
```

### 2. Start the Server
```bash
npm run start:dev
```

## 📖 Common Use Cases

### Use Case 1: Starting a Learning Session

```typescript
// Frontend: Get 20 words due for review
const response = await fetch(
  'http://localhost:3000/users/user123/word-progress/due-words?limit=20'
);
const words = await response.json();

// words will contain both:
// - Overdue words (sorted by how overdue they are)
// - New words (if includeNew=true)
```

### Use Case 2: Recording User Answers

After the user completes a quiz/flashcard session:

```typescript
// Single answer
await fetch('http://localhost:3000/users/user123/word-progress/record-answer', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wordId: 'word-uuid',
    quality: 5  // 0-5 scale
  })
});

// Or bulk (better performance)
await fetch('http://localhost:3000/users/user123/word-progress/record-answers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    answers: [
      { wordId: 'word-1', quality: 5 },
      { wordId: 'word-2', quality: 3 },
      { wordId: 'word-3', quality: 1 }
    ]
  })
});
```

### Use Case 3: Display User Progress

```typescript
// Get statistics
const stats = await fetch(
  'http://localhost:3000/users/user123/word-progress/stats'
).then(r => r.json());

console.log({
  total: stats.totalWords,
  new: stats.newWords,
  learning: stats.learningWords,
  review: stats.reviewWords,
  due: stats.dueToday,
  success: stats.overallSuccessRate
});
```

### Use Case 4: Filter by Course or Lesson

```typescript
// Get due words for a specific course
const courseWords = await fetch(
  'http://localhost:3000/users/user123/word-progress/due-words?courseId=course-123&limit=10'
).then(r => r.json());

// Get stats for a specific lesson
const lessonStats = await fetch(
  'http://localhost:3000/users/user123/word-progress/stats?lessonId=lesson-456'
).then(r => r.json());
```

## 🎯 Answer Quality Reference

Help your users understand the 0-5 quality scale:

| Quality | Label | When to Use | Effect |
|---------|-------|-------------|--------|
| 5 | Perfect | Instant recall, no hesitation | Longest interval increase |
| 4 | Good | Correct, slight hesitation | Good interval increase |
| 3 | Hard | Correct but struggled | Minimal interval increase |
| 2 | Wrong-Easy | Wrong, but obvious when shown | Reset to 1 day |
| 1 | Wrong | Wrong, vaguely familiar | Reset to 1 day |
| 0 | Blackout | Completely forgot | Reset to 1 day |

**Key Rule:** Quality ≥ 3 = Progress continues | Quality < 3 = Reset to day 1

## 📊 Understanding the Response

### Word Progress Object

```typescript
{
  "id": "progress-uuid",
  "wordId": "word-uuid",
  "userLoginId": "user-uuid",
  
  // SM-2 Algorithm fields
  "easeFactor": 2.6,      // Higher = easier word (1.3 to ~3.0)
  "interval": 6,          // Days until next review
  "repetitions": 2,       // Consecutive correct answers
  
  // Review tracking
  "lastReviewedAt": "2026-02-06T09:15:44.000Z",
  "nextReviewAt": "2026-02-12T09:15:44.000Z",
  
  // Statistics
  "totalReviews": 5,      // All time review count
  "correctReviews": 4,    // Correct answers (quality ≥ 3)
  "successRate": 80.0     // Percentage correct
}
```

### Due Word Object

Includes all progress fields PLUS:

```typescript
{
  // ... all progress fields ...
  
  "word": {
    "id": "word-uuid",
    "word": "serendipity",
    "meaning": "Finding something good without looking for it",
    "pronunciation": "/ˌserənˈdɪpəti/",
    "partOfSpeech": "noun",
    "audioUrl": "https://...",
    "lessonId": "lesson-uuid"
  },
  
  "isNew": false  // true if never reviewed before
}
```

## 🔥 Best Practices

### 1. Session Size
- **Recommended:** 10-20 words per session
- **Maximum:** 50 words (prevents fatigue)
- Mix new and review words

### 2. Quality Assignment
```typescript
// Good: Map quiz results to quality
const quality = calculateQuality(userAnswer, correctAnswer, responseTime);

// Examples:
// - Multiple choice: correct=5, wrong=1
// - Fill in blank: correct fast=5, correct slow=4, close=3, wrong=1
// - Flashcard: self-report using UI buttons
```

### 3. Timing
- Show due count to encourage daily practice
- Recommend reviewing at same time each day
- Don't force users to complete all due words at once

### 4. UI/UX Tips
```typescript
// Show progress during session
const completedWords = 15;
const totalWords = 20;
const progress = (completedWords / totalWords) * 100;

// Show next review time
const nextReview = new Date(word.nextReviewAt);
const daysUntil = Math.ceil(
  (nextReview - new Date()) / (1000 * 60 * 60 * 24)
);
console.log(`Next review in ${daysUntil} days`);
```

## 🐛 Testing Locally

### Test with cURL

```bash
# Get due words
curl http://localhost:3000/users/user123/word-progress/due-words

# Record an answer
curl -X POST http://localhost:3000/users/user123/word-progress/record-answer \
  -H "Content-Type: application/json" \
  -d '{
    "wordId": "01936b3e-7c8f-7890-abcd-ef1234567890",
    "quality": 4
  }'

# Get stats
curl http://localhost:3000/users/user123/word-progress/stats
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test word-progress.service.spec

# Run with coverage
npm run test:cov
```

## 📈 Monitoring

### Key Metrics to Track

1. **Daily Active Users** - Users who review words each day
2. **Average Session Length** - Words reviewed per session
3. **Success Rate** - Overall correct answer percentage
4. **Retention** - Users still active after 7, 30, 90 days
5. **Word Mastery** - Words reaching repetition ≥ 3

### Database Queries

```sql
-- Users who reviewed today
SELECT COUNT(DISTINCT user_login_id) 
FROM word_progress 
WHERE DATE(last_reviewed_at) = CURRENT_DATE;

-- Average success rate
SELECT AVG(
  CASE WHEN total_reviews > 0 
    THEN (correct_reviews::float / total_reviews * 100) 
    ELSE 0 
  END
) as avg_success_rate
FROM word_progress;

-- Words overdue by more than 1 day
SELECT COUNT(*) 
FROM word_progress 
WHERE next_review_at < CURRENT_DATE - INTERVAL '1 day';
```

## 🔧 Troubleshooting

### Issue: Too many due words overwhelming users

**Solution 1:** Limit to 20-30 words per day
```typescript
const limit = Math.min(stats.dueToday, 30);
```

**Solution 2:** Prioritize by lesson/course
```typescript
// Get due words from current lesson first
const lessonWords = await getDueWords({ lessonId: currentLesson, limit: 20 });
```

### Issue: Users finding words too easy/hard

**Solution:** The algorithm self-adjusts, but you can:
- Let users manually reset progress
- Provide "I know this word" button for bulk skip
- Allow manual difficulty adjustment

### Issue: New users have no due words

**Solution:** Show new words by default
```typescript
const words = await getDueWords({ 
  includeNew: true,
  limit: 20 
});

if (words.length === 0) {
  // Prompt user to add words to their courses
  showAddWordsPrompt();
}
```

## 📚 Additional Resources

- [Full Documentation](./SPACED_REPETITION.md)
- [SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [API Reference](http://localhost:3000/api) - Swagger docs

## 💡 Pro Tips

1. **Cache aggressively** - Due words don't change mid-session
2. **Preload assets** - Download audio/images before quiz starts
3. **Offline support** - Queue answers locally, sync when online
4. **Gamification** - Add streaks, achievements, leaderboards
5. **Analytics** - Track which words are hardest, adjust content

## 🎓 Example Learning Flow

```
1. User opens app
   ↓
2. Show "20 words due today!" notification
   ↓
3. Call GET /due-words?limit=20
   ↓
4. User reviews words (quiz/flashcards)
   ↓
5. Record answers with quality 0-5
   ↓
6. Call POST /record-answers (bulk)
   ↓
7. Show results: "18/20 correct! 🎉"
   ↓
8. Update stats display
   ↓
9. Schedule next session
```

Happy learning! 🚀
