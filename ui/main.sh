#! /bin/bash

set -eu -o pipefail
currentDirectory=$(dirname "${BASH_SOURCE:-$0}")

cat "${currentDirectory}/rollSection/rollSection.html";
echo "";
cat "${currentDirectory}/topSection/topSection.html";
echo "";
cat "${currentDirectory}/tabs/tabs.html";
echo "";
cat "${currentDirectory}/overviewTab/overviewTab.html";
echo "";
cat "${currentDirectory}/basicTab/basicTab.html";
echo "";
cat "${currentDirectory}/epicSkills/epicSkills.html";
echo "";
cat "${currentDirectory}/equipment/equipment.html";
echo "";
cat "${currentDirectory}/spells/spells.html";
echo "";

echo "<!-- Scripts -->";
echo "";
echo "<script type=\"text/worker\">";
cat "${currentDirectory}/scripts/inlineHtml/inlineScripts.js";
echo "";
echo "</script>";