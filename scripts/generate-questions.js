// generate-questions.js
// Free, deterministic NPE question generator.
// Builds varied daily and fortnightly sets from a local question bank,
// writes JSON seed files, and inserts legacy-compatible rows into Supabase.

const fs = require('fs');
const path = require('path');

const MODE = process.env.GENERATION_MODE || 'daily';
const DRY_RUN = process.env.DRY_RUN === 'true';
const STAGING_DIR = path.join(__dirname, '../seed/staging');
const SOURCE_BANK = JSON.parse(fs.readFileSync(path.join(__dirname, './source-bank.json'), 'utf8'));
const SOURCE_CITATIONS = new Map();

for (const source of SOURCE_BANK.sources) {
  SOURCE_CITATIONS.set(source.citation, source);
  for (const alias of source.aliases || []) {
    SOURCE_CITATIONS.set(alias, source);
  }
}

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

function getAestDateSeed(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not derive AEST date seed.');
  }

  return `${year}-${month}-${day}`;
}

function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !/^https?:\/\//i.test(supabaseUrl)) {
    throw new Error('Missing or invalid Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL to the full https:// project URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY in GitHub Secrets or .env.local.');
  }

  try {
    const parts = serviceRoleKey.split('.');
    if (parts.length !== 3) {
      throw new Error('Supabase key is not a JWT.');
    }

    const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadRaw);

    if (payload.role !== 'service_role') {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY has role "${payload.role || 'unknown'}". Expected "service_role".`,
      );
    }
  } catch (error) {
    throw new Error(
      `Invalid SUPABASE_SERVICE_ROLE_KEY: ${error instanceof Error ? error.message : 'could not parse key payload'}`,
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

const supabase = DRY_RUN
  ? null
  : (() => {
      const { createClient } = require('@supabase/supabase-js');
      const { supabaseUrl, serviceRoleKey } = getSupabaseConfig();
      return createClient(supabaseUrl, serviceRoleKey);
    })();

function createSeededRng(seedText) {
  let seed = 0;
  for (let index = 0; index < seedText.length; index += 1) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0;
  }

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length) % values.length];
}

function shuffle(rng, values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function makeQuestion(template, domain, domainLabel, mode, dateSeed, index) {
  const rng = createSeededRng(`${mode}:${dateSeed}:${domain}:${index}`);
  const variantRng = createSeededRng(`${mode}:${dateSeed}:${domain}:${index}:variant`);
  const built = template.build({ rng, variantRng });

  const correctText = built.options[built.correct_answer];
  const optionEntries = Object.entries(built.options).map(([label, text]) => ({ label, text }));
  const shuffled = shuffle(rng, optionEntries);
  const relocatedCorrect = shuffled.find((entry) => entry.text === correctText);

  if (!relocatedCorrect) {
    throw new Error(`Could not place correct answer for domain ${domain}, question ${index}`);
  }

  const remappedOptions = Object.fromEntries(shuffled.map((entry) => [entry.label, entry.text]));
  const remappedDistractors = {};
  for (const [label, explanation] of Object.entries(built.distractor_explanations)) {
    const sourceText = built.options[label];
    const target = shuffled.find((entry) => entry.text === sourceText);
    if (target) {
      remappedDistractors[target.label] = explanation;
    }
  }

  return validateQuestion(
    {
      domain,
      domain_label: domainLabel,
      subdomain: template.subdomain,
      question: built.question({ rng, variantRng }),
      options: remappedOptions,
      correct_answer: relocatedCorrect.label,
      correct_explanation: built.correct_explanation({ rng, variantRng }),
      distractor_explanations: remappedDistractors,
      citations: template.citations,
      difficulty_seed: pick(rng, ['standard', 'standard', 'standard', 'challenging', 'challenging', 'advanced']),
    },
    index,
  );
}

function validateQuestion(q, index) {
  const required = ['domain', 'domain_label', 'subdomain', 'question', 'options', 'correct_answer', 'correct_explanation', 'distractor_explanations', 'citations', 'difficulty_seed'];
  for (const field of required) {
    if (q[field] === undefined || q[field] === null) {
      throw new Error(`Question ${index}: missing field "${field}"`);
    }
  }

  const optionKeys = Object.keys(q.options);
  if (!['A', 'B', 'C', 'D', 'E'].every((key) => optionKeys.includes(key))) {
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

  for (const citation of q.citations) {
    if (!SOURCE_CITATIONS.has(citation)) {
      throw new Error(`Question ${index}: unknown citation "${citation}". Add it to scripts/source-bank.json first.`);
    }
  }

  q.difficulty_score = null;
  q.flagged = false;
  return q;
}

function template(subdomain, citations, question, answer, distractors, explanation, distractorExplanations) {
  return {
    subdomain,
    citations,
    build: ({ rng, variantRng }) => ({
      question,
      options: {
        A: answer({ rng, variantRng }),
        B: distractors[0]({ rng, variantRng }),
        C: distractors[1]({ rng, variantRng }),
        D: distractors[2]({ rng, variantRng }),
        E: distractors[3]({ rng, variantRng }),
      },
      correct_answer: 'A',
      correct_explanation: explanation,
      distractor_explanations: {
        B: distractorExplanations[0],
        C: distractorExplanations[1],
        D: distractorExplanations[2],
        E: distractorExplanations[3],
      },
    }),
  };
}

const QUESTION_BANK = {
  1: [
    template(
      'Confidentiality and safety',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 5 — Confidentiality',
        'Privacy Act 1988 (Cth), Australian Privacy Principle 6',
      ],
      ({ rng }) => {
        const setting = pick(rng, ['university clinic', 'community service', 'private practice']);
        const age = pick(rng, ['19-year-old', '24-year-old', '31-year-old']);
        return `In a ${setting}, a ${age} client says they do not want their parent informed about session content. The parent later requests an update because they are paying for treatment. The client has not consented to any disclosure. What should the psychologist do next?`;
      },
      () => 'Decline disclosure, explain confidentiality limits, and seek supervision if needed.',
      [
        () => 'Provide a brief summary because the parent is funding therapy.',
        () => 'Share the notes but leave out the most sensitive details.',
        () => 'Ask the parent to sign a form and then disclose the information.',
        () => 'Give a verbal family update because it is routine practice.',
      ],
      () => 'Funding treatment does not override confidentiality. The safest response is to decline disclosure without consent and clarify the limits of privacy with the client.',
      [
        'Payment for treatment does not create a right to private clinical information.',
        'Partial disclosure is still disclosure if there is no consent or legal basis.',
        'A form signed by the parent alone does not authorise disclosure.',
        'Routine updates still require client consent and attention to privacy limits.',
      ],
    ),
    template(
      'Duty of care and boundaries',
      [
        'APS Code of Ethics (2007, amended 2023), Principle B.1 — Propriety',
        'Psychology Board of Australia Code of Conduct (2020), Section 4 — Providing good care',
      ],
      ({ rng }) => {
        const setting = pick(rng, ['university clinic', 'private practice', 'community health service']);
        return `A provisional psychologist in a ${setting} notices a client has become increasingly hopeless and mentioned giving away possessions. The client ends the session before a formal risk review can be completed. What is the most appropriate next step?`;
      },
      () => 'Initiate urgent follow-up using the clinic risk pathway and supervisor review.',
      [
        () => 'Wait until the next booked session so the client can settle.',
        () => 'Send a text asking the client to confirm they are safe and stop there.',
        () => 'Contact the police immediately without any further assessment.',
        () => 'Document the presentation and assume the client will rebook if needed.',
      ],
      () => 'Hopelessness plus possible preparatory behaviour requires active follow-up. A provisional psychologist should use the risk pathway, seek supervision, and take reasonable steps promptly.',
      [
        'Delaying follow-up may miss a potentially acute risk window.',
        'A text alone is not an adequate risk management response.',
        'Police contact is not the automatic first step unless immediate danger is clearly present.',
        'Documentation is necessary but not a substitute for active risk management.',
      ],
    ),
    template(
      'Telehealth and scope',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 2 — Person-centred practice',
        'AHPRA Guidelines for registered health practitioners (2014)',
      ],
      ({ rng }) => `During a ${pick(rng, ['regional telehealth session', 'after-hours video session', 'remote review'])}, a client says they are alone, distressed, and do not want to continue, but the psychologist cannot confirm their location. What should the psychologist prioritise?`,
      () => 'Pause treatment content, verify location, and follow the telehealth emergency plan.',
      [
        () => 'Continue as normal because the client consented to telehealth.',
        () => 'End the call immediately and wait for the client to reconnect later.',
        () => 'Ask a family member to join without speaking with the client first.',
        () => 'Switch to text messaging only and keep the session informal.',
      ],
      () => 'Telehealth requires an emergency plan and active location verification when risk emerges. Safety, not continuation of content, is the priority.',
      [
        'Telehealth consent does not remove the duty to manage emerging risk.',
        'Ending without a plan may leave the client unsupported.',
        'Bringing others in without consent can damage trust unless there is urgent necessity.',
        'Text-only communication is not an appropriate risk-management substitute.',
      ],
    ),
    template(
      'Record keeping and supervision',
      [
        'APS Code of Ethics (2007, amended 2023), Principle C.1 — Integrity',
        'Psychology Board of Australia Code of Conduct (2020), Section 6 — Clinical records',
      ],
      () => 'A provisional psychologist realises they forgot to update the file after a complex session involving a boundary concern and a treatment change. Their supervisor is off-site and the client is not due back for two weeks. What is the best action?',
      () => 'Complete an accurate contemporaneous note and flag the issue for supervision.',
      [
        () => 'Leave the note out because the client will not remember the details anyway.',
        () => 'Write a vague note later so the boundary issue is less obvious.',
        () => 'Delete the session plan so the record looks cleaner.',
        () => 'Wait until the next supervision meeting before updating the record.',
      ],
      () => 'Record keeping should be accurate and timely, especially when the session involved a clinical change or boundary issue.',
      [
        'Omitting relevant information weakens continuity of care and accountability.',
        'Vagueness can be misleading and does not meet documentation standards.',
        'Deleting records is inappropriate and compromises integrity.',
        'Delaying updates risks loss of detail and weakens the clinical record.',
      ],
    ),
  ],
  2: [
    template(
      'Suicide risk assessment',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 4 — Providing good care',
        'AHPRA Guidelines for registered health practitioners (2014)',
      ],
      () => 'A 27-year-old client describes poor sleep, low mood, and says they feel like a burden. They deny a current plan but admit having thought about not waking up. Which assessment action is most appropriate next?',
      () => 'Conduct a structured suicide risk assessment including intent, means, and protective factors.',
      [
        () => 'Document the symptoms and schedule the next routine appointment.',
        () => 'Focus only on depression severity and avoid asking more about suicide.',
        () => 'Refer the client elsewhere without discussing risk in the current session.',
        () => 'Tell the client to contact emergency services if their thoughts worsen and end the session.',
      ],
      () => 'Suicidal ideation requires a structured risk assessment, even when there is no current plan.',
      [
        'Routine scheduling without risk assessment is insufficient.',
        'Avoiding direct suicide questions can miss important risk details.',
        'Referral alone does not discharge the current duty of care.',
        'Advice may be part of management, but it is not a substitute for assessment.',
      ],
    ),
    template(
      'Collateral and test interpretation',
      [
        'APS Code of Ethics (2007, amended 2023), Principle A.4 — Justice',
        'Psychology Board of Australia Code of Conduct (2020), Section 6 — Clinical records',
      ],
      () => 'A 15-year-old is referred for learning and attention concerns. The parent says the school is exaggerating the issue, while the teacher reports significant behaviour problems and missed assignments. What should guide the assessment plan?',
      () => 'Gather collateral information from multiple sources and interpret results in context.',
      [
        () => 'Rely on the parent report because they are the legal guardian.',
        () => 'Use only a self-report symptom checklist to avoid bias from the school.',
        () => 'Delay testing until all informants agree on the reason for referral.',
        () => 'Conclude it is behavioural rather than cognitive based on the school report alone.',
      ],
      () => 'A balanced assessment should integrate multiple sources because single-informant data can be biased or incomplete.',
      [
        'Legal guardianship does not make one informant sufficient for a fair assessment.',
        'A single self-report tool is not enough for a complex developmental concern.',
        'Perfect agreement is not required before proceeding with assessment.',
        'A school report alone is not sufficient to conclude the underlying cause.',
      ],
    ),
    template(
      'Risk and urgency',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 4 — Providing good care',
        'Health Practitioner Regulation National Law, Section 140 — Mandatory notifications',
      ],
      () => 'A client reports that they have a firearm at home, have been drinking heavily, and are angry after a relationship breakup. They say they are "not sure what I might do tonight". What is the priority?',
      () => 'Conduct immediate high-risk management, including emergency escalation and supervision.',
      [
        () => 'Take a note and reassess at the next session if the client survives the night.',
        () => 'Assume the client is only venting because they have not named a specific target.',
        () => 'End the session once the client says they do not want hospitalisation.',
        () => 'Focus on substance use first and ignore the weapon access until later.',
      ],
      () => 'Access to means, intoxication, and uncertainty about imminent behaviour converge to create an acute high-risk presentation.',
      [
        'Delaying action is unsafe when the risk is immediate.',
        'The absence of a named target does not reduce the seriousness of the threat.',
        'Client refusal does not remove the clinician\'s duty to respond to imminent risk.',
        'Substance use may be relevant, but it is not the immediate priority in this scenario.',
      ],
    ),
    template(
      'Assessment fairness',
      [
        'APS Code of Ethics (2007, amended 2023), Principle A.3 — Informed consent',
        'APS Guidelines for working with people who have intellectual disabilities',
      ],
      () => 'A recently arrived refugee client has limited English and asks whether they can bring an interpreter to a cognitive screening appointment. The psychologist is worried this could affect test validity. What is the best response?',
      () => 'Use a qualified interpreter where needed and choose instruments appropriate to the client\'s language background.',
      [
        () => 'Refuse the interpreter so the test results remain fully standardised.',
        () => 'Proceed in English only because that is how the instrument was normed.',
        () => 'Delay the assessment until the client becomes fluent in English.',
        () => 'Use family members as interpreters to reduce the risk of misunderstanding.',
      ],
      () => 'Assessment should be fair and accessible, which may require an interpreter and cautious test selection.',
      [
        'Excluding interpretation can make the assessment invalid or unfair.',
        'English-only testing may be inappropriate when language barriers are material.',
        'Assessment should not be postponed unnecessarily if suitable adaptations are available.',
        'Family interpreters can compromise accuracy, privacy, and clinical neutrality.',
      ],
    ),
  ],
  3: [
    template(
      'CBT treatment planning',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 4 — Providing good care',
        'Beck et al. (1979), Cognitive Therapy of Depression',
      ],
      () => 'A client with panic symptoms wants a psychologist to "just tell me what to do" and expects reassurance during every anxious spike. Which intervention choice best fits an evidence-based CBT approach?',
      () => 'Use psychoeducation, monitoring, and graduated exposure with collaboratively set goals.',
      [
        () => 'Provide reassurance at every session and avoid homework to keep the client calm.',
        () => 'Focus only on childhood causes before teaching any coping skills.',
        () => 'Tell the client to think positively whenever anxiety appears.',
        () => 'Change the topic whenever the client reports bodily symptoms.',
      ],
      () => 'CBT for panic commonly uses psychoeducation, symptom monitoring, and graded exposure.',
      [
        'Constant reassurance can reinforce avoidance and dependence.',
        'Historical factors can matter, but intervention should still be active and skills-based.',
        'Positive thinking alone is not a full CBT intervention.',
        'Avoiding symptom discussion undermines treatment and learning.',
      ],
    ),
    template(
      'Rupture repair',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 2 — Person-centred practice',
        'APS Code of Ethics (2007, amended 2023), Principle B.1 — Propriety',
      ],
      () => 'A client becomes annoyed after the psychologist gently challenges an avoidance pattern and says the session felt "judgy". The client is otherwise engaged and wants to keep attending. What is the best next step?',
      () => 'Acknowledge the rupture, explore the impact, and repair collaboratively.',
      [
        () => 'Defend the intervention because the psychologist is the expert.',
        () => 'End therapy because the client is being resistant.',
        () => 'Ignore the comment and move straight to the next agenda item.',
        () => 'Apologise only if the client explicitly asks for it.',
      ],
      () => 'Therapeutic rupture repair is part of good care and helps preserve the alliance.',
      [
        'Defensiveness usually worsens the rupture.',
        'A single rupture does not justify dropping a willing client.',
        'Ignoring the issue can leave the alliance damaged.',
        'Repair often needs direct discussion, not just passive apology.',
      ],
    ),
    template(
      'Trauma-informed practice',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 4 — Providing good care',
        'AHPRA Guidelines for registered health practitioners (2014)',
      ],
      () => 'A client with a trauma history freezes and goes silent when asked to describe a recent assault. The psychologist wants a full timeline for treatment planning. What is the best approach?',
      () => 'Slow the pace, stabilise, and use trauma-informed choice and grounding.',
      [
        () => 'Push for details so the client learns not to avoid the memory.',
        () => 'Switch to confrontation because silence is non-compliance.',
        () => 'Terminate the session because the client is not ready for therapy.',
        () => 'Keep asking the same question until the client answers clearly.',
      ],
      () => 'A trauma-informed response prioritises emotional safety, choice, and pacing.',
      [
        'Forcing disclosure can increase distress and reduce safety.',
        'Confrontation is likely to escalate shame or shutdown.',
        'A trauma response does not mean treatment must stop entirely.',
        'Repetition without attunement can intensify freezing and harm rapport.',
      ],
    ),
    template(
      'Group therapy',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 7 — Collaboration and teamwork',
        'APS Code of Ethics (2007, amended 2023), Principle A.1 — General Respect',
      ],
      () => 'A provisional psychologist is co-facilitating a skills group. One participant starts giving detailed advice about another participant\'s personal situation. What is the best facilitator response?',
      () => 'Redirect to group rules, protect boundaries, and reinforce respectful participation.',
      [
        () => 'Allow the discussion because peer support is always therapeutic.',
        () => 'Ask the participant to leave without any explanation.',
        () => 'Share the other participant\'s notes so the group can understand the context.',
        () => 'Ignore it because the group will self-correct over time.',
      ],
      () => 'Facilitators should maintain a safe and respectful group frame and reinforce boundaries.',
      [
        'Peer support is useful, but uncontained advice can become harmful.',
        'Removal may be disproportionate unless the disruption is serious and repeated.',
        'Sharing another member\'s notes breaches privacy and trust.',
        'Ignoring boundary issues can destabilise the group.',
      ],
    ),
  ],
  4: [
    template(
      'Report writing',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 6 — Clinical records',
        'AHPRA Guidelines for registered health practitioners (2014)',
      ],
      () => 'A provisional psychologist is drafting a report for a referrer. The client asked that a sensitive family issue not be mentioned, but it is relevant to the referral question. What is the most appropriate approach?',
      () => 'Include only what is necessary, within the consent limits discussed with the client.',
      [
        () => 'Include everything in full detail because the referrer paid for the report.',
        () => 'Omit the issue entirely so the client feels protected.',
        () => 'Use vague language that hides the key information.',
        () => 'Send the raw notes instead of a formal report.',
      ],
      () => 'Reports should be relevant, proportionate, and consistent with consent and confidentiality limits.',
      [
        'Reports should not include unnecessary sensitive detail.',
        'Omitting relevant material can make the report misleading.',
        'Vagueness can reduce clinical usefulness and accuracy.',
        'Raw notes are not a substitute for a considered report.',
      ],
    ),
    template(
      'Communicating with carers',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 5 — Confidentiality',
        'Privacy Act 1988 (Cth), Australian Privacy Principle 6',
      ],
      () => 'A client\'s partner rings the clinic asking for an update because they are worried about recent mood changes. The client has not consented to sharing information with the partner. What should the psychologist do?',
      () => 'Do not disclose client information and explain the confidentiality process.',
      [
        () => 'Give a general update because family concern is important.',
        () => 'Confirm whether the partner is telling the truth before deciding.',
        () => 'Leave a voicemail with broad details so the partner feels reassured.',
        () => 'Share the client\'s diagnosis but not the treatment plan.',
      ],
      () => 'Without consent or a lawful exception, information should not be disclosed to a partner.',
      [
        'Concern from a family member does not override privacy obligations.',
        'Verifying the caller does not create permission to disclose.',
        'Voicemail disclosure can still breach confidentiality.',
        'Partial disclosure is still disclosure and needs a lawful basis.',
      ],
    ),
    template(
      'Interpreter-assisted communication',
      [
        'APS Code of Ethics (2007, amended 2023), Principle A.2 — Propriety',
        'AHPRA Guidelines for registered health practitioners (2014)',
      ],
      () => 'A psychologist is explaining assessment results to a client who prefers to speak through an interpreter. The client is visibly uncomfortable when family members offer to translate instead. What is the best choice?',
      () => 'Use a qualified interpreter and maintain the client\'s privacy and control.',
      [
        () => 'Use the family members because they know the client best.',
        () => 'Skip the interpreter and speak more slowly in English.',
        () => 'Give the client a written summary only and end the session early.',
        () => 'Ask the family to leave the room and proceed without communication support.',
      ],
      () => 'Interpreter-assisted communication should prioritise accuracy, confidentiality, and client autonomy.',
      [
        'Family translators can compromise privacy and accuracy.',
        'Slowing down English does not solve the language barrier.',
        'Written summaries alone may not be enough for nuanced feedback.',
        'Removing support without replacing it can leave the client unable to engage.',
      ],
    ),
    template(
      'Court and medicolegal communication',
      [
        'Psychology Board of Australia Code of Conduct (2020), Section 8 — Conflicts, financial and other business dealings',
        'APS Code of Ethics (2007, amended 2023), Principle C.1 — Integrity',
      ],
      () => 'A psychologist receives a subpoena for records and is unsure whether they can refuse because the notes contain sensitive third-party information. What is the most appropriate first step?',
      () => 'Seek legal/supervisory advice and review what must be disclosed under the order.',
      [
        () => 'Ignore the subpoena unless the client asks about it.',
        () => 'Destroy the notes before the hearing date.',
        () => 'Release everything immediately without checking the scope.',
        () => 'Refuse to comply because third-party material is always protected.',
      ],
      () => 'A subpoena requires careful review of scope and legal obligations.',
      [
        'Ignoring a subpoena can create legal risk.',
        'Destroying records is inappropriate and potentially unlawful.',
        'Disclosure should be limited to the scope of the order and lawful exceptions.',
        'Third-party material may need careful handling, but it does not automatically nullify the subpoena.',
      ],
    ),
  ],
};

async function createQuizRecord(setId, mode, generatedAt) {
  const title = mode === 'daily' ? `Daily NPE Set ${generatedAt}` : `Fortnightly NPE Exam ${generatedAt}`;
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .insert({
      title,
      delivery_mode: mode,
      category: 'Exam Prep',
      domain: 'Mixed',
      description: `Auto-generated ${mode} NPE set created from ${setId}`,
      created_by: null,
      author_name: 'NPE Quiz Bot',
      is_curated: true,
      published_at: generatedAt,
    })
    .select('id')
    .single();

  if (error || !quiz) {
    throw new Error(`Quiz insert failed: ${error?.message || 'unknown error'}`);
  }

  return quiz.id;
}

async function ensureSupabaseSchemaReady() {
  if (!supabase) {
    return;
  }

  const requiredTables = ['quizzes', 'quiz_questions'];

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('id').limit(1);

    if (!error) {
      continue;
    }

    const message = (error.message || '').toLowerCase();
    const tableMissing =
      message.includes(`could not find the table 'public.${table}'`) ||
      message.includes(`relation \"public.${table}\" does not exist`) ||
      message.includes('schema cache');

    if (tableMissing) {
      throw new Error(
        [
          `Supabase table missing: public.${table}.`,
          'The generator is connected to a project that does not have the NPE schema yet, or the URL/key points at the wrong project.',
          'Apply migrations in order from npe-web/supabase/001_npe_schema.sql through npe-web/supabase/007_noticeboard_publish_windows.sql,',
          'then verify NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in GitHub Secrets target that same project.',
        ].join(' '),
      );
    }

    throw new Error(`Supabase schema check failed for public.${table}: ${error.message}`);
  }
}

