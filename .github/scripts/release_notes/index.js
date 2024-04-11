/*
Copyright 2023 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const timestampObj = require('./timestamp.json')
const { repoNames, releaseNotesLocation, MAIN_RELEASE_NOTES_LOCATION } = require('./constants')
const { saveJsonObjToFile, setTimeZoneToPST, convertToDateTime } = require('./utils')
const { updateReleaseNotesPage } = require('./update-release-notes');
const { fetchReleaseInfoFromGitHub, sortReleaseInfoByDateASC } = require('./fetch-release-notes');

// Run the script on the root directory of the project: node .github/scripts/release_notes/index.js <GITHUB_TOKEN> [--dry-run]
const GITHUB_TOKEN = process.argv[2];

if (GITHUB_TOKEN == undefined) {
    throw new Error("token is undefined")
}

const DRY_RUN = process.argv.includes("--dry-run")

// Before running the script, make sure the default time zone is set to PST in the GitHub action
if (!setTimeZoneToPST()) {
    throw new Error("The default time zone is not set to PST")
}

console.log(`Start to fetch release info from GitHub created after [${convertToDateTime(timestampObj.ts)}]`);

(async function (dryRun) {
    const list = await fetchReleaseInfoFromGitHub(repoNames, "adobe", GITHUB_TOKEN, timestampObj.ts)
    const sortedList = sortReleaseInfoByDateASC(list)
    if (dryRun) {
        console.log("[Dry run mode] The following release notes need to be updated:")
        console.dir(sortedList)
        return
    }
    // 1. Update the main release page
    updateReleaseNotesPage(MAIN_RELEASE_NOTES_LOCATION, sortedList)
    const ignoreList = ['React Native', 'Roku', 'Flutter']
    for (const releaseInfo of sortedList) {
        // We don't have separate release-notes pages for React Native, Roku, Flutter, and BOM artifacts.
        if (ignoreList.includes(releaseInfo.platform) || releaseInfo.extension == "BOM") {
            continue
        }

        // 2. Update the extension's release note page
        let filePath = releaseNotesLocation[releaseInfo.extension]
        if (filePath != undefined) {
            updateReleaseNotesPage(filePath, [releaseInfo])
        } else {
            throw Error(`Not found the release note page for ${releaseInfo.extension}`)
        }
    }

    // 3. Save the timestamp to the file
    let jsonObj = {
        "ts": Date.now()
    }
    saveJsonObjToFile(jsonObj, `${__dirname}/timestamp.json`)
})(DRY_RUN).then(
    () => console.log("Finished updating release notes")
).catch(
    (error) => console.error(error)
);