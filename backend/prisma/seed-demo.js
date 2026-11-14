const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive demo seed for analytics and dashboard...');

  // Ensure base users, departments, lines and checklists exist
  let [users, departments, lines, checklistItems] = await Promise.all([
    prisma.user.findMany(),
    prisma.department.findMany(),
    prisma.line.findMany(),
    prisma.checklistItem.findMany(),
  ]);

  if (users.length === 0 || lines.length === 0 || checklistItems.length === 0) {
    console.log('⚠️ Base seed missing. Running initial seed...');
    const seedScript = require('./seed');
    // base seed runs
  }

  // Refetch
  [users, departments, lines, checklistItems] = await Promise.all([
    prisma.user.findMany(),
    prisma.department.findMany(),
    prisma.line.findMany({ include: { owner: true } }),
    prisma.checklistItem.findMany(),
  ]);

  const auditor = users.find((u) => u.role === 'AUDITOR') || users[0];
  const auditHead = users.find((u) => u.role === 'AUDIT_HEAD') || users[0];
  const auditees = users.filter((u) => u.role === 'AUDITEE');
  const defaultAuditee = auditees[0] || users[0];

  // Clean old demo schedules, inspections, ncs, capas, approvals
  console.log('🧹 Clearing old demo schedules and NC records...');
  await prisma.approval.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.capa.deleteMany();
  await prisma.nC.deleteMany();
  await prisma.inspectionItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.auditPlan.deleteMany();

  const now = new Date();

  // Helper date generators
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
  const daysAhead = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  console.log('📅 Generating 42 planned audits and schedules (mix of DONE, PLANNED, MISSED)...');

  const products = [
    'Model-X Subframe Assembly',
    'EV Inverter Power Unit',
    'Body Door Latches & Weatherstrips',
    'Front Suspension Knuckle',
    'High Voltage Battery Module',
    'Drive Motor Rotor & Stator',
    'Brake Caliper Sub-assembly',
    'Dashboard Harness Fitment',
  ];

  const shifts = ['A', 'B', 'C'];
  const auditTypes = ['PRODUCT', 'REVALIDATION'];

  const allSchedules = [];
  let ncCounter = 1;
  const createdNcs = [];

  // Generate 42 audit plans and schedules spread over past 45 days and next 15 days
  for (let i = 0; i < 42; i++) {
    const isPast = i < 32;
    const isMissed = isPast && (i === 5 || i === 14 || i === 22);
    const isDone = isPast && !isMissed;
    const isPlanned = !isPast;

    const offset = isPast ? Math.floor(i * 1.3) + 1 : -Math.floor((i - 31) * 1.5) - 1;
    const auditDate = isPast ? daysAgo(offset) : daysAhead(-offset);

    const monthStr = `${auditDate.getFullYear()}-${String(auditDate.getMonth() + 1).padStart(2, '0')}`;
    const line = lines[i % lines.length];
    const dept = departments[i % departments.length];
    const product = products[i % products.length];
    const shift = shifts[i % shifts.length];
    const auditType = auditTypes[i % auditTypes.length];

    const plan = await prisma.auditPlan.create({
      data: {
        month: monthStr,
        auditType,
        lineId: line.id,
        departmentId: dept.id,
        product,
        plannedDate: auditDate,
        shift,
      },
    });

    const status = isDone ? 'DONE' : isMissed ? 'MISSED' : 'PLANNED';

    const schedule = await prisma.schedule.create({
      data: {
        planId: plan.id,
        auditorId: auditor.id,
        date: auditDate,
        shift,
        status,
      },
    });

    allSchedules.push(schedule);

    // If schedule is DONE, create an Inspection with items
    if (isDone) {
      const inspection = await prisma.inspection.create({
        data: {
          scheduleId: schedule.id,
          submittedAt: auditDate,
        },
      });

      // Filter relevant checklist items
      const relevantItems = checklistItems.filter((c) => c.auditType === auditType);
      const itemsToUse = relevantItems.length > 0 ? relevantItems : checklistItems;

      // Have 1 in every 2 completed inspections raise a defect
      const hasDefect = (i % 2 === 0);

      for (let j = 0; j < Math.min(itemsToUse.length, 6); j++) {
        const cItem = itemsToUse[j];
        const isFail = hasDefect && (j === 1 || (i % 4 === 0 && j === 3));

        const result = isFail ? 'FAIL' : 'PASS';
        const severity = isFail ? (j === 1 ? 'CRITICAL' : 'MAJOR') : null;
        const remark = isFail ? `Non-conformance observed in ${cItem.section}: specification out of tolerance.` : null;

        const inspItem = await prisma.inspectionItem.create({
          data: {
            inspectionId: inspection.id,
            checklistItemId: cItem.id,
            result,
            severity,
            remark,
          },
        });

        // Auto-create NC ticket for failed items
        if (isFail && ncCounter <= 26) {
          const ncNumStr = `NC-2026-${String(ncCounter).padStart(4, '0')}`;
          ncCounter++;

          // Determine target date (SLAs: CRITICAL 3d, MAJOR 7d, MINOR 14d)
          const slaDays = severity === 'CRITICAL' ? 3 : 7;
          const ncCreatedAt = new Date(auditDate);
          const targetDate = new Date(ncCreatedAt.getTime() + slaDays * 24 * 60 * 60 * 1000);

          // Status progression based on counter
          // 1-10: CLOSED (some on-time, some late)
          // 11-14: OVERDUE (past target date, not closed)
          // 15-18: SUBMITTED (with CAPA, pending auditor verification)
          // 19-21: VERIFIED (auditor verified, pending Head sign-off)
          // 22-26: OPEN or IN_PROGRESS (recently created)
          let ncStatus = 'OPEN';
          let closedAt = null;

          if (ncCounter <= 10) {
            ncStatus = 'CLOSED';
            // On-time vs late
            if (ncCounter % 3 === 0) {
              // Closed late (2 days after target)
              closedAt = new Date(targetDate.getTime() + 2 * 24 * 60 * 60 * 1000);
            } else {
              // Closed on time (1 day before target)
              closedAt = new Date(targetDate.getTime() - 1 * 24 * 60 * 60 * 1000);
            }
          } else if (ncCounter <= 14) {
            // Overdue
            ncStatus = ncCounter % 2 === 0 ? 'OPEN' : 'IN_PROGRESS';
          } else if (ncCounter <= 18) {
            ncStatus = 'SUBMITTED';
          } else if (ncCounter <= 21) {
            ncStatus = 'VERIFIED';
          } else {
            ncStatus = 'IN_PROGRESS';
          }

          const lineAuditee = line.owner || defaultAuditee;

          const nc = await prisma.nC.create({
            data: {
              ncNo: ncNumStr,
              inspectionId: inspection.id,
              checklistItemId: cItem.id,
              lineId: line.id,
              severity,
              auditeeId: lineAuditee.id,
              status: ncStatus,
              targetDate,
              createdAt: ncCreatedAt,
              closedAt,
              escalatedAt: (ncStatus !== 'CLOSED' && targetDate < now) ? new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) : null,
            },
          });

          createdNcs.push(nc);

          // Create CAPA for SUBMITTED, VERIFIED, or CLOSED NCs
          if (['SUBMITTED', 'VERIFIED', 'CLOSED'].includes(ncStatus)) {
            const capa = await prisma.capa.create({
              data: {
                ncId: nc.id,
                rootCauseMethod: 'FIVE_WHY',
                rootCause: JSON.stringify([
                  'Fastener torque below required 45Nm threshold',
                  'Pneumatic torque wrench calibration drifted',
                  'Weekly calibration check was missed on Shift B',
                  'Calibration log sheet was misplaced during station reorganization',
                  'No digital preventive maintenance alert configured for tooling calibration',
                ]),
                corrective: 'Re-calibrated all 4 pneumatic torque wrenches at Station 3 and re-torqued affected batch.',
                preventive: 'Configured automated digital maintenance reminder and locked station tooling if calibration exceeds 7 days.',
                ownerId: lineAuditee.id,
                targetDate: new Date(ncCreatedAt.getTime() + 5 * 24 * 60 * 60 * 1000),
                submittedAt: new Date(ncCreatedAt.getTime() + 2 * 24 * 60 * 60 * 1000),
              },
            });

            // If VERIFIED or CLOSED, add Auditor Verification Approval
            if (['VERIFIED', 'CLOSED'].includes(ncStatus)) {
              await prisma.approval.create({
                data: {
                  ncId: nc.id,
                  stage: 'AUDITOR_VERIFY',
                  decision: 'ACCEPT',
                  remark: 'Verified on-site: Calibration certificate #QC-2026-881 checked. Torque values confirmed within ±1.5%.',
                  byUserId: auditor.id,
                  createdAt: new Date(ncCreatedAt.getTime() + 3 * 24 * 60 * 60 * 1000),
                },
              });
            }

            // If CLOSED, add Auditing Head Final Approval
            if (ncStatus === 'CLOSED') {
              await prisma.approval.create({
                data: {
                  ncId: nc.id,
                  stage: 'HEAD_SIGNOFF',
                  decision: 'ACCEPT',
                  remark: 'Digital control verified. CAPA effectiveness confirmed. Final closure approved.',
                  byUserId: auditHead.id,
                  createdAt: closedAt || new Date(),
                },
              });
            }
          }
        }
      }
    }
  }

  console.log(`✅ Demo Seed Completed!`);
  console.log(` - Total Schedules created: ${allSchedules.length}`);
  console.log(` - Completed (DONE) Audits: ${allSchedules.filter((s) => s.status === 'DONE').length}`);
  console.log(` - Planned Audits: ${allSchedules.filter((s) => s.status === 'PLANNED').length}`);
  console.log(` - Missed Audits: ${allSchedules.filter((s) => s.status === 'MISSED').length}`);
  console.log(` - Total NC Tickets raised: ${createdNcs.length}`);
  console.log(` - Closed NCs: ${createdNcs.filter((n) => n.status === 'CLOSED').length}`);
  console.log(` - Open / In-Progress NCs: ${createdNcs.filter((n) => ['OPEN', 'IN_PROGRESS'].includes(n.status)).length}`);
  console.log(` - Submitted CAPAs: ${createdNcs.filter((n) => n.status === 'SUBMITTED').length}`);
  console.log(` - Verified NCs awaiting Head: ${createdNcs.filter((n) => n.status === 'VERIFIED').length}`);
  console.log(` - Overdue NCs: ${createdNcs.filter((n) => n.status !== 'CLOSED' && n.targetDate < now).length}`);
}

main()
  .catch((e) => {
    console.error('❌ Demo seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
