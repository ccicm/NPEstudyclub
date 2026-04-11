#!/usr/bin/env node
// seed-launch-pack.js
// Seeds launch-day quiz inventory: weekly domain sets (targeted) + one full exam.

const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../npe-web/.env.local') });

const launchDate = (process.env.LAUNCH_DATE || '2026-04-10').trim();
const weeklyDomainCount = Number(process.env.WEEKLY_DOMAIN_COUNT || '12');

if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) {
  console.error(`Invalid LAUNCH_DATE: ${launchDate}. Expected YYYY-MM-DD.`);
  process.exit(1);
}

if (!Number.isInteger(weeklyDomainCount) || weeklyDomainCount < 1) {
  console.error(`Invalid WEEKLY_DOMAIN_COUNT: ${weeklyDomainCount}. Use a positive integer.`);
  process.exit(1);
}

const domains = [
  { number: 1, label: 'Ethics' },
  { number: 2, label: 'Assessment' },
  { number: 3, label: 'Interventions' },
  { number: 4, label: 'Communication' },
];

function runGenerator(env, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n--- ${label} ---`);
    const proc = spawn('node', [path.join(__dirname, 'generate-questions.js')], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  console.log('Seeding launch quiz pack...');
  console.log(`Launch date: ${launchDate}`);
  console.log(`Weekly domain set size: ${weeklyDomainCount}`);

  for (const domain of domains) {
    await runGenerator(
      {
        GENERATION_MODE: 'targeted',
        DATE_SEED: launchDate,
        TARGET_DOMAIN: String(domain.number),
        TARGET_COUNT: String(weeklyDomainCount),
        QUIZ_LABEL: `Weekly ${domain.label}`,
        SEED_VERSION: 'launch-v1',
      },
      `Weekly ${domain.label}`,
    );
  }

  await runGenerator(
    {
      GENERATION_MODE: 'fortnightly',
      DATE_SEED: launchDate,
      QUIZ_LABEL: 'Exam',
      SEED_VERSION: 'launch-v1',
    },
    'Full exam',
  );

  console.log('\nDone. Seeded 4 weekly domain quizzes and 1 full exam.');
}

main().catch((error) => {
  console.error(`\nSeeding failed: ${error.message}`);
  process.exit(1);
});
