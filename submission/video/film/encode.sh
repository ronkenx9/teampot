#!/bin/sh
# 120 fps frames → blend pairs for motion blur → 60 fps H.264 + soundtrack
MIX=${1:-out/mix.wav}; OUT=${2:-out/teampot-film.mp4}
ffmpeg -y -v error -stats -framerate 120 -i out/frames/%06d.jpg -i "$MIX" \
  -vf "tmix=frames=2:weights='1 1',fps=60,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high -movflags +faststart \
  -af "apad" -c:a aac -b:a 320k -t 110 "$OUT"
