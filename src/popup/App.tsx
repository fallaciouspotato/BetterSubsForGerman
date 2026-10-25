import { useState, useEffect } from 'preact/hooks';
import { db, type Word, type Occurrence } from '../db/schema';
import { filterDueWords, parseCard } from '../srs/scheduler';
import { processReview, type StageTransition } from '../srs/review';
import { getLatestOccurrenceForWord } from '../db/occurrences';
import { Rating, type Grade } from 'ts-fsrs';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'quiz' | 'words'>('overview');
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [dueWords, setDueWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  // Quiz session state
  const [quizQueue, setQuizQueue] = useState<Word[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [currentOccurrence, setCurrentOccurrence] = useState<Occurrence | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{
    transition: StageTransition;
    word: string;
    nextStage: number;
    correctDaysCount: number;
  } | null>(null);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  // Words list filter
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const words = await db.words.toArray();
      setAllWords(words);
      const due = filterDueWords(words);
      setDueWords(due);
    } catch (err) {
      console.warn('Failed to load DB in popup:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const startQuiz = async (onlyDue: boolean = true) => {
    const queue = onlyDue && dueWords.length > 0 ? [...dueWords] : [...allWords];
    if (queue.length === 0) return;

    setQuizQueue(queue);
    setCurrentQuizIndex(0);
    setIsRevealed(false);
    setLastFeedback(null);
    setSessionCompleted(false);
    setReviewedCount(0);
    setActiveTab('quiz');

    await loadOccurrenceForWord(queue[0]);
  };

  const loadOccurrenceForWord = async (word: Word) => {
    if (!word || !word.id) return;
    try {
      const occ = await getLatestOccurrenceForWord(word.id);
      setCurrentOccurrence(occ || null);
    } catch {
      setCurrentOccurrence(null);
    }
  };

  const handleRating = async (rating: Grade) => {
    const currentWord = quizQueue[currentQuizIndex];
    if (!currentWord || !currentWord.id) return;

    try {
      const result = await processReview(currentWord.id, rating);
      setReviewedCount((prev) => prev + 1);

      setLastFeedback({
        transition: result.stageTransition,
        word: result.word.lemma,
        nextStage: result.word.stage,
        correctDaysCount: result.word.correctDays?.length || 0,
      });

      // Advance to next card or complete
      if (currentQuizIndex + 1 < quizQueue.length) {
        const nextIdx = currentQuizIndex + 1;
        setCurrentQuizIndex(nextIdx);
        setIsRevealed(false);
        await loadOccurrenceForWord(quizQueue[nextIdx]);
      } else {
        setSessionCompleted(true);
      }

      // Refresh words in background
      loadData();
    } catch (err) {
      console.error('Error processing review:', err);
    }
  };

  const currentWord = quizQueue[currentQuizIndex];

  const stage1Count = allWords.filter((w) => w.stage === 1).length;
  const stage2Count = allWords.filter((w) => w.stage === 2).length;
  const stage3Count = allWords.filter((w) => w.stage === 3).length;

  const filteredWords = allWords.filter(
    (w) =>
      w.lemma.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.glosses.some((g) => g.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #363a4f', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🇩🇪</span>
          <div>
            <h1 style={{ fontSize: '15px', fontWeight: 'bold', color: '#8aadf4', margin: 0 }}>Dual Sub</h1>
            <span style={{ fontSize: '11px', color: '#a5adcb' }}>German Language Learning</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'overview' ? '#8aadf4' : '#24273a',
              color: activeTab === 'overview' ? '#181926' : '#cad3f5',
              fontWeight: 600,
            }}
          >
            Overview
          </button>
          <button
            onClick={() => startQuiz(true)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'quiz' ? '#eed49f' : '#24273a',
              color: activeTab === 'quiz' ? '#181926' : '#cad3f5',
              fontWeight: 600,
            }}
          >
            Quiz {dueWords.length > 0 && `(${dueWords.length})`}
          </button>
          <button
            onClick={() => setActiveTab('words')}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'words' ? '#a6da95' : '#24273a',
              color: activeTab === 'words' ? '#181926' : '#cad3f5',
              fontWeight: 600,
            }}
          >
            Words ({allWords.length})
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Due Banner */}
          <div
            style={{
              background: dueWords.length > 0 ? '#363a4f' : '#1e2030',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid #494d64',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#f5bde6' }}>
                {dueWords.length > 0 ? `${dueWords.length} words due for review!` : 'All caught up! 🎉'}
              </div>
              <div style={{ fontSize: '12px', color: '#a5adcb', marginTop: '2px' }}>
                {dueWords.length > 0 ? 'FSRS spaced repetition review is ready.' : 'Great job! You reviewed all scheduled words.'}
              </div>
            </div>
            <button
              onClick={() => startQuiz(dueWords.length > 0)}
              style={{
                background: '#eed49f',
                color: '#181926',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 12px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {dueWords.length > 0 ? 'Start Review' : 'Practice All'}
            </button>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div style={{ background: '#24273a', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#a5adcb', marginBottom: '4px' }}>STAGE 1</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8aadf4' }}>{stage1Count}</div>
              <div style={{ fontSize: '10px', color: '#6e738d' }}>Both Subtitles</div>
            </div>
            <div style={{ background: '#24273a', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#a5adcb', marginBottom: '4px' }}>STAGE 2</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#eed49f' }}>{stage2Count}</div>
              <div style={{ fontSize: '10px', color: '#6e738d' }}>Gloss Masked</div>
            </div>
            <div style={{ background: '#24273a', padding: '10px', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#a5adcb', marginBottom: '4px' }}>STAGE 3</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#a6da95' }}>{stage3Count}</div>
              <div style={{ fontSize: '10px', color: '#6e738d' }}>Word Masked</div>
            </div>
          </div>

          {/* 2-Day Rule Explanation */}
          <div style={{ background: '#1e2030', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', color: '#a5adcb', borderLeft: '3px solid #8aadf4' }}>
            <strong style={{ color: '#cad3f5' }}>2-Day Promotion Rule:</strong> A word advances to the next stage only after correct answers on at least <strong>two separate days</strong>. An &quot;Again&quot; response demotes by 1 stage.
          </div>

          {/* Recently Saved Words Preview */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#cad3f5', marginBottom: '6px' }}>
              Recently Saved Words
            </div>
            {allWords.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#6e738d', textAlign: 'center', padding: '16px 0' }}>
                No words saved yet. Click words in the YouTube subtitle overlay to save them!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allWords.slice(0, 4).map((w) => (
                  <div
                    key={w.id}
                    style={{
                      background: '#24273a',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#8aadf4', marginRight: '8px' }}>{w.lemma}</span>
                      <span style={{ fontSize: '12px', color: '#a5adcb' }}>{w.glosses.slice(0, 2).join(', ')}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: w.stage === 3 ? '#a6da95' : w.stage === 2 ? '#eed49f' : '#8aadf4',
                        color: '#181926',
                      }}
                    >
                      Stage {w.stage}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quiz Tab */}
      {activeTab === 'quiz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessionCompleted ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🎉</div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#a6da95', marginBottom: '6px' }}>
                Session Completed!
              </h2>
              <p style={{ fontSize: '13px', color: '#a5adcb', marginBottom: '16px' }}>
                You reviewed <strong>{reviewedCount}</strong> words. Your memory stability has been updated with FSRS.
              </p>
              <button
                onClick={() => setActiveTab('overview')}
                style={{
                  background: '#8aadf4',
                  color: '#181926',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Back to Dashboard
              </button>
            </div>
          ) : !currentWord ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <p style={{ color: '#a5adcb', fontSize: '13px' }}>No words in quiz queue.</p>
              <button
                onClick={() => startQuiz(false)}
                style={{
                  background: '#8aadf4',
                  color: '#181926',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginTop: '10px',
                  cursor: 'pointer',
                }}
              >
                Practice All Saved Words
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Progress counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a5adcb' }}>
                <span>Word {currentQuizIndex + 1} of {quizQueue.length}</span>
                <span
                  style={{
                    background: currentWord.stage === 3 ? '#a6da95' : currentWord.stage === 2 ? '#eed49f' : '#8aadf4',
                    color: '#181926',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  Stage {currentWord.stage}
                </span>
              </div>

              {/* Flashcard Box */}
              <div
                style={{
                  background: '#24273a',
                  border: '1px solid #363a4f',
                  borderRadius: '8px',
                  padding: '16px',
                  minHeight: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '10px',
                }}
              >
                {/* Target German Word */}
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                  {currentWord.lemma}
                </div>

                {/* Sentence Context */}
                {currentOccurrence?.sentenceTarget && (
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#a0c4ff',
                      fontStyle: 'italic',
                      lineHeight: '1.4',
                      background: 'rgba(0,0,0,0.2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      width: '100%',
                    }}
                  >
                    &ldquo;{currentOccurrence.sentenceTarget}&rdquo;
                  </div>
                )}

                {/* Revealed Answer */}
                {isRevealed ? (
                  <div style={{ width: '100%', borderTop: '1px solid #363a4f', paddingTop: '10px', marginTop: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#eed49f', marginBottom: '4px' }}>
                      {currentWord.glosses.join(', ')}
                    </div>
                    {currentOccurrence?.sentenceNative && (
                      <div style={{ fontSize: '12px', color: '#a5adcb' }}>
                        &ldquo;{currentOccurrence.sentenceNative}&rdquo;
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsRevealed(true)}
                    style={{
                      background: '#363a4f',
                      color: '#cad3f5',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: '6px',
                    }}
                  >
                    Show Translation 👁️
                  </button>
                )}
              </div>

              {/* Rating Buttons */}
              {isRevealed && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  <button
                    onClick={() => handleRating(Rating.Again)}
                    style={{
                      background: '#ed8796',
                      color: '#181926',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 4px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Again<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Demote</span>
                  </button>
                  <button
                    onClick={() => handleRating(Rating.Hard)}
                    style={{
                      background: '#f5a97f',
                      color: '#181926',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 4px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Hard<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Slow</span>
                  </button>
                  <button
                    onClick={() => handleRating(Rating.Good)}
                    style={{
                      background: '#a6da95',
                      color: '#181926',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 4px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Good<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Optimal</span>
                  </button>
                  <button
                    onClick={() => handleRating(Rating.Easy)}
                    style={{
                      background: '#8aadf4',
                      color: '#181926',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 4px',
                      fontWeight: 'bold',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Easy<br /><span style={{ fontSize: '9px', fontWeight: 'normal' }}>Fast</span>
                  </button>
                </div>
              )}

              {/* Feedback toast */}
              {lastFeedback && (
                <div
                  style={{
                    background:
                      lastFeedback.transition === 'promoted'
                        ? '#a6da95'
                        : lastFeedback.transition === 'demoted'
                        ? '#ed8796'
                        : '#363a4f',
                    color: '#181926',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  {lastFeedback.transition === 'promoted' && `🎉 Promoted "${lastFeedback.word}" to Stage ${lastFeedback.nextStage}!`}
                  {lastFeedback.transition === 'demoted' && `⚠️ Demoted "${lastFeedback.word}" to Stage ${lastFeedback.nextStage}.`}
                  {lastFeedback.transition === 'unchanged' &&
                    `✓ Recorded. (${lastFeedback.correctDaysCount}/2 correct days for next stage)`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Words List Tab */}
      {activeTab === 'words' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search saved words or translations..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #363a4f',
              background: '#24273a',
              color: '#cad3f5',
              fontSize: '12px',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '380px', overflowY: 'auto' }}>
            {filteredWords.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#6e738d', textAlign: 'center', padding: '20px 0' }}>
                No matching words found.
              </div>
            ) : (
              filteredWords.map((w) => {
                const card = parseCard(w.srsCardJson);
                const dueDateStr = card.due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return (
                  <div
                    key={w.id}
                    style={{
                      background: '#24273a',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#ffffff', fontSize: '14px' }}>{w.lemma}</span>
                        <span style={{ fontSize: '11px', color: '#8aadf4' }}>seen {w.timesSeen || 1}x</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#eed49f', marginTop: '2px' }}>
                        {w.glosses.join(', ')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: w.stage === 3 ? '#a6da95' : w.stage === 2 ? '#eed49f' : '#8aadf4',
                          color: '#181926',
                        }}
                      >
                        Stage {w.stage}
                      </span>
                      <div style={{ fontSize: '10px', color: '#a5adcb', marginTop: '3px' }}>
                        Due {dueDateStr}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
