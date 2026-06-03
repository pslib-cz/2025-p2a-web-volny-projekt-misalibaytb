# Volný projekt

> **Jméno a příjmení:** `Michal František Líbal`

> **Název projektu:** `Personal Portfolio`

---

## O projektu

_Krátce popište svůj projekt – čemu se věnuje, co nabízí a jaký problém řeší?_

`Doplňte popis projektu.`

---

## Konkurence / Inspirace

_Uveďte konkurenční projekty. Co se vám na nich líbí, co ne? V čem se můžete inspirovat?_

`Doplňte konkurence a její popis.`

---

## Cílová skupina

_Kdo je váš cílový uživatel / zákazník? Popište typického zástupce cílové skupiny._

`Doplňte cílovou skupinu.`

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
