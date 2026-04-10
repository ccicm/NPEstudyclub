const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MODE = 'daily';
const WINDOW_DAYS = Number(process.env.AUDIT_DAYS || '7');
const OUTPUT_DIR = path.join(__dirname, '../docs');
const STAGING_DIR = path.join(__dirname, '../seed/staging');

function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildDateWindow() {
  const days = [];
  const now = new Date();

  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - offset);
    days.push(formatDate(d));
  }

  return days;
}

function runGeneratorForDate(dateSeed) {
  const result = spawnSync('node', ['generate-questions.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      GENERATION_MODE: MODE,
      DRY_RUN: 'true',
      DATE_SEED: dateSeed,
    },
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`Generator failed for ${dateSeed}: ${result.stderr || result.stdout}`);
  }
}

function readSet(dateSeed) {
  const filePath = path.join(STAGING_DIR, `${MODE}-${dateSeed}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing generated set file: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function answerDistribution(questions) {
  const counts = { A: 0, B: 0, C: 0, D: 0, E: 0 };
  for (const question of questions) {
    const key = String(question.correct_answer || '').toUpperCase();
    if (counts[key] !== undefined) {
      counts[key] += 1;
    }
  }
  return counts;
}

function adjacentRepeats(sets) {
  const results = [];

  for (let i = 1; i < sets.length; i += 1) {
    const prev = sets[i - 1];
    const curr = sets[i];

    const prevQuestions = new Set(prev.questions.map((q) => q.question));
    const stemOverlap = curr.questions.filter((q) => prevQuestions.has(q.question)).length;

    const prevShapes = new Set(prev.questions.map((q) => `${q.domain_label}|${q.subdomain}`));
    const shapeOverlap = curr.questions.filter((q) => prevShapes.has(`${q.domain_label}|${q.subdomain}`)).length;

    results.push({
      pair: `${prev.set_id} -> ${curr.set_id}`,
      stemOverlap,
      shapeOverlap,
    });
  }

  return results;
}

function mostFrequentSubdomains(sets) {
  const counts = new Map();

  for (const set of sets) {
    for (const question of set.questions) {
      const key = `${question.domain_label} | ${question.subdomain}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
}

function renderReport(dates, sets) {
  const distributions = sets.map((set) => ({
    setId: set.set_id,
    distribution: answerDistribution(set.questions),
  }));

  const repeats = adjacentRepeats(sets);
  const frequentSubdomains = mostFrequentSubdomains(sets);

  const lines = [];
  lines.push('# Generator Repetition Audit');
  lines.push('');
  lines.push(`Generated on: ${new Date().toISOString()}`);
  lines.push(`Window: ${dates[0]} to ${dates[dates.length - 1]} (${dates.length} adjacent days)`);
  lines.push('');

  lines.push('## Adjacent-Day Overlap');
  lines.push('');
  lines.push('| Pair | Exact Stem Overlap | Domain+Subdomain Overlap |');
  lines.push('|---|---:|---:|');
  for (const row of repeats) {
    lines.push(`| ${row.pair} | ${row.stemOverlap} | ${row.shapeOverlap} |`);
  }
  lines.push('');

  lines.push('## Correct-Answer Position Distribution');
  lines.push('');
  lines.push('| Set | A | B | C | D | E |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const row of distributions) {
    const d = row.distribution;
    lines.push(`| ${row.setId} | ${d.A} | ${d.B} | ${d.C} | ${d.D} | ${d.E} |`);
  }
  lines.push('');

  lines.push('## Most Repeated Domain/Subdomain Shapes');
  lines.push('');
  lines.push('| Domain/Subdomain | Count Across Window |');
  lines.push('|---|---:|');
  for (const [shape, count] of frequentSubdomains) {
    lines.push(`| ${shape} | ${count} |`);
  }
  lines.push('');

  lines.push('## Initial Interpretation');
  lines.push('');
  lines.push('- Exact stem overlap should trend toward 0 across adjacent days.');
  lines.push('- High domain/subdomain overlap signals limited template variety within domains.');
  lines.push('- Correct-answer position should remain reasonably balanced over the window.');

  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  }
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const dates = buildDateWindow();
  for (const dateSeed of dates) {
    runGeneratorForDate(dateSeed);
  }

  const sets = dates.map(readSet);
  const report = renderReport(dates, sets);
  const reportPath = path.join(OUTPUT_DIR, `GENERATOR_REPETITION_AUDIT.${dates[0]}_to_${dates[dates.length - 1]}.md`);
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log(`Audit complete: ${reportPath}`);
}

main();
