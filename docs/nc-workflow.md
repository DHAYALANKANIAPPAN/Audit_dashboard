# AuditPulse 360 - NC Workflow Lifecycle

```
[ Inspection Failed Item ]
           │
           ▼
        [ OPEN ]  (Auto-ticket generated for Auditee with targetDate)
           │
           │ Auditee starts working on resolution
           ▼
     [ IN_PROGRESS ]
           │
           │ Auditee submits CAPA (5-Why/8D + corrective + evidence)
           ▼
      [ SUBMITTED ]
           │
           ├── Auditor reviews evidence & verification on-site
           ├────── REJECT ───► [ IN_PROGRESS ] (with remark)
           ▼ ACCEPT
      [ VERIFIED ]
           │
           ├── Auditing Head final review
           ├────── REJECT ───► [ IN_PROGRESS ] (with remark)
           ▼ ACCEPT
       [ CLOSED ]  (Closed timestamp recorded, MTTC computed)
```

### Overdue Calculation Rule
"Overdue" is **NOT** a status stored in the database.
It is dynamically evaluated:
`isOverdue = status !== 'CLOSED' && targetDate < currentDate`
