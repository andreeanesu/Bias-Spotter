/**
 * character.js
 * Inlines the companion SVG so we can animate the pupil, and
 * plays short one-shot motions. Flip CHARACTER_MOTION_ENABLED to
 * false to disable all character motion quickly.
 */

/** Set to false to turn off jiggle / glance / reaction motion. */
export const CHARACTER_MOTION_ENABLED = true;

const MOTION_CLASSES = ["is-jiggle", "is-glance", "is-nod", "is-ponder", "is-settle"];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Replace <img.character> tags with inline SVG so pupil motion works.
 */
export async function hydrateCharacterIcons() {
  const images = [...document.querySelectorAll("img.character")];
  if (images.length === 0) return;

  const response = await fetch("assets/character.svg");
  if (!response.ok) {
    throw new Error(`Could not load character.svg (${response.status})`);
  }

  const svgText = await response.text();
  const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const source = parsed.documentElement;
  if (!source || source.nodeName.toLowerCase() !== "svg") {
    throw new Error("character.svg did not parse as SVG");
  }

  images.forEach((img) => {
    const svg = source.cloneNode(true);
    if (img.id) svg.id = img.id;
    img.classList.forEach((className) => svg.classList.add(className));
    svg.setAttribute("width", img.getAttribute("width") || "88");
    svg.setAttribute("height", img.getAttribute("height") || "102");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    img.replaceWith(svg);
  });
}

/**
 * Play a short named motion on a character element.
 * @param {Element | null} el
 * @param {"jiggle" | "glance" | "nod" | "ponder" | "settle"} motion
 */
export function playCharacterMotion(el, motion) {
  if (!CHARACTER_MOTION_ENABLED || !el || prefersReducedMotion()) return;

  const className = `is-${motion}`;
  MOTION_CLASSES.forEach((name) => el.classList.remove(name));
  void el.getBoundingClientRect();
  el.classList.add(className);

  const clear = (event) => {
    // Glance animates the pupil; other motions animate the root SVG.
    if (motion === "glance") {
      if (!event.target.classList?.contains("character-pupil")) return;
    } else if (event.target !== el) {
      return;
    }
    el.classList.remove(className);
    el.removeEventListener("animationend", clear);
  };
  el.addEventListener("animationend", clear);
}
