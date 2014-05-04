#!/usr/bin/env bash

set -e

usage() {
	echo "Usage: $0 [branch]"
	echo
	echo "Branch defaults to 'master'."
	exit 1
}

if [ "$1" == "--help" ]; then
	usage
	exit 0
elif [ "$1" == "" ]; then
	BRANCH="master"
else
	BRANCH=$1
fi

ROOT_DIR=$(cd $(dirname $0) && pwd)
BUILD_DIR="$ROOT_DIR/build"

if [ -d "$BUILD_DIR" ]; then
	echo "Existing build directory detected at $BUILD_DIR"
	echo "Aborted."
	exit 1
fi

echo "This is an internal Intern release script!"
echo "If you want to create a new Intern release from branch $BRANCH, press 'y'."
echo "(You will have an opportunity to abort pushing upstream later on if something"
echo "goes wrong.)"
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

mkdir "$BUILD_DIR"

git clone --recursive --single-branch --branch=$BRANCH git@github.com:theintern/intern.git "$BUILD_DIR"
cd "$BUILD_DIR"

VERSION=$(grep -o '"version": "[^"]*"' package.json |grep -o "[0-9.]*")

OLDIFS=$IFS
IFS="."
PRE_VERSION=($VERSION)
IFS=$OLDIFS

# New major/minor release; bump minor version number
if [[ $VERSION =~ \.0$ ]]; then
	PRE_VERSION="${PRE_VERSION[0]}.$((PRE_VERSION[1] + 1)).0-pre"
# New patch release; bump minor version number
else
	PRE_VERSION="${PRE_VERSION[0]}.${PRE_VERSION[1]}.$((PRE_VERSION[2] + 1))-pre"
fi

TAG_VERSION=$VERSION
if [ $(grep -c '"name": "intern-geezer"' package.json) -gt 0 ]; then
	TAG_VERSION="$TAG_VERSION-geezer"
fi

if [ $(git tag |grep -c "^$TAG_VERSION$") -gt 0 ]; then
	echo "Tag $TAG_VERSION already exists"
	exit 1
fi

sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json

# Fix Git-based dependencies to specific commit IDs
echo "Fixing dependency commits..."
for DEP in dojo intern intern-geezer; do
	DEP_URL=$(grep -o "\"$DEP\": \"[^\"]*\"" package.json |grep -o 'https://[^"]*' |sed -e 's/\/archive.*//')
	if [ "$DEP_URL" != "" ]; then
		mkdir "$BUILD_DIR/.dep"
		COMMIT=$(grep -o "\"$DEP\": \"[^\"]*\"" package.json |grep -o 'https://[^"]*' |sed -e 's/.*archive\/\(.*\)\.tar\.gz/\1/')
		git clone --single-branch --depth 1 --branch=$COMMIT "$DEP_URL.git" "$BUILD_DIR/.dep" >/dev/null 2>&1
		cd "$BUILD_DIR/.dep"
		COMMIT=$(git log -n 1 --format='%H')
		cd "$BUILD_DIR"
		rm -rf "$BUILD_DIR/.dep"
		DEP_URL=$(echo $DEP_URL |sed -e 's/[\/&]/\\&/g')
		echo "Fixing dependency $DEP to commit $COMMIT"
		sed -i -e "s/\(\"$DEP\":\) \"[^\"]*\"/\1 \"$DEP_URL\/archive\/$COMMIT.tar.gz\"/" package.json
	fi
done
echo "Done"

git commit -m "Updating metadata for $VERSION" package.json
git tag -a -m "Release $VERSION" $TAG_VERSION

git checkout HEAD^ package.json
sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$PRE_VERSION\"/" package.json
git commit -m "Updating source version to $PRE_VERSION" package.json

git checkout $TAG_VERSION >/dev/null 2>&1

echo "Please confirm packaging success, then press 'y', ENTER to publish to npm, push"
echo "tags, and upload, or any other key to bail."
read -p "> "

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

git push origin $BRANCH
git push origin --tags
npm publish

rm -rf "$BUILD_DIR"

echo "All done! Yay!"
