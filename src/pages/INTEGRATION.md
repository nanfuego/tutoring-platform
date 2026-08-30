# Student Activity Modal — Integration

This change makes the Activity button on StudentDetail open the selected
student's checklist in a modal instead of navigating to `/admin/activity`.

## 1. Add the two files

Copy:

- `StudentActivityModal.jsx` → `src/pages/StudentActivityModal.jsx`
- `StudentActivityModal.css` → `src/pages/StudentActivityModal.css`

## 2. Update `src/pages/StudentDetail.jsx`

Add this import with the existing imports:

```jsx
import StudentActivityModal from './StudentActivityModal'
```

Add this state near the other `useState` calls:

```jsx
const [showActivityModal, setShowActivityModal] = useState(false)
```

## 3. Change the existing Activity button

If the current button is a Link such as:

```jsx
<Link to="/admin/activity" className="...">
  Activity
</Link>
```

replace it with:

```jsx
<button
  type="button"
  className="..."
  onClick={() => setShowActivityModal(true)}
>
  Activity
</button>
```

Keep the existing className if you want the exact current button styling.

If the current code uses:

```jsx
onClick={() => navigate('/admin/activity')}
```

replace that handler with:

```jsx
onClick={() => setShowActivityModal(true)}
```

Do NOT navigate to `/admin/activity` from the StudentDetail Activity button anymore.

## 4. Render the modal

Near the bottom of the `return`, just before the closing `</div>` for
`.detail-page`, add:

```jsx
{showActivityModal && (
  <StudentActivityModal
    student={student}
    onClose={() => setShowActivityModal(false)}
  />
)}
```

## Result

Student Detail
    |
    +-- Activity button
            |
            v
      ┌───────────────────────────────┐
      │  ACTIVITY CHECKLIST            │
      │  Student Name                  │
      │  Progress 38%                  │
      │  ───────────────────────────   │
      │  Week 1                        │
      │  ☑ Requirement                 │
      │  ☐ Requirement     Note...     │
      │  ☐ Requirement     Note...     │
      │                               │
      │                    [ Done ]    │
      └───────────────────────────────┘

The student remains on the Student Detail page behind the modal.

The modal reads/writes the existing:
- `activity_requirements`
- `student_activity`

tables, so the checklist data remains shared with the existing Activity
Tracker rather than creating a second activity system.
