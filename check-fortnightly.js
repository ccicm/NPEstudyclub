// check-fortnightly.js
// Reads .last-fortnightly-run and writes 'true' or 'false' to /tmp/should_run
// Called by the fortnightly GitHub Action before generation

const fs = require('fs');
const path = require('path');

const FORCE_RUN = process.env.FORCE_RUN === 'true';
const LAST_RUN_FILE = path.join(__dirname, '.last-fortnightly-run');
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

function shouldRun() {
  if (FORCE_RUN) {
    console.log('Force run requested — proceeding.');
    return true;
  }

  if (!fs.existsSync(LAST_RUN_FILE)) {
    console.log('No last run file found — first run, proceeding.');
    return true;
  }

  const lastRunRaw = fs.readFileSync(LAST_RUN_FILE, 'utf8').trim();
  const lastRun = new Date(lastRunRaw);

  if (isNaN(lastRun.getTime())) {
    console.log('Could not parse last run date — proceeding to be safe.');
    return true;
  }

  const now = new Date();
  const elapsed = now - lastRun;

  if (elapsed >= FORTNIGHT_MS) {
    console.log(`Last run: ${lastRunRaw}. ${Math.floor(elapsed / 86400000)} days elapsed — proceeding.`);
    return true;
  }

  console.log(`Last run: ${lastRunRaw}. Only ${Math.floor(elapsed / 86400000)} days elapsed — skipping.`);
  return false;
}

const result = shouldRun();
fs.writeFileSync('/tmp/should_run', result ? 'true' : 'false');
process.exit(0);
