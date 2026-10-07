/**
 * ui.js
 * Renders the quiz screen and handles scroll + button states.
 */

import { getCorrectFeedbackHtml, getIncorrectFeedbackHtml } from "./data-loader.js";
import { formatBiasProgressLabel } from "./quiz-engine.js";

function getRoundEncouragement(correct, total) {
  if (total === 0) return "";
  if (correct === total) return "Sharp eye this round. You spotted them all.";
  if (correct >= total - 1) return "Strong round. One to sit with.";
  if (correct >= Math.ceil(total / 2)) {
    return "Good progress. Noticing these patterns takes practice.";
  }
  return "Every miss is a chance to learn. No rush.";
}

function getModeLabel(playModes, mode) {
  return playModes.find((m) => m.id === mode)?.label ?? "This level";
}

/** Three-stage bar: learned / practicing / new (widths proportional to counts). */
function renderBiasProgressBar(stages, { showLegend = false } = {}) {
  const learned = stages?.learned || 0;
  const practicing = stages?.practicing || 0;
  const notStarted = stages?.new || 0;
  const total = stages?.total || learned + practicing + notStarted;

  if (total <= 0) return "";

  const segments = [
    { key: "learned", count: learned, label: "learned" },
    { key: "practicing", count: practicing, label: "practicing" },
    { key: "new", count: notStarted, label: "new" },
  ].filter((seg) => seg.count > 0);

  const barHtml = segments
    .map(
      (seg) =>
        `<span class="bias-progress-seg is-${seg.key}" style="flex-grow:${seg.count}" title="${seg.count} ${seg.label}"></span>`
    )
    .join("");

  const aria = segments.map((seg) => `${seg.count} ${seg.label}`).join(", ");

  const legendHtml = showLegend
    ? `<ul class="bias-progress-legend" aria-hidden="true">
        <li><span class="bias-progress-swatch is-learned"></span> Learned</li>
        <li><span class="bias-progress-swatch is-practicing"></span> Practicing</li>
        <li><span class="bias-progress-swatch is-new"></span> New</li>
      </ul>`
    : "";

  return `<div class="bias-progress-bar" role="img" aria-label="${aria}">${barHtml}</div>${legendHtml}`;
}

function renderBiasProgressBlock(modeLabel, stages, { showLegend = false } = {}) {
  const label = formatBiasProgressLabel(modeLabel, stages);
  return `
    <p class="bias-progress-label">${label}</p>
    ${renderBiasProgressBar(stages, { showLegend })}
  `;
}

export class QuizUI {
  constructor(elements) {
    this.el = elements;
    this.activeConfusedChip = null;
    this.supportsHoverPreview = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
    this.bindConfusedPopover();
  }

