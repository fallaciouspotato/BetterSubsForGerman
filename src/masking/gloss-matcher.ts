/**
 * Gloss matcher for identifying corresponding English words in translated cues.
 * Implements strict fail-safe rules:
 *  - Avoids common stop-word false positives.
 *  - Rejects ambiguous matches (e.g. word occurs multiple times in target sentence).
 *  - Preserves exact token boundaries.
 */

export interface GlossMatch {
  matched: string;
  start: number;
  end: number;
  gloss: string;
}

/**
 * Common English function words/stop words that should NOT be masked
 * unless the German lemma is specifically that functional word.
 */
export const COMMON_ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'it',
  'its',
  'be',
  'been',
  'being',
  'by',
  'as',
  'with',
  'that',
  'this',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'their',
  'our',
]);

const GERMAN_FUNCTION_WORDS = new Set([
  'der',
  'die',
  'das',
  'ein',
  'eine',
  'einer',
  'einem',
  'einen',
  'in',
  'an',
  'auf',
  'zu',
  'von',
  'mit',
  'für',
  'und',
  'oder',
  'ist',
  'sind',
  'war',
  'waren',
  'es',
  'er',
  'sie',
  'wir',
  'ihr',
]);

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the single unambiguous match of an English gloss in the native subtitle sentence.
 * Returns null if:
 *  - No gloss is found.
 *  - Multiple candidate matches exist (ambiguity fail-safe).
 *  - Match is a pure stop word without corresponding function word intent.
 */
export function findEnglishGloss(
  germanLemma: string,
  englishSentence: string,
  glosses: string[]
): GlossMatch | null {
  if (!englishSentence || !glosses || glosses.length === 0) {
    return null;
  }

  const cleanGerman = germanLemma.trim().toLowerCase();
  const isGermanFunctionWord = GERMAN_FUNCTION_WORDS.has(cleanGerman);

  // Generate candidate search patterns from glosses
  const candidates: Array<{ pattern: string; rawGloss: string }> = [];

  for (const rawGloss of glosses) {
    if (!rawGloss || typeof rawGloss !== 'string') continue;
    const cleanGloss = rawGloss.trim().toLowerCase();
    if (!cleanGloss) continue;

    // Check if gloss is a common stop word
    if (COMMON_ENGLISH_STOPWORDS.has(cleanGloss) && !isGermanFunctionWord) {
      continue;
    }

    // Direct gloss
    candidates.push({ pattern: cleanGloss, rawGloss });

    // If gloss is an infinitive with "to " (e.g. "to go", "to see"), also try without "to "
    if (cleanGloss.startsWith('to ') && cleanGloss.length > 3) {
      const bareVerb = cleanGloss.slice(3).trim();
      if (bareVerb && (!COMMON_ENGLISH_STOPWORDS.has(bareVerb) || isGermanFunctionWord)) {
        candidates.push({ pattern: bareVerb, rawGloss });
      }
    }

    // If noun/verb, also try simple plural/3rd person 's' / 'es' if candidate > 2 chars
    if (cleanGloss.length > 2 && !cleanGloss.endsWith('s')) {
      candidates.push({ pattern: `${cleanGloss}s`, rawGloss });
      candidates.push({ pattern: `${cleanGloss}es`, rawGloss });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Find matches for candidates in order of priority (longer patterns first to match multi-word phrases)
  candidates.sort((a, b) => b.pattern.length - a.pattern.length);

  for (const { pattern, rawGloss } of candidates) {
    const escaped = escapeRegExp(pattern);
    // Use word boundaries so "cat" doesn't match inside "catch" or "caterpillar"
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

    const matches: RegExpExecArray[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(englishSentence)) !== null) {
      matches.push(match);
      if (matches.length > 1) {
        // More than 1 match -> ambiguous! Break early.
        break;
      }
    }

    if (matches.length === 1) {
      const m = matches[0];
      return {
        matched: m[0],
        start: m.index,
        end: m.index + m[0].length,
        gloss: rawGloss,
      };
    }
    // If matches.length > 1, this specific pattern is ambiguous in this sentence, try next or return null
  }

  return null;
}
