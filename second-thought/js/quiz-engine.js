/**
 * quiz-engine.js
 * Session logic per play mode, with seen-question + bias mastery progress.
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

function emptyModeMap(makeValue) {
  return Object.fromEntries(PLAY_MODES.map((mode) => [mode, makeValue()]));
}

function loadAllProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // fall through to migration / empty
  }

  const empty = emptyModeMap(() => []);
  try {
    const legacy = localStorage.getItem(LEGACY_PROGRESS_KEY);
    if (legacy) {
      const ids = JSON.parse(legacy);
      if (Array.isArray(ids)) {
        empty.mix = ids;
        saveAllProgress(empty);
        localStorage.removeItem(LEGACY_PROGRESS_KEY);
      }
    }
  } catch {
    // ignore legacy migration errors
  }

  return empty;
}

function saveAllProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function getSeenSet(progress, mode) {
  const ids = progress[mode];
  return new Set(Array.isArray(ids) ? ids : []);
}

function saveSeenSet(progress, mode, seenIds) {
  progress[mode] = [...seenIds];
  saveAllProgress(progress);
}

function loadMastery() {
  try {
    const raw = localStorage.getItem(MASTERY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return emptyModeMap(() => ({}));
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

function formatMasteryCounts(counts) {
  const parts = [];
  if (counts.learned) parts.push(`${counts.learned} learned`);
  if (counts.familiar) parts.push(`${counts.familiar} familiar`);
  if (counts.practicing) parts.push(`${counts.practicing} practicing`);
  if (counts.new) parts.push(`${counts.new} new`);
  if (parts.length === 0) return "No biases in this level yet";
  return parts.join(" · ");
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
    this.progress = loadAllProgress();
    this.mastery = loadMastery();
  }

  getPoolForMode(mode) {
    if (mode === "mix") return this.allChallenges;
    return this.allChallenges.filter(
      (challenge) => String(challenge.tier) === String(mode)
    );
  }

  getChallengeIdsForBias(biasId, mode = this.mode) {
    return this.getPoolForMode(mode || "mix")
      .filter((challenge) => challenge.biasId === biasId)
      .map((challenge) => challenge.challengeId);
  }

  getMasteryCounts(mode) {
    const pool = this.getPoolForMode(mode);
    const biasIds = [...new Set(pool.map((c) => c.biasId))];
    const modeMastery = this.mastery[mode] || {};

    const counts = { learned: 0, familiar: 0, practicing: 0, new: 0, total: biasIds.length };

    biasIds.forEach((biasId) => {
      const status = getBiasStatus(
        modeMastery[biasId],
        this.getChallengeIdsForBias(biasId, mode)
      );
      counts[status] += 1;
    });

    return counts;
  }

  getProgressSummary(mode) {
    const pool = this.getPoolForMode(mode);
    const seen = getSeenSet(this.progress, mode);
    const seenInPool = pool.filter((c) => seen.has(c.challengeId)).length;
    const biasCount = new Set(pool.map((c) => c.biasId)).size;
    const mastery = this.getMasteryCounts(mode);

    return {
      mode,
      seenCount: seenInPool,
      totalCount: pool.length,
      biasCount,
      remainingCount: pool.length - seenInPool,
      mastery,
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
    let seenIds = getSeenSet(this.progress, this.mode);
    let available = pool.filter((c) => !seenIds.has(c.challengeId));
    let poolReset = false;

    if (available.length === 0 && pool.length > 0) {
      seenIds = new Set();
      available = [...pool];
      poolReset = true;
    }

    const shuffled = shuffleArray(available);
    const sessionCount = Math.min(SESSION_SIZE, available.length);
    this.sessionChallenges = shuffled.slice(0, sessionCount);

    this.sessionChallenges.forEach((challenge) => {
      seenIds.add(challenge.challengeId);
    });
    saveSeenSet(this.progress, this.mode, seenIds);

    const seenInPool = pool.filter((c) => seenIds.has(c.challengeId)).length;

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
    if (!this.mode || !challenge?.biasId) return;

    if (!this.mastery[this.mode] || typeof this.mastery[this.mode] !== "object") {
      this.mastery[this.mode] = {};
    }

    const current = this.mastery[this.mode][challenge.biasId] || {
      correctIds: [],
      missed: false,
    };
    const correctIds = new Set(
      Array.isArray(current.correctIds) ? current.correctIds : []
    );

    if (isCorrect) {
      correctIds.add(challenge.challengeId);
      this.mastery[this.mode][challenge.biasId] = {
        correctIds: [...correctIds],
        missed: false,
      };
    } else {
      this.mastery[this.mode][challenge.biasId] = {
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

    return {
      spotted,
      toPractice: practiceItems.length,
      practiceNames: practiceItems,
      mastery,
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

export { SESSION_SIZE, formatMasteryCounts, getBiasStatus };
