# Volný projekt

> **Jméno a příjmení:** `Michal František Líbal`

> **Název projektu:** `Personal Portfolio`

---

## O projektu

_Krátce popište svůj projekt – čemu se věnuje, co nabízí a jaký problém řeší?_

It solves a problem for my client (me): his old site is outdated, and it was made back when his old developer (me) only knew the basics of CSS. This new site helps him represent himself online, because in big 2026, people say that if somebody does not have a website, they are outdated. It gives him some reputation on the internet and can help him get hired somewhere after school.

My biggest goal was to make my site somewhat accesible — so there are aria attributes everywhere, and for this reason i checked all colors on contrast checkers online 

---

## Konkurence / Inspirace

_Uveďte konkurenční projekty. Co se vám na nich líbí, co ne? V čem se můžete inspirovat?_

For inspiration, I looked at other personal portfolio websites made by other developers and students. I like when portfolios are simple, fast, and clearly show who the person is, what they can do, and how to contact them. Some portfolios look very modern, but they are often overloaded with animations, huge text, or too many effects, which can make them harder to read.

My portfolio is inspired by those clean developer websites, but I want it to feel more personal and not just like another generic template. The goal is to keep it readable, responsive, and useful, while still showing my own style through colors, typography, cards, and small details.

---

## Cílová skupina

_Kdo je váš cílový uživatel / zákazník? Popište typického zástupce cílové skupiny._

Potential employers, recruiters, or anyone checking his online reputation and work after school.

## Odkazy a výstupy

_Shrnutí všech odkazů na jednom místě. Průběžně aktualizujte._

| Výstup                          | Odkaz                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Pages (live)             | [`https://pslib-cz.github.io/2025-p2a-web-volny-projekt-misalibaytb`](https://pslib-cz.github.io/2025-p2a-web-volny-projekt-misalibaytb) |
| Grafický manuál (Figma / Canva) | [`figmička`](https://www.figma.com/design/rRu9OZvp7D6qEb4vGKCI03/L%C3%ADbalMichal?node-id=14-166&t=vM4cCAPyTjtN33jT-0)                   |
| Grafický návrh webu (Figma)     | [`figmička`](https://www.figma.com/design/rRu9OZvp7D6qEb4vGKCI03/L%C3%ADbalMichal?node-id=14-166&t=vM4cCAPyTjtN33jT-0)                   |
| Fotografie / média              | [`/public/assets/images`](/public/assets/images/)                                                                                        |

---

## Poznámky

The project merges components from `components/` with source files from `public/` and saves the output to `dist/`. It also optimizes image sizes.

To run the script, install `ffmpeg-full` and all required Node modules. Then run:

    node ./index.js

For continuous rebuilds when files change, use:

    node ./index.js watch

To inspect how image sizes are generated, add the `--debug-images` flag:

    node ./index.js --debug-images

Images are mainly generated as AVIF, with WebP used as a fallback. The script determines the maximum image size and generates variants for different DPI settings.

## Credits

This project uses:

- [Font Awesome Free](https://fontawesome.com/) icons by Fonticons, Inc.
- [Google Fonts](https://fonts.google.com/) for typography

Font Awesome Free is licensed under CC BY 4.0, SIL OFL 1.1, and MIT depending on the used files.  
Google Fonts are open-source fonts licensed per font family, commonly under the SIL Open Font License.

License links:

- https://fontawesome.com/license/free
- https://developers.google.com/fonts/faq

## Feedback
