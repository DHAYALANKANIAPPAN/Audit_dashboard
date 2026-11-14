# AuditPulse 360 Common UI Components

Reusable, accessible, mobile-first shop-floor components designed for tablets and mobile PWAs.

---

## 1. Button

Touch-friendly with a minimum 48px height, built-in loading spinner, and active scale animations.

```jsx
import { Button } from '@/components/common';
import { Send, Check } from 'lucide-react';

// Primary
<Button variant="primary" size="md" onClick={handleClick}>
  Submit Inspection
</Button>

// Success with Icon
<Button variant="success" size="lg" icon={<Check className="w-5 h-5" />}>
  Pass All Items
</Button>

// Danger
<Button variant="danger" size="md">
  Reject CAPA
</Button>

// Outline & Secondary
<Button variant="outline" size="sm">Back</Button>
<Button variant="secondary" size="md">Cancel</Button>

// Loading State (auto disables and shows spinner)
<Button variant="primary" loading={isSubmitting}>
  Submitting...
</Button>
```

---

## 2. Badge

Status, shift, and severity tags.

```jsx
import { Badge } from '@/components/common';

<Badge variant="success">PASS</Badge>
<Badge variant="danger">CRITICAL</Badge>
<Badge variant="warning">MAJOR</Badge>
<Badge variant="info">REVALIDATION</Badge>
<Badge variant="default">Shift A</Badge>
```

---

## 3. Toast (`useToast` Hook)

Global toast notifications wrapped at the root layout with auto-dismiss (3.5s) and `aria-live` accessibility.

```jsx
'use client';
import { useToast } from '@/components/common';

export default function MyComponent() {
  const { success, error, warning, info } = useToast();

  const handleSave = () => {
    try {
      // do action...
      success('Audit plan saved successfully!');
    } catch (err) {
      error('Failed to save plan: ' + err.message);
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

---

## 4. Spinner

Accessible loading spinner with customizable labels.

```jsx
import { Spinner } from '@/components/common';

// Small inline spinner
<Spinner size="sm" />

// Medium spinner with accessible status label
<Spinner size="md" label="Loading roster..." />

// Large centered full-page spinner
<div className="flex h-screen items-center justify-center">
  <Spinner size="lg" label="Syncing with database..." />
</div>
```
