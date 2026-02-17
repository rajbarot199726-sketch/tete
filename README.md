# LinkedIn GHC25 Open-to-Work Collector (Chrome Extension)

This extension automates the workflow you described:

1. Starts from LinkedIn home/feed.
2. Searches for `ghc25`.
3. Opens **See all people results**.
4. On each People results page, finds profile cards containing **Open to work**.
5. Saves matched profile links to `chrome.storage.local`.
6. Clicks **Next** page and repeats until no next page remains or you stop it.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder.

## Use

1. Log into LinkedIn in the same browser profile.
2. Go to LinkedIn home/feed.
3. Open extension popup and click **Start**.
4. Keep LinkedIn tab open while it runs.
5. Collected links appear in the popup and are persisted in browser storage.

## Notes

- LinkedIn UI selectors can change. If they do, update selectors in `content.js`.
- Some badges may be rendered differently based on locale/account type.
