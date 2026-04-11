#!/usr/bin/env node
// reseed-quizzes.js
// Delete old auto-generated quizzes and regenerate 8 fresh daily sets with new format

require('dotenv').config({ path: require('path').join(__dirname, '../npe-web/.env.local') });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function deleteOldQuizzes() {
  console.log('🗑️  Deleting old auto-generated quizzes...');
  
  // First get the old quiz IDs
  const { data: oldQuizzes, error: fetchError } = await supabase
    .from('quizzes')
    .select('id')
    .eq('author_name', 'NPE Quiz Bot');

  if (fetchError) {
    console.error('❌ Failed to fetch old quizzes:', fetchError.message);
    console.error('Full error:', fetchError);
    return false;
  }

  if (oldQuizzes.length === 0) {
    console.log('✓ No old quizzes found');
    return true;
  }

  const quizIds = oldQuizzes.map(q => q.id);
  console.log(`Found ${quizIds.length} old quizzes to delete...`);

  // 1. Delete quiz_results
  await supabase.from('quiz_results').delete().in('quiz_id', quizIds);
  console.log(`✓ Deleted quiz results`);

  // 2. Get quiz_question IDs and delete explanation feedback first
  const { data: questions } = await supabase
    .from('quiz_questions')
    .select('id')
    .in('quiz_id', quizIds);
  
  if (questions?.length > 0) {
    const questionIds = questions.map(q => q.id);
    await supabase.from('explanation_feedback').delete().in('question_id', questionIds);
    console.log(`✓ Deleted explanation feedback`);

    // 3. Delete forum_threads that reference questions via explanation_review_thread_id
    const { data: threadsWithExplanation } = await supabase
      .from('forum_threads')
      .select('id')
      .in('explanation_review_thread_id', questionIds);

    if (threadsWithExplanation?.length > 0) {
      const threadIds = threadsWithExplanation.map(t => t.id);
      // Delete any nested forum posts first
      await supabase.from('forum_posts').delete().in('thread_id', threadIds);
      // Then delete the threads
      await supabase.from('forum_threads').delete().in('id', threadIds);
      console.log(`✓ Deleted explanation forum threads`);
    }
  }

  // 4. Delete forum_threads linked to the quiz
  await supabase.from('forum_posts').delete().in('thread_id', (await supabase.from('forum_threads').select('id').in('quiz_id', quizIds)).data?.map(t => t.id) || []);
  await supabase.from('forum_threads').delete().in('quiz_id', quizIds);
  console.log(`✓ Deleted forum threads`);

  // 5. Delete quiz_questions
  await supabase.from('quiz_questions').delete().in('quiz_id', quizIds);
  console.log(`✓ Deleted quiz questions`);

  // 6. Now delete the quizzes
  const { error: deleteQuizzesError } = await supabase
    .from('quizzes')
    .delete()
    .eq('author_name', 'NPE Quiz Bot');

  if (deleteQuizzesError) {
    console.error('❌ Failed to delete old quizzes:', deleteQuizzesError.message);
    return false;
  }

  console.log(`✓ Deleted ${quizIds.length} old quiz records`);
  return true;
}

function generateForDate(dateSeed) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, DATE_SEED: dateSeed, GENERATION_MODE: 'daily' };
    
    const proc = spawn('node', [path.join(__dirname, './generate-questions.js')], {
      cwd: path.join(__dirname, '../'),
      env,
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Generated quiz for ${dateSeed}`);
        resolve();
      } else {
        reject(new Error(`Generator exited with code ${code} for ${dateSeed}`));
      }
    });

    proc.on('error', reject);
  });
}

function getDatesBefore(dateSeed, count) {
  const dates = [];
  const baseDate = new Date(`${dateSeed}T00:00:00Z`);

  for (let i = 0; i < count; i++) {
    baseDate.setUTCDate(baseDate.getUTCDate() - 1);
    const iso = baseDate.toISOString().slice(0, 10);
    dates.push(iso);
  }

  return dates.reverse();
}

async function main() {
  try {
    // Delete old quizzes
    const deleteSucceeded = await deleteOldQuizzes();
    if (!deleteSucceeded) {
      process.exit(1);
    }

    // Generate 8 fresh daily quizzes retrospectively
    console.log('\n📝 Regenerating 8 fresh daily quizzes...\n');
    
    const today = '2026-04-11'; // Current date in this scenario
    const dates = getDatesBefore(today, 8);

    for (const date of dates) {
      await generateForDate(date);
    }

    console.log('\n✅ Reseed complete! 8 fresh daily quizzes generated with new format.');
  } catch (error) {
    console.error('❌ Reseed failed:', error.message);
    process.exit(1);
  }
}

main();
