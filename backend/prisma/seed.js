const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Clean existing records in reverse dependency order
  await prisma.approval.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.capa.deleteMany();
  await prisma.nC.deleteMany();
  await prisma.inspectionItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.auditPlan.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.line.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const passwordHash = await bcrypt.hash('demo123', 10);

  // 2. Create Departments
  const deptMfg = await prisma.department.create({
    data: { name: 'Manufacturing', code: 'MFG' },
  });
  const deptQA = await prisma.department.create({
    data: { name: 'Quality Assurance', code: 'QA' },
  });
  const deptEng = await prisma.department.create({
    data: { name: 'Engineering', code: 'ENG' },
  });

  // 3. Create Users (one per role + extra auditees for 3 lines)
  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@auditpulse.local',
      passwordHash,
      name: 'Bhava (Lead Auditor)',
      role: 'AUDITOR',
      departmentId: deptQA.id,
    },
  });

  const auditee1 = await prisma.user.create({
    data: {
      email: 'auditee@auditpulse.local',
      passwordHash,
      name: 'Ramesh (Line 1 Owner)',
      role: 'AUDITEE',
      departmentId: deptMfg.id,
    },
  });

  const auditee2 = await prisma.user.create({
    data: {
      email: 'auditee2@auditpulse.local',
      passwordHash,
      name: 'Suresh (Line 2 Owner)',
      role: 'AUDITEE',
      departmentId: deptMfg.id,
    },
  });

  const auditee3 = await prisma.user.create({
    data: {
      email: 'auditee3@auditpulse.local',
      passwordHash,
      name: 'Priya (Line 3 Owner)',
      role: 'AUDITEE',
      departmentId: deptMfg.id,
    },
  });

  const auditHead = await prisma.user.create({
    data: {
      email: 'audithead@auditpulse.local',
      passwordHash,
      name: 'Dr. Linga (Quality Head)',
      role: 'AUDIT_HEAD',
      departmentId: deptQA.id,
    },
  });

  const plantManager = await prisma.user.create({
    data: {
      email: 'plantmanager@auditpulse.local',
      passwordHash,
      name: 'Akshiya (Plant Director)',
      role: 'PLANT_MANAGER',
      departmentId: deptMfg.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@auditpulse.local',
      passwordHash,
      name: 'Dhaya (System Admin)',
      role: 'ADMIN',
      departmentId: deptEng.id,
    },
  });

  // 4. Create 3 Lines, each with an auditee owner
  const line1 = await prisma.line.create({
    data: {
      name: 'Line 1 - Chassis & Frame',
      code: 'L1-CHASSIS',
      departmentId: deptMfg.id,
      ownerId: auditee1.id,
    },
  });

  const line2 = await prisma.line.create({
    data: {
      name: 'Line 2 - Powertrain & EV Drive',
      code: 'L2-POWERTRAIN',
      departmentId: deptMfg.id,
      ownerId: auditee2.id,
    },
  });

  const line3 = await prisma.line.create({
    data: {
      name: 'Line 3 - Final Assembly & Fitment',
      code: 'L3-FINAL',
      departmentId: deptMfg.id,
      ownerId: auditee3.id,
    },
  });

  // 5. Create 8 Checklist Items for PRODUCT Audits
  const productChecklists = [
    { section: 'Dimensional', itemText: 'Verify critical dimensions and mounting clearances against engineering drawing', order: 1 },
    { section: 'Fasteners', itemText: 'Check torque specifications on all load-bearing bolts and fasteners using calibrated tool', order: 2 },
    { section: 'Electrical', itemText: 'Inspect wiring harness routing, tie-wrap security, and pin insertion depth', order: 3 },
    { section: 'Surface Quality', itemText: 'Check surface finish, paint thickness, and verify absence of scratches, dents, or burrs', order: 4 },
    { section: 'Traceability', itemText: 'Confirm 2D DataMatrix / barcode readability and serial number label alignment', order: 5 },
    { section: 'Functional', itemText: 'Verify sub-assembly switch operation, latch engagement, and tactile feedback', order: 6 },
    { section: 'Contamination', itemText: 'Ensure component cleanliness and absence of foreign particulate (FOD)', order: 7 },
    { section: 'Packaging', itemText: 'Inspect protective foam fitment, moisture barrier bag, and shipping crate tagging', order: 8 },
  ];

  for (const item of productChecklists) {
    await prisma.checklistItem.create({
      data: {
        auditType: 'PRODUCT',
        section: item.section,
        itemText: item.itemText,
        order: item.order,
      },
    });
  }

  // 6. Create 8 Checklist Items for REVALIDATION Audits
  const revalidationChecklists = [
    { section: 'Tooling & Fixtures', itemText: 'Verify tooling wear limits, fixture calibration date, and clamping pressure', order: 1 },
    { section: 'Process Parameters', itemText: 'Confirm machine temperature, pressure, and cycle time match the approved Control Plan', order: 2 },
    { section: 'Operator SOP', itemText: 'Verify standard operating procedure (SOP) revision is current and displayed at station', order: 3 },
    { section: 'Poka-Yoke', itemText: 'Test error-proofing sensors and interlocking mechanisms with certified master defect part', order: 4 },
    { section: 'Raw Material', itemText: 'Audit incoming batch certificates of analysis (CoA) and FIFO shelf-life tagging', order: 5 },
    { section: 'Gauge Repeatability', itemText: 'Confirm Go/No-Go plug gauges are within valid calibration interval', order: 6 },
    { section: 'Rework Protocol', itemText: 'Verify rework handling complies with quarantine area controls and re-inspection SOP', order: 7 },
    { section: 'Maintenance Log', itemText: 'Confirm autonomous and preventive maintenance checklist completion for previous shift', order: 8 },
  ];

  for (const item of revalidationChecklists) {
    await prisma.checklistItem.create({
      data: {
        auditType: 'REVALIDATION',
        section: item.section,
        itemText: item.itemText,
        order: item.order,
      },
    });
  }

  console.log('✅ Seed completed successfully:');
  console.log(` - Departments: 3`);
  console.log(` - Users: 7 (Auditor, 3 Auditees, Head, Plant Manager, Admin)`);
  console.log(` - Lines: 3 (Chassis, Powertrain, Final Assembly)`);
  console.log(` - Checklist Items: 8 PRODUCT, 8 REVALIDATION`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
