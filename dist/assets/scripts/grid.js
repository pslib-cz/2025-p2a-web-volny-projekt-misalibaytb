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
