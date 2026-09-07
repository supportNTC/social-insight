# CLAUDE.md

Internal dashboard สำหรับแผนก marketing รวมข้อมูล insight จาก Facebook Page, Instagram Business และ TikTok เก็บประวัติลง Postgres ของเราเอง แล้วคำนวณว่าคอนเทนต์ไหนทำผลงานดีกว่าค่าปกติของบัญชีนั้น

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # prisma studio
pnpm db:reset         # drop + migrate + seed (mock data)
pnpm sync             # รัน sync จาก provider ที่ตั้งไว้ใน env
pnpm sync -- --dry    # ดึงข้อมูลแต่ไม่เขียน DB
docker compose up -d  # Postgres สำหรับ dev
```

ก่อนบอกว่างานเสร็จ ให้รัน `pnpm typecheck && pnpm lint && pnpm test` ให้ผ่านทั้งหมด

## กฎที่ห้ามแหก

1. **ห้ามเดาชื่อ metric หรือ endpoint ของ Facebook / Instagram / TikTok API จากความจำ** API เหล่านี้เปลี่ยนบ่อยและมีการ deprecate metric อยู่เรื่อย ๆ ถ้าไม่ได้ข้อมูลจาก docs ที่ยืนยันแล้ว ให้ทำเป็น TODO และถามผู้ใช้
2. **ห้ามเขียนโค้ดที่ต้องมี API credential จริงจึงจะรันได้** ทุกอย่างต้องรันได้ด้วย `MockProvider` เสมอ
3. **ห้ามแสดง 0 แทน null** `reach`, `saves`, `completion_rate` ไม่มีในบางแพลตฟอร์ม ถ้าไม่มีให้แสดง `—` และมี tooltip บอกว่าแพลตฟอร์มนี้ไม่ให้ข้อมูลนี้
4. **ห้ามเทียบตัวเลขข้ามแพลตฟอร์มโดยไม่บอกผู้ใช้** ถ้ารวม ER ที่คิดจาก reach กับที่คิดจาก views ต้องมี badge หรือ footnote กำกับ
5. **ห้าม commit token / secret** ทุก secret อ่านจาก env เท่านั้น access token ต้องเข้ารหัสก่อนเก็บ DB
6. **ห้าม migrate schema แบบทำลายข้อมูลโดยไม่ถาม** ตาราง metrics คือข้อมูลประวัติที่ดึงกลับมาไม่ได้ (TikTok ให้ย้อนหลังแค่ ~60 วัน)

## Domain glossary

| คำ | ความหมายในโปรเจกต์นี้ |
|---|---|
| content | โพสต์หรือคลิป 1 ชิ้นบนแพลตฟอร์มใดก็ได้ |
| snapshot | ยอด **สะสม** ของ content ณ วันหนึ่ง ไม่ใช่ยอดที่เกิดในวันนั้น |
| delta | ผลต่างระหว่าง 2 snapshot = ยอดที่เกิดขึ้นจริงในช่วงนั้น |
| ER basis | ตัวหารของ engagement rate เป็น `reach` หรือ `views` ต้องติดไปกับตัวเลขเสมอ |
| performance score | ER ของคอนเทนต์ ÷ median ER 30 วันของบัญชีเดียวกัน (1.0 = ปกติ) |
| velocity | ยอด 24 ชม.แรก ÷ median ยอด 24 ชม.แรกของ 20 คอนเทนต์ล่าสุด |
| rising | velocity ≥ 1.5 และโพสต์ไม่เกิน 72 ชม. |

## Conventions

- TypeScript strict, ห้าม `any` ห้าม `@ts-ignore` — ถ้าติดจริงให้ถาม
- Timezone: เก็บใน DB เป็น UTC ทั้งหมด, แสดงผลเป็น `Asia/Bangkok`, `snapshot_date` เป็น date ตาม Asia/Bangkok
- ตัวเลขทุกตัวจาก provider ให้ถือว่าอาจ null หรือหายได้ — ห้าม non-null assertion บนข้อมูลจาก API
- Server Components เป็น default ใช้ `"use client"` เฉพาะที่ต้องมี interactivity
- ตัวเลขที่คำนวณเองอยู่ใน `lib/metrics/` เท่านั้น ห้ามคำนวณ ER ใน component
- Error message ที่ผู้ใช้เห็นเป็นภาษาไทย, log และ code comment เป็นภาษาอังกฤษ
- ทุกฟังก์ชันใน `lib/metrics/` ต้องมี unit test คลุมกรณี null และหารด้วยศูนย์

## โครงสร้างที่คาดไว้

```
app/                    routes (overview, content, settings)
components/             UI components
lib/
  providers/            InsightProvider interface + implementations
  metrics/              การคำนวณทั้งหมด + tests
  sync/                 sync engine, upsert logic, sync_runs logging
  db.ts                 prisma client
prisma/schema.prisma
scripts/sync.ts         CLI entrypoint สำหรับ pnpm sync
```

## สิ่งที่ยังไม่ตัดสินใจ (ห้ามเดา ให้ถาม)

- ระบบ auth / SSO ของบริษัท — ตอนนี้ยังไม่ทำ auth เลย
- จะ deploy ที่ไหน
- จะเชื่อมข้อมูล ads spend ด้วยไหม
- น้ำหนัก metric สุดท้ายที่ marketing ต้องการ (ใช้ default ไปก่อน)