  bindConfusedPopover() {
    if (!this.el.learnMoreConfused || !this.el.confusedPopover) return;

    this.el.learnMoreConfused.addEventListener("click", (event) => {
      const chip = event.target.closest(".confused-chip");
      if (!chip || !this.el.learnMoreConfused.contains(chip)) return;

      event.stopPropagation();

      if (this.activeConfusedChip === chip && this.isConfusedPopoverOpen()) {
        this.closeConfusedPopover();
        return;
      }
      this.openConfusedPopover(chip);
    });

    this.el.confusedPopover?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    if (this.supportsHoverPreview) {
      this.el.learnMoreConfused.addEventListener("mouseover", (event) => {
        const chip = event.target.closest(".confused-chip");
        if (!chip || !this.el.learnMoreConfused.contains(chip)) return;
        this.openConfusedPopover(chip, { fromHover: true });
      });

      this.el.learnMoreConfusedBlock?.addEventListener("mouseleave", () => {
        this.closeConfusedPopover({ restoreFocus: false });
      });
    }

    this.el.confusedPopoverClose?.addEventListener("click", () => {
      this.closeConfusedPopover();
    });

    document.addEventListener("click", (event) => {
      if (!this.isConfusedPopoverOpen()) return;
      const inChip = event.target.closest(".confused-chip");
      const inPopover = event.target.closest("#confused-popover");
      if (inChip || inPopover) return;
      this.closeConfusedPopover({ restoreFocus: false });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isConfusedPopoverOpen()) {
        this.closeConfusedPopover();
      }
    });
  }

  isConfusedPopoverOpen() {
    return Boolean(
      this.el.confusedPopover && !this.el.confusedPopover.hidden
    );
  }

  openConfusedPopover(chip, { fromHover = false } = {}) {
    const name = chip.dataset.biasName || chip.textContent.trim();
    const definition = chip.dataset.biasDefinition || "";
    if (!this.el.confusedPopover) return;

    if (this.el.confusedPopoverTitle) {
      this.el.confusedPopoverTitle.textContent = name;
    }
    if (this.el.confusedPopoverDefinition) {
      this.el.confusedPopoverDefinition.textContent =
        definition || "Definition coming soon.";
    }

    this.el.confusedPopover.hidden = false;
    this.el.confusedPopover.classList.remove("hidden");

    this.el.learnMoreConfused
      ?.querySelectorAll(".confused-chip")
      .forEach((button) => {
        button.setAttribute("aria-expanded", button === chip ? "true" : "false");
      });

    this.activeConfusedChip = chip;

    if (!fromHover) {
      this.el.confusedPopoverClose?.focus();
    }
  }

  closeConfusedPopover({ restoreFocus = true } = {}) {
    if (!this.el.confusedPopover) return;

    this.el.confusedPopover.hidden = true;
    this.el.confusedPopover.classList.add("hidden");

    this.el.learnMoreConfused
      ?.querySelectorAll(".confused-chip")
      .forEach((button) => {
        button.setAttribute("aria-expanded", "false");
      });

    const chip = this.activeConfusedChip;
    this.activeConfusedChip = null;

    if (restoreFocus && chip) {
      chip.focus();
    }
  }

  showOnboarding(step = 1) {
    this.el.onboardingScreen?.classList.remove("hidden");
    this.el.startScreen?.classList.add("hidden");
    this.el.quizScreen?.classList.add("hidden");
    this.el.finishScreen?.classList.add("hidden");
    this.el.footerNav?.classList.add("hidden");
    // Welcome body already says this; keep the header line for step 2 only.
    this.el.headerTagline?.classList.toggle("hidden", step === 1);
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

      const levelLabel = modeInfo?.label ?? summary.mode;
      button.innerHTML = `
        <span class="tier-option-top">
          <span class="tier-option-label">${levelLabel}</span>
          <span class="tier-option-progress">${summary.seenCount} / ${summary.totalCount}</span>
        </span>
        <span class="tier-option-subtitle">${modeInfo?.subtitle ?? ""}</span>
        <span class="bias-progress tier-option-bias-progress">
          ${renderBiasProgressBlock(levelLabel, summary.stages)}
        </span>
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
    if (this.el.feedbackCategory) this.el.feedbackCategory.textContent = "";
    this.el.feedbackWhyHumans.textContent = "";
    this.el.feedbackReflection.textContent = "";
    this.resetLearnMore();

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
    if (this.el.feedbackCategory) {
      this.el.feedbackCategory.textContent = challenge.biasCategory || "";
    }
    this.el.feedbackWhyHumans.textContent = challenge.whyHumansDoThis;
    this.el.feedbackReflection.textContent = challenge.reflectionQuestion;
    this.renderLearnMore(challenge);
    this.el.feedback.classList.remove("hidden");
    this.el.feedback.classList.add("is-visible");

    this.playCharacterReaction(isCorrect);
    this.el.btnNext.disabled = false;

    requestAnimationFrame(() => {
      this.el.feedback.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  resetLearnMore() {
    if (!this.el.learnMore) return;
    this.closeConfusedPopover({ restoreFocus: false });
    this.el.learnMore.open = false;
    this.el.learnMore.hidden = true;
    if (this.el.learnMoreBiasName) {
      this.el.learnMoreBiasName.textContent = "this bias";
    }
    if (this.el.learnMoreDefinition) {
      this.el.learnMoreDefinition.textContent = "";
    }
    if (this.el.learnMoreConfused) {
      this.el.learnMoreConfused.innerHTML = "";
    }
    if (this.el.learnMoreLink) {
      this.el.learnMoreLink.href = "#";
    }
    this.el.learnMoreDefinitionBlock?.classList.add("hidden");
    this.el.learnMoreConfusedBlock?.classList.add("hidden");
    this.el.learnMoreReading?.classList.add("hidden");
  }

  renderLearnMore(challenge) {
    if (!this.el.learnMore) return;

    const definition = challenge.biasDefinition?.trim() || "";
    const confusedDetails = Array.isArray(challenge.usuallyConfusedWithDetails)
      ? challenge.usuallyConfusedWithDetails.filter((item) => item?.name)
      : (challenge.usuallyConfusedWith || []).map((name) => ({
          name,
          definition: "",
        }));
    const url = challenge.furtherReadingUrl?.trim() || "";

    if (!definition && confusedDetails.length === 0 && !url) {
      this.resetLearnMore();
      return;
    }

    this.el.learnMore.hidden = false;
    this.el.learnMore.open = false;
    this.closeConfusedPopover({ restoreFocus: false });

    if (this.el.learnMoreBiasName) {
      this.el.learnMoreBiasName.textContent = challenge.biasName || "this bias";
    }

    if (this.el.learnMoreDefinition) {
      this.el.learnMoreDefinition.textContent = definition;
    }
    this.el.learnMoreDefinitionBlock?.classList.toggle("hidden", !definition);

    if (this.el.learnMoreConfused) {
      this.el.learnMoreConfused.innerHTML = "";
      confusedDetails.forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "confused-chip";
        button.setAttribute("role", "listitem");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("aria-controls", "confused-popover");
        button.dataset.biasName = item.name;
        button.dataset.biasDefinition = item.definition || "";
        button.textContent = item.name;
        button.setAttribute(
          "aria-label",
          `${item.name}. Show definition.`
        );
        this.el.learnMoreConfused.appendChild(button);
      });
    }
    this.el.learnMoreConfusedBlock?.classList.toggle(
      "hidden",
      confusedDetails.length === 0
    );

    if (this.el.learnMoreLink && this.el.learnMoreReading) {
      if (url) {
        this.el.learnMoreLink.href = url;
        this.el.learnMoreReading.classList.remove("hidden");
      } else {
        this.el.learnMoreLink.href = "#";
        this.el.learnMoreReading.classList.add("hidden");
      }
    }
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

  showFinishScreen(sessionMeta, roundScore, playModes = [], roundMastery = null) {
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

    if (this.el.finishRoundMastery) {
      if (roundMastery) {
        const practiceBit =
          roundMastery.toPractice > 0
            ? `${roundMastery.toPractice} to practice again`
            : "none to practice again";
        this.el.finishRoundMastery.textContent = `This round: ${roundMastery.spotted} spotted · ${practiceBit}`;
        this.el.finishRoundMastery.hidden = false;
      } else {
        this.el.finishRoundMastery.textContent = "";
        this.el.finishRoundMastery.hidden = true;
      }
    }

    if (this.el.finishLevelMastery) {
      if (roundMastery?.stages) {
        this.el.finishLevelMastery.innerHTML = renderBiasProgressBlock(
          modeLabel,
          roundMastery.stages,
          { showLegend: true }
        );
        this.el.finishLevelMastery.hidden = false;
      } else {
        this.el.finishLevelMastery.innerHTML = "";
        this.el.finishLevelMastery.hidden = true;
      }
    }

    if (this.el.finishPracticeNote) {
      if (roundMastery?.practiceNames?.length) {
        this.el.finishPracticeNote.textContent = `Worth another look: ${roundMastery.practiceNames.join(", ")}`;
        this.el.finishPracticeNote.hidden = false;
      } else {
        this.el.finishPracticeNote.textContent = "";
        this.el.finishPracticeNote.hidden = true;
      }
    }

    if (sessionMeta && this.el.finishMessage) {
      const { seenCount, totalCount, remainingInPool, sessionSize } = sessionMeta;

      if (remainingInPool === 0) {
        this.el.finishMessage.textContent =
          `${modeLabel}: you've seen all ${totalCount} questions here. Next round in this level starts fresh.`;
      } else if (remainingInPool < 5) {
        this.el.finishMessage.textContent =
          `${seenCount} of ${totalCount} questions seen. ${remainingInPool} new question${remainingInPool === 1 ? "" : "s"} left in this level.`;
      } else {
        this.el.finishMessage.textContent =
          `${seenCount} of ${totalCount} questions seen in this level.`;
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
