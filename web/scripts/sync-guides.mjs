// The how-to guides are written once, in the app (app/assets/help/guides.json). This copies them into the
// website before a build, so /help/ shows the same steps as the app's Help screen. Where the app folder
// isn't there (a website-only build, e.g. on Vercel), the committed copy is used as it is.
// tests/help.test.tsx fails if the committed copy and the app's have drifted apart.
import { copyFileSync, existsSync } from "node:fs";

const from = new URL("../../app/assets/help/guides.json", import.meta.url);
const to = new URL("../src/lib/guides.json", import.meta.url);
if (existsSync(from)) {
  copyFileSync(from, to);
  console.log("Synced help guides from the app");
}
