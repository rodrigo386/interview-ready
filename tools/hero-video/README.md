# Vídeo do hero (promocional, tela cheia)

Gera `public/video/hero-v1.mp4` e o poster. O vídeo tem **"R$10" fixo** e mostra a
interface real: se o preço ou a interface mudarem, regere.

Cada quadro é uma função pura do tempo (`window.seek(t)` em `video.html`): sem
animação CSS, sem timers, sem estado entre quadros. O motion blur vem de 3
subquadros por quadro (t−1/240, t, t+1/240) mesclados com `tmix`.

## Como regerar

Precisa de Node, Playwright (já é dependência do repo), `ffmpeg` e a fonte Inter
variável (`npm i @fontsource-variable/inter` numa pasta de trabalho).

```bash
WORK=/tmp/hero-video            # pasta de trabalho, fora do repo
mkdir -p $WORK/fonts && cp tools/hero-video/video.html $WORK/
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 $WORK/fonts/   # ou do pacote instalado em $WORK

pnpm dev -p 3100 &              # o capture lê a interface real daqui
node tools/hero-video/capture.mjs $WORK
node tools/hero-video/render.mjs $WORK probe '[0.7,2.3,4.3,6.5,9.2,11.2,14.7,16.8]'   # confira os quadros ANTES do render cheio
for a in 0 300 600 900; do node tools/hero-video/render.mjs $WORK range $a $((a+300)) & done; wait
bash tools/hero-video/encode.sh $WORK "$(which ffmpeg)"
```

Depois copie `out/hero.mp4` e `out/poster.jpg` para `public/video/` com o **nome
versionado novo** (`hero-v2.mp4`...) e atualize `Hero.tsx`. O nome muda
porque `/video/*` tem cache de 1 ano e `immutable` (ver `next.config.ts`).

## Regras de direção

- Texto na tela **sem ponto final**; uma cor de destaque; Inter com tracking apertado.
- Sem anéis de choque, partículas, RGB split, tremor de câmera, flare, glow, grade
  no chão, fundo piscando nem easing com bounce.
- Todo corte no início do compasso (120 BPM, 2s) e toda ação de UI numa batida.
- Nunca `opacity`/`filter` num elemento `preserve-3d` (achata e mostra as duas
  faces): esmaeça o invólucro.
- Só imagem real. O medidor do score é SVG com a geometria e a mola do `Gauge`,
  porque o componente real só existe com sessão e dados.
- O vídeo não tem áudio. Se for usar música, só faixa cuja licença permita uso
  comercial e que você tenha lido.

O vídeo de instruções (24s) tem README próprio em `tools/howto-video/` e usa os mesmos
scripts (`DUR`, `FRAMES`, `POSTER_FRAME` e `OUT` ajustam duração, quadros, poster e saída).
