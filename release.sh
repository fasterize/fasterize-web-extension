#!/bin/bash

function bump {
  output=$(npm version ${release} --no-git-tag-version)
  version=${output:1}
  search='("version":[[:space:]]*").+(")'
  replace="\1${version}\2"

  sed -i ".tmp" -E "s/${search}/${replace}/g" "$1"
  rm "$1.tmp"
  echo $version
}

function help {
  echo "Usage: $(basename $0) [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease]"
}

function releaseForFirefox {
  web-ext -a dist/firefox -s app build --overwrite-dest
  web-ext -a dist/firefox -s app sign --api-key=$MOZILLA_API_KEY --api-secret=$MOZILLA_API_SECRET
  hub release create -a dist/firefox/fasterize_status-${version}-an+fx.xpi -m "test" $version
}

function updateManifest {
  echo "V2"
  echo $version
  # Remove "key3" and write results back to test.json (recreate it with result).
  jq -c ". + {
      \"version\": \"${version}\",
      \"update_link\": \"https://github.com/fasterize/fasterize-web-extension/releases/download/${version}/fasterize_status-${version}-an+fx.xpi\"
  }" app/update-manifest.json > tmp.$$.json && mv tmp.$$.json app/update-manifest.json
}

if [ -z "$1" ] || [ "$1" = "help" ]; then
  help
  exit
fi

release=$1

# if [ -d ".git" ]; then
#   changes=$(git status --porcelain)

#   if [ -z "${changes}" ]; then
    version=$(bump "app/manifest.json")
    echo "V0"
    echo $version
    updateManifest
    git add .
    echo "V1"
    echo $version
    git commit -m "Bump to ${version}"
    git tag -a "${output}" -m "${version}"
    # git push origin --tags
    releaseForFirefox
#   else
#     echo "Please commit staged files prior to bumping"
#   fi
# fi
