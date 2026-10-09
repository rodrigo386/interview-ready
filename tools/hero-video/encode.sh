#!/bin/bash
# Junta os subquadros (tmix = motion blur real) e gera o MP4 do hero + o poster.
# Uso: bash tools/hero-video/encode.sh <WORK> <caminho-do-ffmpeg>
# Variáveis (padrão = vídeo promocional): FRAMES=1200  POSTER_FRAME=108  OUT=hero.mp4
# Vídeo "como funciona" (24s): FRAMES=1440 POSTER_FRAME=114 OUT=howto.mp4
set -e
WORK="$1"; FF="$2"
FRAMES="${FRAMES:-1200}"; POSTER_FRAME="${POSTER_FRAME:-108}"; OUT="${OUT:-hero.mp4}"
[ -n "$WORK" ] && [ -n "$FF" ] || { echo "uso: encode.sh <WORK> <ffmpeg>"; exit 1; }
cd "$WORK"
mkdir -p seq out; rm -f seq/*
i=0
for f in $(seq 0 $((FRAMES-1))); do
  for s in 0 1 2; do
    ln -s "$WORK/frames/sub/f$(printf %05d $f)_${s}.jpg" "seq/s_$(printf %06d $i).jpg"; i=$((i+1))
  done
done
# tmix de 3 subquadros, mantém 1 a cada 3 (60fps) e converte a faixa de cor dos JPEGs
# (full) para a de vídeo (tv, BT.709) — sem isso o MP4 sai yuvj420p.
"$FF" -hide_banner -loglevel error -y -framerate 180 -i seq/s_%06d.jpg \
  -vf "tmix=frames=3:weights='1 1 1',select='eq(mod(n\,3)\,2)',setpts=N/(60*TB),scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p" -r 60 \
  -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -movflags +faststart -an "out/$OUT"
# poster = quadro com a ideia completa (o gancho no promo, o título no "como funciona"):
# é o que aparece antes do play e com reduced-motion
"$FF" -hide_banner -loglevel error -y -i "frames/sub/f$(printf %05d $POSTER_FRAME)_1.jpg" -vf scale=1280:-1 -q:v 4 out/poster.jpg
ls -la out
