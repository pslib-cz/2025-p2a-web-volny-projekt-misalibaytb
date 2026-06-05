document.querySelectorAll("[data-contact-mail]").forEach((link) => {
  const reverse = (value) => [...value].reverse().join("");
  const user = reverse(link.dataset.contactUser ?? "");
  const domain = reverse(link.dataset.contactDomain ?? "");

  if (!user || !domain) {
    return;
  }

  const address = `${user}@${domain}`;
  link.href = `mailto:${address}`;

  const label = link.querySelector("small");

  if (label) {
    label.textContent = address;
  }
});
