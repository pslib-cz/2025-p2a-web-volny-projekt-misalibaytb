const skillcards = document.querySelector(".home .skillcards");

if (skillcards) {
  const updateAloneSkillCard = () => {
    const cards = Array.from(skillcards.children);
    const lastCard = cards.at(-1);

    cards.forEach((card) => card.classList.remove("is-alone-row"));

    if (!lastCard) {
      return;
    }

    const lastCardTop = lastCard.offsetTop;
    const cardsInLastRow = cards.filter(
      (card) => card.offsetTop === lastCardTop,
    );

    if (cardsInLastRow.length === 1) {
      lastCard.classList.add("is-alone-row");
    }
  };

  updateAloneSkillCard();
  window.addEventListener("resize", updateAloneSkillCard);
}
const skillBars = document.querySelectorAll(".skill-slider__bar");

const skillObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      requestAnimationFrame(() => {
        entry.target.classList.add("is-filled");
      });

      skillObserver.unobserve(entry.target);
    });
  },
  {
    threshold: 0.35,
  },
);

skillBars.forEach((bar, index) => {
  bar.style.setProperty("--skill-fill-delay", `${index * 0.4}s`);
});

window.addEventListener("load", () => {
  skillBars.forEach((bar) => {
    skillObserver.observe(bar);
  });
});
