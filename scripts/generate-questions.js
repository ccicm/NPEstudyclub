// generate-questions.js
// Called by both daily and fortnightly GitHub Actions
// Reads the system prompt, calls Anthropic API, validates output,
// writes JSON seed file, and inserts into Supabase

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

// ─── Config ──────────────────────────────────────────────────────────────────

const MODE = process.env.GENERATION_MODE || 'daily'; // 'daily' | 'fortnightly'
const DRY_RUN = process.env.DRY_RUN === 'true';

const DOMAIN_DISTRIBUTION = {
  daily: [
    { domain: 1, domain_label: 'Ethics', count: 1 },
    { domain: 2, domain_label: 'Assessment', count: 1 },
    { domain: 3, domain_label: 'Interventions', count: 1 },
    { domain: 4, domain_label: 'Communication', count: 1 },
  ],
  fortnightly: [
    { domain: 1, domain_label: 'Ethics', count: 40 },
    { domain: 2, domain_label: 'Assessment', count: 40 },
    { domain: 3, domain_label: 'Interventions', count: 40 },
    { domain: 4, domain_label: 'Communication', count: 30 },
  ],
};

const PROMPT_PATH = path.join(__dirname, '../prompts/npe-question-prompt.md');
const STAGING_DIR = path.join(__dirname, '../seed/staging');

// ─── Clients ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = DRY_RUN
  ? null
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadSystemPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf8');
}

function buildUserPrompt(domain, domain_label, count) {
  return `Generate ${count} NPE-style examination question${count > 1 ? 's' : ''} for Domain ${domain}: ${domain_label}.

Return ONLY a valid JSON array. No preamble, no markdown fences, no commentary.

Each object must match this schema exactly:
{
  "domain": ${domain},
  "domain_label": "${domain_label}",
  "subdomain": "string",
  "question": "string",
  "options": { "A": "string", "B": "string", "C": "string", "D": "string", "E": "string" },
  "correct_answer": "A|B|C|D|E",
  "correct_explanation": "string",
  "distractor_explanations": {
    "<incorrect_option_letter>": "string"
    // include all four incorrect options
  },
  "citations": ["string"],
  "difficulty_seed": "standard|challenging|advanced"
}`;
}

function validateQuestion(q, index) {
  const required = ['domain', 'domain_label', 'subdomain', 'question', 'options',
    'correct_answer', 'correct_explanation', 'distractor_explanations', 'citations', 'difficulty_seed'];

  for (const field of required) {
    if (q[field] === undefined || q[field] === null) {
      throw new Error(`Question ${index}: missing field "${field}"`);
    }
  }

  const optionKeys = Object.keys(q.options);
  if (!['A', 'B', 'C', 'D', 'E'].every(k => optionKeys.includes(k))) {
    throw new Error(`Question ${index}: options must include A, B, C, D, E`);
  }

  if (!['A', 'B', 'C', 'D', 'E'].includes(q.correct_answer)) {
    throw new Error(`Question ${index}: correct_answer must be A-E, got "${q.correct_answer}"`);
  }

  if (!['standard', 'challenging', 'advanced'].includes(q.difficulty_seed)) {
    throw new Error(`Question ${index}: difficulty_seed must be standard|challenging|advanced`);
  }

  if (!Array.isArray(q.citations) || q.citations.length === 0) {
    throw new Error(`Question ${index}: citations must be a non-empty array`);
  }

  // Add computed fields
  q.difficulty_score = null;
  q.flagged = false;

  return q;
}

async function generateForDomain({ domain, domain_label, count }) {
  console.log(`Generating ${count} question(s) for Domain ${domain}: ${domain_label}...`);

  const systemPrompt = loadSystemPrompt();
  const userPrompt = buildUserPrompt(domain, domain_label, count);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: count <= 5 ? 4096 : 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0].text.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Raw response:', raw.slice(0, 500));
    throw new Error(`Failed to parse JSON for Domain ${domain}: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Domain ${domain}: expected JSON array, got ${typeof parsed}`);
  }

  return parsed.map((q, i) => validateQuestion(q, i));
}

async function insertToSupabase(questions, setId) {
  console.log(`Inserting ${questions.length} questions into Supabase...`);

  const rows = questions.map(q => ({
    ...q,
    set_id: setId,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('quiz_questions')
    .insert(rows);

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  console.log(`Inserted ${rows.length} questions successfully.`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nNPE Question Generator`);
  console.log(`Mode: ${MODE}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const distribution = DOMAIN_DISTRIBUTION[MODE];
  if (!distribution) throw new Error(`Unknown mode: ${MODE}`);

  const allQuestions = [];

  for (const domainSpec of distribution) {
    const questions = await generateForDomain(domainSpec);
    allQuestions.push(...questions);
    // Small delay between domain calls to avoid rate limits on large sets
    if (MODE === 'fortnightly') {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\nGenerated ${allQuestions.length} questions total.`);

  // Write seed file
  const dateStr = new Date().toISOString().split('T')[0];
  const setId = `${MODE}-${dateStr}`;
  const filename = `${setId}.json`;
  const outputPath = path.join(STAGING_DIR, filename);

  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  }

  const payload = {
    set_id: setId,
    mode: MODE,
    generated_at: new Date().toISOString(),
    question_count: allQuestions.length,
    questions: allQuestions,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Seed file written: ${outputPath}`);

  if (DRY_RUN) {
    console.log('\nDry run complete — Supabase insert skipped.');
    return;
  }

  await insertToSupabase(allQuestions, setId);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});