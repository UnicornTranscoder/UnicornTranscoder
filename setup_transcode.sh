#!/bin/sh

if [ $# -ne 1 ]
then
    echo "Usage $0 {URL}"
    exit 1
fi

transcodepath=`pwd`
cwd="/tmp/plex-$$/"
mkdir $cwd

wget $1 -P "$cwd"

if [ $? -ne 0 ]
then
    echo "Failed Download"
    rm -rf $cwd
    exit 1
fi

filename=`ls $cwd`

cd $cwd
ar x $filename

if [ $? -ne 0 ]
then
    echo "Failed $filename extraction"
    rm -rf $cwd
    exit 1
fi

tar -xf "data.tar.gz"

if [ $? -ne 0 ]
then
    echo "Failed to extract tarball"
    rm -rf $cwd
    exit 1
fi

cd $transcodepath
rm -rf Resources
mv "$cwd/usr/lib/plexmediaserver/" Resources
rm -rf $cwd
