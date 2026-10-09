# Vídeo "como funciona" (instruções)

Gera `public/video/howto-v1.mp4` (24s, 1920×1080, 60fps, sem áudio): como
preencher a análise grátis, o que o resultado mostra, e o que é a preparação
completa. Fica ao lado do formulário, na seção `#analisar` da landing.

Mesmo motor do vídeo promocional (`tools/hero-video/`): cada quadro é função pura
de `window.seek(t)`, 120 BPM (compasso de 2s, batida de 0,5s), motion blur por 3
subquadros + `tmix`. Leia o README de lá para os requisitos e as regras de direção.

## O que ele afirma (todos os fatos vêm do código; mudou algo, regere)

- Grátis, sem cadastro: score ATS + o ajuste que mais barra (`LockedFix`,
  `resultado/page.tsx`). Criar conta grátis revela mais 2 ajustes.
- Completa: currículo reescrito, pesquisa atual da empresa, faixa salarial
  estimada, perguntas com roteiro (`DossiePitch`). R$10 por vaga; pacotes
  1×R$10, 3×R$25, 5×R$40 (`PREP_SKUS`); crédito não expira.
- PDF, DOCX ou TXT, até 5 MB (`AnonAtsForm`).
- "~15 perguntas" vem da copy da `/exemplo` e do `/pricing`.
- **Preços e limites estão gravados no vídeo.** Mudou o preço ou o limite: regere.

## Como regerar

```bash
WORK=/tmp/howto-video
mkdir -p $WORK/fonts && cp tools/howto-video/video.html $WORK/
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 $WORK/fonts/

# 1) a rota temporária (NÃO commitar) que filma a tela de resultado
mkdir -p src/app/zz-howto-tmp && cp tools/howto-video/zz-howto-tmp.page.tsx.txt src/app/zz-howto-tmp/page.tsx
pnpm dev -p 3100 &

# 2) capturas: o formulário real + painéis (hero-video) e o resultado + vaga (aqui)
node tools/hero-video/capture.mjs $WORK
node tools/howto-video/capture.mjs $WORK

# 3) apague a rota temporária e confira que o git está limpo
rm -r src/app/zz-howto-tmp && git status --short

# 4) sonde ANTES do render cheio (24s = 1440 quadros)
DUR=24 node tools/hero-video/render.mjs $WORK probe '[1.8,3.3,5.3,6.8,8.8,10.8,13.6,14.7,16.3,18.3,21.3,23.2]'
for a in 0 360 720 1080; do DUR=24 node tools/hero-video/render.mjs $WORK range $a $((a+360)) & done; wait
FRAMES=1440 POSTER_FRAME=114 OUT=howto.mp4 bash tools/hero-video/encode.sh $WORK "$(which ffmpeg)"
```

Copie `out/howto.mp4` e `out/poster.jpg` para `public/video/` com nome versionado
novo (`howto-v2.mp4`...) e atualize `Hero.tsx`. `/video/*` tem cache de 1 ano.
