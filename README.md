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
| Fotografie / média              | [`/public/assets`](/public/assets)                                                                                                       |

---

## Poznámky

_Prostor pro vlastní poznámky, zpětnou vazbu, TODO apod._

This project combines parts from `components/`with files from`public/`and saves the results in`dist/`. Plus, it makes the images look their best!

To get started, make sure you have `ffmpeg-full` and all the Node modules you need. Then, just run:

    bun ./index.ts

If you want the script to rebuild automatically whenever you change a file, try:

    bun ./index.ts watch

Want to see how the image sizes are calculated? You can add the `—debug-images` flag:

    bun ./index.ts —debug-images

Most of the images are created as AVIF, but WebP is used if AVIF isn’t available. The script figures out the biggest image size and makes versions for different print sizes.
