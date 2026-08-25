export function animateHeight(element: HTMLElement, opening: boolean, done: () => void): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    done();
    return;
  }
  element.style.overflow = "hidden";
  element.style.height = opening ? "0px" : `${element.scrollHeight}px`;
  element.style.opacity = opening ? "0" : "1";
  void element.offsetHeight;
  element.style.transition = "height .22s cubic-bezier(.2, .75, .2, 1), opacity .16s ease";
  element.style.height = opening ? `${element.scrollHeight}px` : "0px";
  element.style.opacity = opening ? "1" : "0";
  const finish = () => {
    element.style.removeProperty("height");
    element.style.removeProperty("opacity");
    element.style.removeProperty("overflow");
    element.style.removeProperty("transition");
    done();
  };
  const onTransitionEnd = (event: TransitionEvent) => {
    if (event.propertyName !== "height") return;
    element.removeEventListener("transitionend", onTransitionEnd);
    finish();
  };
  element.addEventListener("transitionend", onTransitionEnd);
}
