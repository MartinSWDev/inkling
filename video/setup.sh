#!/bin/sh
# One-time setup: link the game's assets into public/ and extract the tunnel frames from the phone footage.
set -e
cd "$(dirname "$0")"
mkdir -p public/sim public/tun
for d in fonts characters stickers cards room views; do ln -sfn "../../web/public/$d" "public/$d"; done
ln -sfn "../../../web/public/sim/buildings" public/sim/buildings
cp ../web/public/paper-grain.png public/paper-grain.png   # a file symlink is not followed by the bundler
if [ ! -f public/tun/0/0001.jpg ]; then
  i=0
  for from in 10.3 20.2 31.4 44.2 56.6; do
    mkdir -p "public/tun/$i"
    ffmpeg -v error -y -ss "$from" -t 6.4 -i public/phone.mp4 -vf "fps=30,scale=540:-2" -q:v 4 "public/tun/$i/%04d.jpg"
    i=$((i+1))
  done
fi
echo "ready: npm install, then node render.mjs"
