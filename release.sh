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
	NORMAL_BRANCH="master"
else
	NORMAL_BRANCH=$1
fi

if [ "$NORMAL_BRANCH" == "master" ]; then
	GEEZER_BRANCH="geezer"
else
	GEEZER_BRANCH="$NORMAL_BRANCH-geezer"
fi

ROOT_DIR=$(cd $(dirname $0) && pwd)
BUILD_DIR="$ROOT_DIR/build"

if [ -d "$BUILD_DIR" ]; then
	echo "Existing build directory detected at $BUILD_DIR"
	echo "Aborted."
	exit 1
fi

echo "This is an internal Intern release script!"
echo "If you want to create a new Intern release from branches $NORMAL_BRANCH & $GEEZER_BRANCH,"
echo " press 'y'."
echo "(You will have an opportunity to abort pushing upstream later on if something"
echo "goes wrong.)"
read -s -n 1

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

mkdir "$BUILD_DIR"
git clone --recursive git@github.com:theintern/intern.git "$BUILD_DIR"

cd "$BUILD_DIR"

# Store the newly created tags and all updated branches outside of the loop so we can push/publish them all at once
# at the end instead of having to guess that the second loop will run successfully after the first one
NORMAL_TAG=
GEEZER_TAG=
PUSH_BRANCHES="$NORMAL_BRANCH $GEEZER_BRANCH"

# Before starting, make sure that geezer is up-to-date with master and fail if it is not.
# Check out the normal branch first so that we have a local copy to check from, otherwise it will not show up in
# the list of branches by default since only a remote version will exist
git checkout $NORMAL_BRANCH
git checkout $GEEZER_BRANCH
if [ $(git branch --merged|grep -c "^ *$NORMAL_BRANCH$") -eq 0 ]; then
	echo "Geezer is not fully merged! Please merge, then try again"
	exit 1
fi

