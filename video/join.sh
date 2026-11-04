#!/bin/sh
# Join the rendered scenes in out/ into the finished demo video (and fix the colour range for X/YouTube).
set -e
cd "$(dirname "$0")/out"
ls [0-9][0-9]_*.mp4 | sed "s/^/file '/;s/$/'/" > list.txt
ffmpeg -v error -y -f concat -safe 0 -i list.txt -c copy joined.mp4
ffmpeg -v error -y -i joined.mp4 -vf "scale=in_range=pc:out_range=tv,format=yuv420p" -c:v libx264 -preset veryfast -crf 17 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -movflags +faststart inkling_launch.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 inkling_launch.mp4 | sed 's/^/length (s): /'
echo "done: out/inkling_launch.mp4"
