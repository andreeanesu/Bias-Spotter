/**
 * app.js
 * Boots the app: load data → onboarding (first visit) → start screen → quiz → finish.
 */

import { loadQuizData, getPlayModes } from "./data-loader.js";
import { QuizEngine } from "./quiz-engine.js";
import { QuizUI } from "./ui.js";

const ONBOARDING_KEY = "second-thought-onboarding-done";

const elements = {
  main: document.getElementById("main"),
  onboardingScreen: document.getElementById("onboarding-screen"),
  onboardingStep1: document.getElementById("onboarding-step-1"),
  onboardingStep2: document.getElementById("onboarding-step-2"),
  onboardingNext: document.getElementById("onboarding-next"),
  onboardingDone: document.getElementById("onboarding-done"),
  onboardingSkip1: document.getElementById("onboarding-skip-1"),
  onboardingSkip2: document.getElementById("onboarding-skip-2"),
  startScreen: document.getElementById("start-screen"),
  tierOptions: document.getElementById("tier-options"),
  quizScreen: document.getElementById("quiz-screen"),
  finishScreen: document.getElementById("finish-screen"),
  scenario: document.getElementById("scenario"),
  answers: document.getElementById("answers"),
  feedback: document.getElementById("feedback"),
  feedbackVerdict: document.getElementById("feedback-verdict"),
  feedbackCategory: document.getElementById("feedback-category"),
  feedbackLearned: document.getElementById("feedback-learned"),
  feedbackWhyHumans: document.getElementById("feedback-why-humans"),
  feedbackReflection: document.getElementById("feedback-reflection"),
  learnMore: document.getElementById("learn-more"),
  learnMoreBiasName: document.getElementById("learn-more-bias-name"),
  learnMoreDefinitionBlock: document.getElementById("learn-more-definition-block"),
  learnMoreDefinition: document.getElementById("learn-more-definition"),
  learnMoreConfusedBlock: document.getElementById("learn-more-confused-block"),
  learnMoreConfused: document.getElementById("learn-more-confused"),
  confusedPopover: document.getElementById("confused-popover"),
  confusedPopoverTitle: document.getElementById("confused-popover-title"),
  confusedPopoverDefinition: document.getElementById("confused-popover-definition"),
  confusedPopoverClose: document.getElementById("confused-popover-close"),
  learnMoreReading: document.getElementById("learn-more-reading"),
  learnMoreLink: document.getElementById("learn-more-link"),
  questionProgress: document.getElementById("question-progress"),
  headerTagline: document.getElementById("header-tagline"),
  btnBack: document.getElementById("btn-back"),
  btnNext: document.getElementById("btn-next"),
  footerNav: document.getElementById("footer-nav"),
  btnRetryMissed: document.getElementById("btn-retry-missed"),
  btnRestart: document.getElementById("btn-restart"),
  btnChangeTier: document.getElementById("btn-change-tier"),
  finishTitle: document.getElementById("finish-title"),
  finishCelebration: document.getElementById("finish-celebration"),
  finishRoundMastery: document.getElementById("finish-round-mastery"),
  finishLevelMastery: document.getElementById("finish-level-mastery"),
  finishRetryGroup: document.getElementById("finish-retry-group"),
  finishPracticeNote: document.getElementById("finish-practice-note"),
  finishMessage: document.getElementById("finish-message"),
  finishScore: document.getElementById("finish-score"),
  quizCharacter: document.getElementById("quiz-character"),
  finishCharacter: document.getElementById("finish-character"),
};

const ui = new QuizUI(elements);
const playModes = getPlayModes();
let engine;

function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Ignore storage failures; user can still continue.
  }
}

function finishOnboarding() {
  markOnboardingDone();
  showLevelPicker();
}

function updateNavState() {
  ui.setNavState({
    canGoBack: engine.canGoBack(),
    canGoNext: engine.canGoNext(),
  });
}

function renderCurrentQuestion() {
  const challenge = engine.getCurrentChallenge();
  if (!challenge) return;
  ui.renderQuestion(challenge, engine.getProgress());

  const priorFeedback = engine.getFeedbackForIndex(engine.currentIndex);
  if (priorFeedback) {
    ui.showFeedback(priorFeedback, { animateCharacter: false });
  }
  updateNavState();
}

function handleAnswer(letter) {
  const result = engine.selectAnswer(letter);
  if (!result) return;
  ui.showFeedback(result);
  updateNavState();
}

function handleNext() {
  if (!engine.canGoNext()) return;

  engine.goNext();

  if (engine.isFinished()) {
    ui.showFinishScreen(
      engine.getSessionMeta(),
      engine.getRoundScore(),
      playModes,
      engine.getRoundMasterySummary()
    );
    return;
  }

  renderCurrentQuestion();
}

function handleBack() {
  if (!engine.canGoBack()) return;
  engine.goBack();
  renderCurrentQuestion();
}

function startRound(mode) {
  engine.setMode(mode);
  engine.startSession();
  renderCurrentQuestion();
}

function startNewRound() {
  startRound(engine.mode);
}

function startRetryRound() {
  if (!engine.startRetrySession()) return;
  renderCurrentQuestion();
}

function showLevelPicker() {
  ui.showStartScreen(engine.getAllProgressSummaries(), playModes, startRound);
}

function bindOnboarding() {
  elements.onboardingNext?.addEventListener("click", () => {
    ui.showOnboarding(2);
  });
  elements.onboardingDone?.addEventListener("click", finishOnboarding);
  elements.onboardingSkip1?.addEventListener("click", finishOnboarding);
  elements.onboardingSkip2?.addEventListener("click", finishOnboarding);
}

async function init() {
  try {
    const data = await loadQuizData();
    engine = new QuizEngine(data.challenges);

    ui.bindAnswerHandler(handleAnswer);
    elements.btnBack?.addEventListener("click", handleBack);
    elements.btnNext.addEventListener("click", handleNext);
    elements.btnRetryMissed?.addEventListener("click", startRetryRound);
    elements.btnRestart.addEventListener("click", startNewRound);
    elements.btnChangeTier.addEventListener("click", showLevelPicker);
    bindOnboarding();

    if (hasCompletedOnboarding()) {
      showLevelPicker();
    } else {
      ui.showOnboarding(1);
    }
  } catch (error) {
    console.error(error);
    elements.onboardingScreen?.classList.add("hidden");
    elements.startScreen?.classList.add("hidden");
    elements.quizScreen?.classList.add("hidden");
    elements.finishScreen?.classList.remove("hidden");
    elements.finishScreen.innerHTML = `
      <h2>Could not load quiz content</h2>
      <p class="error-message">
        Please run the app through a local server
        (for example: <code>python3 -m http.server 8080</code>)
        and open <code>http://localhost:8080</code>.
      </p>
    `;
  }
}

init();
