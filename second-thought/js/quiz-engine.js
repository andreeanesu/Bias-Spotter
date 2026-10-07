/**
 * quiz-engine.js
 * Session logic per play mode, with shared seen-question + bias mastery progress.
 *
 * Questions seen and mastery are shared across Beginner / Intermediate /
 * Advanced / Mix, since they draw from the same challenge and bias bank.
 */

const SESSION_SIZE = 5;
const PROGRESS_KEY = "second-thought-tier-progress";
const MASTERY_KEY = "second-thought-bias-mastery";
const LEGACY_PROGRESS_KEY = "second-thought-seen-challenges";

export const PLAY_MODES = ["1", "2", "3", "mix"];

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function loadSeenIds() {
  const seen = new Set();

  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (Array.isArray(parsed.seen)) {
          parsed.seen.forEach((id) => seen.add(id));
          return seen;
        }

        // Legacy per-mode arrays → one shared set
        PLAY_MODES.forEach((mode) => {
          const ids = parsed[mode];
          if (Array.isArray(ids)) ids.forEach((id) => seen.add(id));
        });
      }
    }
  } catch {
    // fall through
  }

  try {
    const legacy = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy);
      if (Array.isArray(ids)) {
        ids.forEach((id) => seen.add(id));
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
      }
    }
  } catch {
    // ignore
  }

  saveSeenIds(seen);
  return seen;
}

function saveSeenIds(seenIds) {
  localStorage.setItem(
    PROGRESS_KEY,
    JSON.stringify({ version: 2, seen: [...seenIds] })
  );
}

function isLegacyMasteryShape(parsed) {
  return PLAY_MODES.some((mode) =>
    Object.prototype.hasOwnProperty.call(parsed, mode)
  );
}

