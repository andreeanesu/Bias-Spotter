/**
 * ui.js
 * Renders the quiz screen and handles scroll + button states.
 */

import { getCorrectFeedbackHtml, getIncorrectFeedbackHtml } from "./data-loader.js";

function getRoundEncouragement(correct, total) {
  if (total === 0) return "";
  if (correct === total) return "Sharp eye this round — you spotted them all.";
  if (correct >= total - 1) return "Strong round. One to sit with.";
  if (correct >= Math.ceil(total / 2)) {
    return "Good progress — noticing these patterns takes practice.";
  }
  return "Every miss is a chance to learn. No rush.";
}

function getModeLabel(playModes, mode) {
  return playModes.find((m) => m.id === mode)?.label ?? "This level";
}

export class QuizUI {
  constructor(elements) {
    this.el = elements;
  }

  showOnboarding(step = 1) {
    this.el.onboardingScreen?.classList.remove("hidden");
    this.el.startScreen?.classList.add("hidden");
    this.el.quizScreen?.classList.add("hidden");
    this.el.finishScreen?.classList.add("hidden");
    this.el.footerNav?.classList.add("hidden");
    this.el.headerTagline?.classList.remove("hidden");
    this.el.btnNext.hidden = true;

    this.el.onboardingStep1?.classList.toggle("hidden", step !== 1);
    this.el.onboardingStep2?.classList.toggle("hidden", step !== 2);

    // Re-trigger enter animation when swapping steps
    const active =
      step === 1 ? this.el.onboardingStep1 : this.el.onboardingStep2;
    if (active) {
      active.style.animation = "none";
      void active.offsetWidth;
      active.style.animation = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showStartScreen(summaries, playModes, onSelect) {
    this.el.onboardingScreen?.classList.add("hidden");
    this.el.startScreen?.classList.remove("hidden");
    this.el.quizScreen?.classList.add("hidden");
    this.el.finishScreen?.classList.add("hidden");
    this.el.footerNav?.classList.add("hidden");
    this.el.headerTagline?.classList.add("hidden");
    this.el.btnNext.hidden = true;

    if (!this.el.tierOptions) return;

    this.el.tierOptions.innerHTML = "";
    summaries.forEach((summary) => {
      const modeInfo = playModes.find((m) => m.id === summary.mode);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tier-option";
      button.dataset.mode = summary.mode;

      const complete =
        summary.totalCount > 0 && summary.seenCount >= summary.totalCount;

      button.innerHTML = `
        <span class="tier-option-top">
          <span class="tier-option-label">${modeInfo?.label ?? summary.mode}</span>
          <span class="tier-option-progress">${summary.seenCount} / ${summary.totalCount}</span>
        </span>
        <span class="tier-option-subtitle">${modeInfo?.subtitle ?? ""}</span>
        <span class="tier-option-meta">${summary.biasCount} biases · questions seen in this tier</span>
      `;

      if (complete) {
        button.classList.add("is-complete");
      }

      button.addEventListener("click", () => onSelect(summary.mode));
      this.el.tierOptions.appendChild(button);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  showQuizScreen() {
    this.el.onboardingScreen?.classList.add("hidden");
    this.el.startScreen?.classList.add("hidden");
    this.el.quizScreen.classList.remove("hidden");
    this.el.finishScreen.classList.add("hidden");
    this.el.footerNav?.classList.remove("hidden");
    this.el.headerTagline?.classList.add("hidden");
    this.el.btnNext.hidden = false;
  }

  renderQuestion(challenge, progress) {
    this.showQuizScreen();

    this.el.scenario.textContent = challenge.statement;

    this.el.questionProgress.textContent = `${progress.current}/${progress.total}`;

    this.el.feedback.classList.add("hidden");
    this.el.feedback.classList.remove("is-visible");
    this.el.feedbackVerdict.textContent = "";
    this.el.feedbackWhyHumans.textContent = "";
    this.el.feedbackReflection.textContent = "";

    this.el.answers.innerHTML = "";
    challenge.optionList.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "answer";
      button.dataset.letter = option.letter;
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", `${option.letter}, ${option.text}`);
      button.innerHTML = `
        <span class="answer-letter">${option.letter}</span>
        <span class="answer-text">
          <span class="answer-label">${option.text}</span>
        </span>
      `;
      this.el.answers.appendChild(button);
    });

    this.el.btnNext.disabled = true;
    this.el.btnNext.textContent = "Next →";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  bindAnswerHandler(handler) {
    this.el.answers.addEventListener("click", (event) => {
      const button = event.target.closest(".answer");
      if (!button || button.disabled) return;
      handler(button.dataset.letter);
    });
  }

  showFeedback(result) {
    const { isCorrect, selectedLetter, challenge } = result;
    const biasName = challenge.biasName;

    this.el.answers.querySelectorAll(".answer").forEach((button) => {
      button.disabled = true;
      button.classList.remove("selected", "correct", "incorrect");
      button.querySelector(".answer-icon")?.remove();

      const letter = button.dataset.letter;
      const label = button.querySelector(".answer-label")?.textContent ?? "";

      if (letter === challenge.correctAnswer) {
        this.markAnswer(button, "correct", label);
      } else if (letter === selectedLetter && !isCorrect) {
        this.markAnswer(button, "incorrect", label);
      } else {
        button.setAttribute("aria-label", `${letter}, ${label}`);
      }
    });

    this.el.feedbackVerdict.innerHTML = isCorrect
      ? getCorrectFeedbackHtml(biasName)
      : getIncorrectFeedbackHtml(biasName);
    this.el.feedbackVerdict.className = `feedback-verdict ${
      isCorrect ? "is-correct" : "is-incorrect"
    }`;
    this.el.feedbackWhyHumans.textContent = challenge.whyHumansDoThis;
    this.el.feedbackReflection.textContent = challenge.reflectionQuestion;
    this.el.feedback.classList.remove("hidden");
    this.el.feedback.classList.add("is-visible");

    this.playCharacterReaction(isCorrect);
    this.el.btnNext.disabled = false;

    requestAnimationFrame(() => {
      this.el.feedback.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  playCharacterReaction(isCorrect) {
    const character = this.el.quizCharacter;
    if (!character) return;

    character.classList.remove("is-nod", "is-ponder");
    void character.offsetWidth;
    character.classList.add(isCorrect ? "is-nod" : "is-ponder");

    const clear = () => {
      character.classList.remove("is-nod", "is-ponder");
      character.removeEventListener("animationend", clear);
    };
    character.addEventListener("animationend", clear);
  }

  markAnswer(button, state, label) {
    const letter = button.dataset.letter;
    button.classList.add(state);
    button.setAttribute(
      "aria-label",
      `${letter}, ${label}, ${state === "correct" ? "correct answer" : "incorrect"}`
    );

    const icon = document.createElement("span");
    icon.className = "answer-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = state === "correct" ? "✓" : "✗";
    button.querySelector(".answer-text")?.appendChild(icon);
  }

  showFinishScreen(sessionMeta, roundScore, playModes = []) {
    this.el.onboardingScreen?.classList.add("hidden");
    this.el.startScreen?.classList.add("hidden");
    this.el.quizScreen.classList.add("hidden");
    this.el.finishScreen.classList.remove("hidden");
    this.el.footerNav?.classList.add("hidden");
    this.el.headerTagline?.classList.add("hidden");
    this.el.btnNext.hidden = true;

    const modeLabel = getModeLabel(playModes, sessionMeta?.mode);

    if (roundScore && this.el.finishScore) {
      const { correct, total } = roundScore;
      this.el.finishScore.textContent = `${correct} of ${total}`;
      this.el.finishScore.setAttribute(
        "aria-label",
        `You spotted ${correct} of ${total} patterns this round`
      );
    }

    if (this.el.finishTitle) {
      this.el.finishTitle.textContent = getRoundEncouragement(
        roundScore?.correct ?? 0,
        roundScore?.total ?? 0
      );
    }

    if (sessionMeta && this.el.finishMessage) {
      const { seenCount, totalCount, remainingInPool, sessionSize } = sessionMeta;

      if (remainingInPool === 0) {
        this.el.finishMessage.textContent =
          `${modeLabel}: you've seen all ${totalCount} questions here. Next round in this tier starts fresh.`;
      } else if (remainingInPool < 5) {
        this.el.finishMessage.textContent =
          `${modeLabel} progress: ${seenCount} of ${totalCount} seen. ${remainingInPool} new question${remainingInPool === 1 ? "" : "s"} left in this tier.`;
      } else {
        this.el.finishMessage.textContent =
          `${modeLabel} progress: ${seenCount} of ${totalCount} seen in this tier.`;
      }

      if (sessionSize < 5) {
        this.el.finishMessage.textContent += ` (This round had ${sessionSize} questions.)`;
      }
    }

    this.playFinishCharacterReaction(roundScore);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  playFinishCharacterReaction(roundScore) {
    const character = this.el.finishCharacter;
    if (!character || !roundScore) return;

    const ratio = roundScore.total ? roundScore.correct / roundScore.total : 0;
    character.classList.remove("is-nod", "is-settle");
    void character.offsetWidth;

    if (ratio >= 0.8) {
      character.classList.add("is-nod");
    } else {
      character.classList.add("is-settle");
    }
  }
}