function toLegacyQuestionRow(question, quizId, displayOrder) {
  const optionLabels = ['A', 'B', 'C', 'D', 'E'];
  const options = optionLabels.map((label) => ({
    label,
    text: String(question.options?.[label] || '').trim(),
  }));
  const correctIndex = optionLabels.indexOf(question.correct_answer);

  if (correctIndex < 0) {
    throw new Error(`Question has invalid correct_answer value: ${question.correct_answer}`);
  }

  return {
    quiz_id: quizId,
    question_text: String(question.question || '').trim(),
    options,
    correct_index: correctIndex,
    explanation: String(question.correct_explanation || '').trim(),
    display_order: displayOrder,
  };
}

async function generateForDomain(domainSpec, mode, offset, dateSeed) {
  const bank = QUESTION_BANK[domainSpec.domain];
  if (!bank || !bank.length) {
    throw new Error(`No question bank configured for Domain ${domainSpec.domain}`);
  }

  const questions = [];
  for (let index = 0; index < domainSpec.count; index += 1) {
    const template = bank[(offset + index) % bank.length];
    console.log(`Generating question ${index + 1}/${domainSpec.count} for Domain ${domainSpec.domain}: ${domainSpec.domain_label}...`);
    questions.push(makeQuestion(template, domainSpec.domain, domainSpec.domain_label, mode, dateSeed, offset + index));
  }

  return questions;
}

