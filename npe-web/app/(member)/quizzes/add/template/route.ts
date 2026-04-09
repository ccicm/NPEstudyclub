import { NextResponse } from "next/server";

const QUIZ_TEMPLATE = [
  "question_text,option_a,option_b,option_c,option_d,correct_label,explanation",
  '"Which test is best for screening depression?","PHQ-9","MMPI-2","WAIS-IV","DASS-42","A","PHQ-9 is a common brief screening tool."',
  '"What does CBT stand for?","Cognitive Behavioral Therapy","Clinical Brain Training","Core Behavior Tracking","Controlled Baseline Therapy","A","CBT stands for Cognitive Behavioral Therapy."',
  '"Which design supports causal inference best?","Randomized controlled trial","Case study","Cross-sectional survey","Narrative review","A","RCTs are strongest for causal inference."',
  '"Primary purpose of informed consent?","Support autonomy and informed decision-making","Increase response rates","Reduce paperwork","Avoid supervision","A","It ensures clients understand treatment and consent freely."',
].join("\n");

export async function GET() {
  return new NextResponse(QUIZ_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="quiz-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
