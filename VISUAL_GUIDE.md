# Spaced Repetition System - Visual Guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend App                             │
│  (Learning Session, Flashcards, Quiz, Statistics Dashboard)     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Word Progress Controller                      │
│  Routes: /users/:userId/word-progress/*                         │
├─────────────────────────────────────────────────────────────────┤
│  • POST /record-answer       - Record single answer              │
│  • POST /record-answers      - Bulk record answers               │
│  • GET  /due-words           - Get words for review              │
│  • GET  /stats               - Get learning statistics           │
│  • GET  /words/:wordId       - Get word progress                 │
│  • DELETE /words/:wordId/reset - Reset progress                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Word Progress Service                         │
│  Business Logic & SM-2 Algorithm Implementation                  │
├─────────────────────────────────────────────────────────────────┤
│  • calculateNextReview() - SM-2 algorithm core                   │
│  • recordAnswer()        - Update progress                       │
│  • getDueWords()         - Smart word selection                  │
│  • getProgressStats()    - Calculate statistics                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Prisma ORM Layer                            │
│  Type-safe database access                                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                           │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                         │
│  • courses          - Learning courses                           │
│  • lessons          - Course lessons                             │
│  • words            - Vocabulary words                           │
│  • word_progress    - Spaced repetition data (NEW!)             │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                         word_progress                            │
├─────────────────────────────────────────────────────────────────┤
│  id                   UUID       Primary Key                     │
│  word_id              UUID       Foreign Key → words.id          │
│  user_login_id        UUID       User identifier                 │
│                                                                   │
│  ease_factor          FLOAT      How easy (1.3 - 3.0+)          │
│  interval             INT        Days until next (0 - ∞)        │
│  repetitions          INT        Consecutive correct (0 - ∞)    │
│                                                                   │
│  last_reviewed_at     TIMESTAMP  Last review time                │
│  next_review_at       TIMESTAMP  When to review next             │
│                                                                   │
│  total_reviews        INT        All-time review count           │
│  correct_reviews      INT        Correct answer count            │
│                                                                   │
│  created_at           TIMESTAMP                                  │
│  updated_at           TIMESTAMP                                  │
├─────────────────────────────────────────────────────────────────┤
│  Indexes:                                                        │
│  • UNIQUE(word_id, user_login_id)                               │
│  • INDEX(user_login_id, next_review_at)                         │
│  • INDEX(word_id)                                               │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Learning Flow

```
┌──────────────┐
│ User Opens   │
│   App        │
└──────┬───────┘
       │
       ▼
┌──────────────────────────┐
│ GET /due-words           │
│ Returns words to review  │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  Words Sorted:                               │
│  1. Overdue words (oldest first)             │
│  2. New words (never reviewed)               │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ User Reviews Words       │
│ • Flashcards             │
│ • Multiple Choice        │
│ • Fill in Blanks         │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ For Each Answer:                             │
│ User rates quality (0-5)                     │
│ • 0 = Complete blackout                      │
│ • 1 = Wrong                                  │
│ • 2 = Wrong but obvious                      │
│ • 3 = Correct but hard                       │
│ • 4 = Correct with hesitation                │
│ • 5 = Perfect recall                         │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ POST /record-answers     │
│ (Bulk submission)        │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│ SM-2 Algorithm Calculates:                   │
│                                              │
│ IF quality < 3:                              │
│   • repetitions = 0                          │
│   • interval = 1 day                         │
│   • Reset progress                           │
│                                              │
│ IF quality ≥ 3:                              │
│   • repetitions += 1                         │
│   • Update ease_factor                       │
│   • Calculate new interval:                  │
│     - 1st review: 1 day                      │
│     - 2nd review: 6 days                     │
│     - 3+ review: interval × ease_factor      │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Database Updated         │
│ • next_review_at set     │
│ • Stats incremented      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Show Results to User     │
│ • Correct: 18/20         │
│ • Success Rate: 90%      │
│ • Next session: 5 words  │
└──────────────────────────┘
```

## 🧮 SM-2 Algorithm Example

```
Word: "serendipity"
═══════════════════════════════════════════════════════════

Review #1 (Day 0)
├─ Initial: EF=2.5, I=0, R=0
├─ User Quality: 5 (Perfect)
├─ Calculate: EF = 2.5 + 0.1 = 2.6
├─ R = 1 (first repetition)
├─ I = 1 day (first review)
└─ Next Review: Day 1

Review #2 (Day 1)
├─ Current: EF=2.6, I=1, R=1
├─ User Quality: 4 (Good)
├─ Calculate: EF = 2.6 + 0.0 = 2.6
├─ R = 2 (second repetition)
├─ I = 6 days (second review)
└─ Next Review: Day 7

Review #3 (Day 7)
├─ Current: EF=2.6, I=6, R=2
├─ User Quality: 5 (Perfect)
├─ Calculate: EF = 2.6 + 0.1 = 2.7
├─ R = 3 (third repetition)
├─ I = 6 × 2.7 = 16 days
└─ Next Review: Day 23

Review #4 (Day 23)
├─ Current: EF=2.7, I=16, R=3
├─ User Quality: 3 (Hard)
├─ Calculate: EF = 2.7 - 0.14 = 2.56
├─ R = 4 (fourth repetition)
├─ I = 16 × 2.56 = 41 days
└─ Next Review: Day 64

Review #5 (Day 64)
├─ Current: EF=2.56, I=41, R=4
├─ User Quality: 1 (Wrong!)
├─ Calculate: EF = 2.56 - 0.34 = 2.22
├─ R = 0 (RESET!)
├─ I = 1 day (start over)
└─ Next Review: Day 65

═══════════════════════════════════════════════════════════
Result: Word moved back to learning phase
```

## 📈 Word Lifecycle States

```
NEW                    LEARNING                   REVIEW
(R = 0)               (R = 1-2)                  (R ≥ 3)
   │                      │                         │
   │ Review 1            │ Review 2                │ Review 3+
   │ Quality ≥ 3         │ Quality ≥ 3             │ Quality ≥ 3
   └──────────────────►  └──────────────────►      └──────────────────►
                                                    
        ┌───────────────────────────────────────┐
        │  Quality < 3: Reset to NEW (R = 0)    │
        └───────────────────────────────────────┘
                         ▲
                         │
                    Any State
```

## 🎯 Quality Rating Guide

```
╔═══════════════════════════════════════════════════════════════╗
║  Quality  │  Label           │  User Experience              ║
╠═══════════════════════════════════════════════════════════════╣
║    5      │  Perfect         │  "I knew it instantly!"       ║
║           │  😊              │  Immediate recall             ║
║           │                  │  No hesitation                ║
╟───────────────────────────────────────────────────────────────╢
║    4      │  Good            │  "Got it, but needed a       ║
║           │  🙂              │  moment to think"             ║
║           │                  │  Slight hesitation            ║
╟───────────────────────────────────────────────────────────────╢
║    3      │  Hard            │  "That was difficult,        ║
║           │  😅              │  but I got it"                ║
║           │                  │  Struggled but correct        ║
╟───────────────────────────────────────────────────────────────╢
║    2      │  Wrong (Easy)    │  "I was wrong, but now       ║
║           │  😔              │  it's obvious"                ║
║           │                  │  Makes sense when shown       ║
╟───────────────────────────────────────────────────────────────╢
║    1      │  Wrong           │  "I was wrong, but I've      ║
║           │  😓              │  seen this before"            ║
║           │                  │  Vaguely familiar             ║
╟───────────────────────────────────────────────────────────────╢
║    0      │  Blackout        │  "I have absolutely no       ║
║           │  😰              │  idea"                        ║
║           │                  │  Complete failure to recall   ║
╚═══════════════════════════════════════════════════════════════╝

         Quality ≥ 3  →  Progress continues
         Quality < 3  →  Reset to 1 day
```

## 📊 Statistics Dashboard Data

```
┌───────────────────────────────────────────────────────────┐
│                  User Progress Overview                    │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  Total Words:        150                                   │
│                                                            │
│  📝 New:              30  (20%)  ███████                   │
│  📚 Learning:         45  (30%)  ██████████               │
│  ✅ Review:           75  (50%)  █████████████████        │
│                                                            │
│  🔥 Due Today:        20                                   │
│  📊 Success Rate:     85.5%                                │
│                                                            │
│  Last Session:       18/20 correct                         │
│  Current Streak:     7 days                                │
│  Total Reviews:      457                                   │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

## 🔍 API Response Examples

### GET /due-words

```json
[
  {
    "id": "progress-123",
    "wordId": "word-abc",
    "userLoginId": "user-xyz",
    "easeFactor": 2.6,
    "interval": 6,
    "repetitions": 2,
    "lastReviewedAt": "2026-02-05T10:00:00.000Z",
    "nextReviewAt": "2026-02-06T10:00:00.000Z",
    "totalReviews": 3,
    "correctReviews": 2,
    "successRate": 66.7,
    "word": {
      "id": "word-abc",
      "word": "serendipity",
      "meaning": "Finding something good without looking for it",
      "pronunciation": "/ˌserənˈdɪpəti/",
      "partOfSpeech": "noun",
      "audioUrl": "https://example.com/audio.mp3",
      "lessonId": "lesson-123"
    },
    "isNew": false
  }
]
```

## 🚀 Quick Integration Checklist

```
□ Apply database migration
   └─ npx prisma migrate deploy

□ Update Prisma client
   └─ npx prisma generate

□ Verify build
   └─ npm run build

□ Test endpoints
   ├─ GET /due-words
   ├─ POST /record-answer
   └─ GET /stats

□ Frontend integration
   ├─ Create learning session UI
   ├─ Map quiz results to quality (0-5)
   ├─ Display progress statistics
   └─ Handle due word notifications

□ Monitor & optimize
   ├─ Track success rates
   ├─ Monitor daily active users
   └─ Analyze retention metrics
```

## 💡 Pro Tips

1. **Session Design**
   - Show 10-20 words per session
   - Mix overdue and new words
   - Allow users to stop mid-session

2. **Quality Mapping**
   - Multiple choice: correct=5, wrong=1
   - Flashcards: let user self-assess
   - Timed: fast=5, slow=4, wrong=1-2

3. **Gamification**
   - Show streak counts
   - Award badges for milestones
   - Display success rate trends

4. **Performance**
   - Use bulk endpoints
   - Cache due words during session
   - Preload word audio/images

5. **User Experience**
   - Explain the quality scale clearly
   - Show when next review is due
   - Celebrate progress milestones

---

Made with ❤️ for effective vocabulary learning
```
