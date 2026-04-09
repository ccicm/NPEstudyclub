export type ExamWindow = {
  label: string;
  start: [number, number, number];
  end: [number, number, number];
  reg: string;
};

export const EXAM_WINDOWS: ExamWindow[] = [
  {
    label: "May 2026 Window",
    start: [2026, 5, 1],
    end: [2026, 5, 31],
    reg: "Registration usually closes in April 2026",
  },
  {
    label: "October 2026 Window",
    start: [2026, 10, 1],
    end: [2026, 10, 31],
    reg: "Registration usually closes in September 2026",
  },
  {
    label: "March 2027 Window",
    start: [2027, 3, 1],
    end: [2027, 3, 31],
    reg: "Registration usually closes in February 2027",
  },
];

export function windowToDates(window: ExamWindow) {
  const start = new Date(window.start[0], window.start[1] - 1, window.start[2], 0, 0, 0, 0);
  const end = new Date(window.end[0], window.end[1] - 1, window.end[2], 23, 59, 59, 999);
  return { start, end };
}