async function insertToSupabase(questions, setId, mode, generatedAt) {
  console.log(`Inserting ${questions.length} questions into Supabase...`);
  await ensureSupabaseSchemaReady();
  const quizId = await createQuizRecord(setId, mode, generatedAt);
  const rows = questions.map((question, index) => toLegacyQuestionRow(question, quizId, index + 1));
  const { error } = await supabase.from('quiz_questions').insert(rows);

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }

  console.log(`Inserted ${rows.length} questions successfully.`);
}

async function main() {
  console.log(`\nNPE Question Generator`);
  console.log(`Mode: ${MODE}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const distribution = DOMAIN_DISTRIBUTION[MODE];
  if (!distribution) {
    throw new Error(`Unknown mode: ${MODE}`);
  }

  const dateSeed = getAestDateSeed();
  const generatedAt = new Date().toISOString();
  const setId = `${MODE}-${dateSeed}`;

  const allQuestions = [];
  let offset = 0;
  for (const domainSpec of distribution) {
    const questions = await generateForDomain(domainSpec, MODE, offset, dateSeed);
    allQuestions.push(...questions);
    offset += domainSpec.count;
  }

  console.log(`\nGenerated ${allQuestions.length} questions total.`);

  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  }

  const outputPath = path.join(STAGING_DIR, `${setId}.json`);
  const payload = {
    set_id: setId,
    mode: MODE,
    generated_at: generatedAt,
    question_count: allQuestions.length,
    questions: allQuestions,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Seed file written: ${outputPath}`);

  if (DRY_RUN) {
    console.log('\nDry run complete — Supabase insert skipped.');
    return;
  }

  if (!supabase) {
    throw new Error('Supabase client not configured.');
  }

  await insertToSupabase(allQuestions, setId, MODE, generatedAt);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});