function loadMastery() {
  try {
    const raw = localStorage.getItem(MASTERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (isLegacyMasteryShape(parsed)) {
          const merged = {};
          PLAY_MODES.forEach((mode) => {
            const modeData = parsed[mode];
            if (!modeData || typeof modeData !== "object") return;

            Object.entries(modeData).forEach(([biasId, record]) => {
              const existing = merged[biasId] || {
                correctIds: [],
                missed: false,
              };
              const correctIds = new Set([
                ...(Array.isArray(existing.correctIds) ? existing.correctIds : []),
                ...(Array.isArray(record?.correctIds) ? record.correctIds : []),
              ]);
              merged[biasId] = {
                correctIds: [...correctIds],
                missed: Boolean(existing.missed || record?.missed),
              };
            });
          });
          saveMastery(merged);
          return merged;
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return {};
}

function saveMastery(mastery) {
  localStorage.setItem(MASTERY_KEY, JSON.stringify(mastery));
}

function getBiasStatus(record, challengeIdsForBias) {
  if (!record) return "new";
  if (record.missed) return "practicing";

  const correctIds = Array.isArray(record.correctIds) ? record.correctIds : [];
  const correctCount = correctIds.filter((id) =>
    challengeIdsForBias.includes(id)
  ).length;

  if (challengeIdsForBias.length > 0 && correctCount >= challengeIdsForBias.length) {
    return "learned";
  }
  if (correctCount >= 2) return "familiar";
  return "practicing";
}

/** Collapse familiar into practicing for a clear 3-stage view. */
function toDisplayStages(counts) {
  const learned = counts.learned || 0;
  const practicing = (counts.practicing || 0) + (counts.familiar || 0);
  const notStarted = counts.new || 0;
  const total = counts.total || learned + practicing + notStarted;

  return {
    learned,
    practicing,
    new: notStarted,
    total,
  };
}

function formatMasteryCounts(counts) {
  const stages = toDisplayStages(counts);
  const parts = [];
  if (stages.learned) parts.push(`${stages.learned} learned`);
  if (stages.practicing) parts.push(`${stages.practicing} practicing`);
  if (stages.new) parts.push(`${stages.new} new`);
  if (parts.length === 0) {
    return stages.total > 0 ? `${stages.total} new` : "No biases in this level yet";
  }
  return parts.join(" · ");
}

function formatBiasProgressLabel(modeLabel, counts) {
  return `${modeLabel} biases: ${formatMasteryCounts(counts)}`;
}

export class QuizEngine {
  constructor(allChallenges) {
    this.allChallenges = allChallenges;
    this.mode = null;
    this.sessionChallenges = [];
    this.currentIndex = 0;
    this.hasAnswered = false;
    this.selectedLetter = null;
    this.sessionMeta = null;
    this.correctCount = 0;
    this.sessionResults = [];
    this.seenIds = loadSeenIds();
    this.mastery = loadMastery();
  }

  getPoolForMode(mode) {
    if (mode === "mix") return this.allChallenges;
    return this.allChallenges.filter(
      (challenge) => String(challenge.tier) === String(mode)
    );
  }

  getChallengeIdsForBias(biasId) {
    return this.allChallenges
      .filter((challenge) => challenge.biasId === biasId)
      .map((challenge) => challenge.challengeId);
  }

  getMasteryCounts(mode) {
    const pool = this.getPoolForMode(mode);
    const biasIds = [...new Set(pool.map((c) => c.biasId))];

    const counts = {
      learned: 0,
      familiar: 0,
      practicing: 0,
      new: 0,
      total: biasIds.length,
    };

    biasIds.forEach((biasId) => {
      const status = getBiasStatus(
        this.mastery[biasId],
        this.getChallengeIdsForBias(biasId)
      );
      counts[status] += 1;
    });

    return counts;
  }

  getProgressSummary(mode) {
    const pool = this.getPoolForMode(mode);
    const seenInPool = pool.filter((c) => this.seenIds.has(c.challengeId)).length;
    const biasCount = new Set(pool.map((c) => c.biasId)).size;
    const mastery = this.getMasteryCounts(mode);
    const stages = toDisplayStages(mastery);

    return {
      mode,
      seenCount: seenInPool,
      totalCount: pool.length,
      biasCount,
      remainingCount: pool.length - seenInPool,
      mastery,
      stages,
      masteryLine: formatMasteryCounts(mastery),
    };
  }

  getAllProgressSummaries() {
    return PLAY_MODES.map((mode) => this.getProgressSummary(mode));
  }

  setMode(mode) {
    if (!PLAY_MODES.includes(mode)) {
      throw new Error(`Unknown play mode: ${mode}`);
    }
    this.mode = mode;
  }

  startSession() {
    if (!this.mode) throw new Error("Play mode not selected");

    const pool = this.getPoolForMode(this.mode);
    const poolIdSet = new Set(pool.map((c) => c.challengeId));
    let available = pool.filter((c) => !this.seenIds.has(c.challengeId));
    let poolReset = false;

    if (available.length === 0 && pool.length > 0) {
      // Start this level's cycle again; clear only this pool from shared seen.
      this.seenIds = new Set(
        [...this.seenIds].filter((id) => !poolIdSet.has(id))
      );
      available = [...pool];
      poolReset = true;
    }

    const shuffled = shuffleArray(available);
    const sessionCount = Math.min(SESSION_SIZE, available.length);
    this.sessionChallenges = shuffled.slice(0, sessionCount);

    this.sessionChallenges.forEach((challenge) => {
      this.seenIds.add(challenge.challengeId);
    });
    saveSeenIds(this.seenIds);

    const seenInPool = pool.filter((c) => this.seenIds.has(c.challengeId)).length;

    this.sessionMeta = {
      mode: this.mode,
      poolReset,
      seenCount: seenInPool,
      totalCount: pool.length,
      remainingInPool: pool.length - seenInPool,
      sessionSize: sessionCount,
    };

    this.currentIndex = 0;
    this.hasAnswered = false;
    this.selectedLetter = null;
    this.correctCount = 0;
    this.sessionResults = [];
  }

  recordBiasResult(challenge, isCorrect) {
    if (!challenge?.biasId) return;

    const current = this.mastery[challenge.biasId] || {
      correctIds: [],
      missed: false,
    };
    const correctIds = new Set(
      Array.isArray(current.correctIds) ? current.correctIds : []
    );

    if (isCorrect) {
      correctIds.add(challenge.challengeId);
      this.mastery[challenge.biasId] = {
        correctIds: [...correctIds],
        missed: false,
      };
    } else {
      this.mastery[challenge.biasId] = {
        correctIds: [...correctIds],
        missed: true,
      };
    }

    saveMastery(this.mastery);
  }

  getRoundScore() {
    return {
      correct: this.correctCount,
      total: this.sessionChallenges.length,
    };
  }

  getRoundMasterySummary() {
    const spotted = this.sessionResults.filter((r) => r.isCorrect).length;
    const practiceItems = [];
    const seenPractice = new Set();

    this.sessionResults.forEach((result) => {
      if (!result.isCorrect && !seenPractice.has(result.biasId)) {
        seenPractice.add(result.biasId);
        practiceItems.push(result.biasName);
      }
    });

    const mastery = this.getMasteryCounts(this.mode);
    const stages = toDisplayStages(mastery);

    return {
      spotted,
      toPractice: practiceItems.length,
      practiceNames: practiceItems,
      mastery,
      stages,
      masteryLine: formatMasteryCounts(mastery),
      mode: this.mode,
    };
  }

  getSessionMeta() {
    return this.sessionMeta;
  }

  get sessionSize() {
    return this.sessionChallenges.length;
  }

  getCurrentChallenge() {
    return this.sessionChallenges[this.currentIndex] ?? null;
  }

  selectAnswer(letter) {
    if (this.hasAnswered) return null;

    const challenge = this.getCurrentChallenge();
    if (!challenge) return null;

    this.hasAnswered = true;
    this.selectedLetter = letter;

    const isCorrect = letter === challenge.correctAnswer;
    if (isCorrect) this.correctCount += 1;

    this.recordBiasResult(challenge, isCorrect);
    this.sessionResults.push({
      biasId: challenge.biasId,
      biasName: challenge.biasName,
      isCorrect,
    });

    return {
      isCorrect,
      selectedLetter: letter,
      selectedText: challenge.options[letter],
      correctLetter: challenge.correctAnswer,
      correctText: challenge.correctOptionText,
      challenge,
    };
  }

  canGoNext() {
    return this.hasAnswered;
  }

  goNext() {
    if (!this.hasAnswered) return false;

    this.currentIndex += 1;
    this.hasAnswered = false;
    this.selectedLetter = null;

    return true;
  }

  isFinished() {
    return this.currentIndex >= this.sessionChallenges.length;
  }

  getProgress() {
    const total = this.sessionChallenges.length;
    const current = Math.min(this.currentIndex + 1, total);
    const percent = total <= 1 ? 100 : (this.currentIndex / (total - 1)) * 100;

    return { current, total, percent };
  }
}

export { SESSION_SIZE, formatMasteryCounts, formatBiasProgressLabel, getBiasStatus, toDisplayStages };
