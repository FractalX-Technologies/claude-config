#!/bin/sh
# Lays a track under a rendered video, its drop on the first cut; the limiter keeps the peaks under full scale.
# ./mix.sh <rendered video> <video with music>
set -e
# The track, by its path where it lives, and where it starts: start = the drop's second - the first cut's second.
song="<path to the track>"
start=<drop - first cut>
length=<the video's length in seconds>
# A render with sound of its own (court, crowd) keeps it under the music; one without it takes the music alone:
# drop "[0:a]volume=0.35[own];" and the amix, and map "[music]".
ffmpeg -v error -y -i "$1" -ss "$start" -t "$length" -i "$song" \
  -filter_complex "[0:a]volume=0.35[own];[1:a]volume=0.9,afade=t=in:d=0.2,afade=t=out:st=$(echo "$length - 1.2" | bc):d=1.2[music];[own][music]amix=inputs=2:normalize=0,alimiter=limit=0.8:level=disabled[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "$2"
