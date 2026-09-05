PER-SUBJECT PROGRESS & TIMELINE — INSTALL

Replace:
  src/hooks/useStudentActivity.js
  src/pages/StudentActivityModal.jsx
  src/pages/StudentActivityModal.css
  src/pages/ActivityTracker.jsx

Keep / make sure these exist:
  src/pages/SubjectActivityManager.jsx
  src/pages/SubjectActivityManager.css

Database:
  Run subject_activity_migration.sql first if you have not already.

Behavior:
- 1 assigned subject:
    Progress & Timeline opens directly on that subject.
    No unnecessary subject dropdown.
- 2+ assigned subjects:
    Subject selector appears.
    Each subject has its own progress percentage and completed/total count.
    Switching subject recalculates:
      timeline
      current week
      current activity
      completion percentage
      weekly checklist
      notes count
- Main ActivityTracker Subject column uses normalized student_subjects/subjects data.
- Existing unassigned legacy activities:
    * If student has exactly one subject, they temporarily count under that subject.
    * If student has multiple subjects, they appear as Legacy / Unassigned until moved.
