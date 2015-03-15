#!/bin/bash

echo "gif2mp4 script running"
echo $1

cd /tmp
echo "ls"
echo `ls`

CODE=`basename $1 .gif`
echo $CODE

ffmpeg -y -i $1 -c:v libx264 -pix_fmt yuv420p $CODE.mp4

echo "ls"
echo `ls`

for i in {1..5}; do printf "file '%s'\n" $CODE.mp4 >> list.txt; done
ffmpeg -y -f concat -i list.txt -c copy $CODE-final.mp4

rm $1
rm $CODE.mp4
rm list.txt