for BRANCH in $NORMAL_BRANCH $GEEZER_BRANCH; do
	echo "Building $BRANCH branch..."

	git checkout $BRANCH

	# Get the version number for this release from package.json
	VERSION=$(grep -o '"version": "[^"]*"' package.json |grep -o "[0-9.]*")

	# Convert the version number to an array that we can use to generate the next release version number
	OLDIFS=$IFS
	IFS="."
	PRE_VERSION=($VERSION)
	IFS=$OLDIFS

	# This is a new major/minor release
	if [[ $VERSION =~ \.0$ ]]; then
		# We'll be creating a new minor release branch for this version for any future patch releases
		MAKE_BRANCH="${PRE_VERSION[0]}.${PRE_VERSION[1]}"
		BRANCH_VERSION="${PRE_VERSION[0]}.${PRE_VERSION[1]}.$((PRE_VERSION[2] + 1))-pre"

		# The branch name for the geezer version is suffixed with -geezer
		if [ "$BRANCH" == "$GEEZER_BRANCH" ]; then
			MAKE_BRANCH="$MAKE_BRANCH-geezer"
		fi

		# The next release is usually going to be a minor release; if the next version is to be a major release,
		# the package version will need to be manually updated in Git before release
		PRE_VERSION="${PRE_VERSION[0]}.$((PRE_VERSION[1] + 1)).0-pre"

	# This is a new patch release
	else
		# Patch releases do not get a branch
		MAKE_BRANCH=
		BRANCH_VERSION=

		# The next release version will always be another patch version
		PRE_VERSION="${PRE_VERSION[0]}.${PRE_VERSION[1]}.$((PRE_VERSION[2] + 1))-pre"
	fi

	# The Git tag for the geezer version is suffixed with -geezer
	if [ "$BRANCH" == "$GEEZER_BRANCH" ]; then
		TAG_VERSION="$VERSION-geezer"
		GEEZER_TAG="$TAG_VERSION"
	else
		TAG_VERSION=$VERSION
		NORMAL_TAG="$TAG_VERSION"
	fi

	# At this point:
	# $VERSION is the version of Intern that is being released;
	# $TAG_VERSION is the name that will be used for the Git tag for the release
	# $PRE_VERSION is the next pre-release version of Intern that will be set on the original branch after tagging
	# $MAKE_BRANCH is the name of the new minor release branch that should be created (if this is not a patch release)
	# $BRANCH_VERSION is the pre-release version of Intern that will be set on the minor release branch

	# Something is messed up and this release has already happened
	if [ $(git tag |grep -c "^$TAG_VERSION$") -gt 0 ]; then
		echo "Tag $TAG_VERSION already exists! Please check the branch."
		exit 1
	fi

	# Geezer branch needs to merge in from the normal branch to ensure that the histories are the same; we do this
	# before each version update to avoid making a weird history where the versions go n -> n + 1 -> n -> n + 1 on
	# newly created minor branches
	if [ "$BRANCH" == "$GEEZER_BRANCH" ]; then
		echo "Merging in normal branch before release..."
		git merge --no-edit -s ours $NORMAL_TAG >/dev/null 2>&1
	fi

	# Set the package version to release version
	sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json

	# Fix the Git-based dependencies to specific commit IDs
	echo "Fixing dependency commits..."
	for DEP in dojo intern intern-geezer; do
		DEP_URL=$(grep -o "\"$DEP\": \"[^\"]*\"" package.json |grep -o 'https://[^"]*' |sed -e 's/\/archive.*//')
		COMMIT=$(grep -o "\"$DEP\": \"[^\"]*\"" package.json |grep -o 'https://[^"]*' |sed -e 's/.*archive\/\(.*\)\.tar\.gz/\1/')
		if [ "$DEP_URL" != "" ]; then
			if [[ "$COMMIT" =~ ^[0-9a-fA-F]{40}$ ]]; then
				echo "Dependency $DEP is already fixed to $COMMIT"
			else
				mkdir "$BUILD_DIR/.dep"
				git clone --single-branch --depth 1 --branch=$COMMIT "$DEP_URL.git" "$BUILD_DIR/.dep"
				cd "$BUILD_DIR/.dep"
				COMMIT=$(git log -n 1 --format='%H')
				cd "$BUILD_DIR"
				rm -rf "$BUILD_DIR/.dep"
				DEP_URL=$(echo $DEP_URL |sed -e 's/[\/&]/\\&/g')
				echo "Fixing dependency $DEP to commit $COMMIT"
				sed -i -e "s/\(\"$DEP\":\) \"[^\"]*\"/\1 \"$DEP_URL\/archive\/$COMMIT.tar.gz\"/" package.json
			fi
		fi
	done

	# Commit the new release to Git
	git commit -m "Updating metadata for $VERSION" package.json
	git tag -a -m "Release $VERSION" $TAG_VERSION

	# Check out the previous package.json to get rid of the fixed dependencies
	git checkout HEAD^ package.json
	git reset package.json

	# Geezer branch needs to merge the normal branch again for the same reason as before
	if [ "$BRANCH" == "$GEEZER_BRANCH" ]; then
		echo "Merging in normal branch before pre-release..."
		git merge --no-edit -s ours $NORMAL_BRANCH >/dev/null 2>&1
	fi

	# Set the package version to next pre-release version
	sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$PRE_VERSION\"/" package.json

	# Commit the pre-release to Git
	git commit -m "Updating source version to $PRE_VERSION" package.json

	# If this is a major/minor release, we also create a new branch for it
	if [ "$MAKE_BRANCH" != "" ]; then
		# Create the new branch starting at the tagged release version
		git checkout -b $MAKE_BRANCH $TAG_VERSION

		# Geezer branch? Guess what needs to happen!
		if [ "$BRANCH" == "$GEEZER_BRANCH" ]; then
			echo "Merging in normal branch before minor branch..."
			git merge --no-edit -s ours ${MAKE_BRANCH%-geezer} >/dev/null 2>&1
		fi

		# Set the package version to the next patch pre-release version
		sed -i -e "s/\"version\": \"[^\"]*\"/\"version\": \"$BRANCH_VERSION\"/" package.json

		# Commit the pre-release to Git
		git commit -m "Updating source version to $BRANCH_VERSION" package.json

		# Store the branch as one that needs to be pushed when we are ready to deploy the release
		PUSH_BRANCHES="$PUSH_BRANCHES $MAKE_BRANCH"
	fi

	echo "Done with $BRANCH!"
done

echo "Please confirm packaging success, then press 'y', ENTER to publish to npm, push"
echo "tags, and upload, or any other key to bail."
read -p "> "

if [ "$REPLY" != "y" ]; then
	echo "Aborted."
	exit 0
fi

for BRANCH in $PUSH_BRANCHES; do
	git push origin $BRANCH
done

git push origin --tags

git checkout $NORMAL_TAG
npm publish
git checkout $GEEZER_TAG
npm publish

cd "$ROOT_DIR"
rm -rf "$BUILD_DIR"

echo "All done! Yay!"
