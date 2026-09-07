# Social Insight Dashboard

Internal dashboard สำหรับแผนก marketing รวมข้อมูล insight จาก Facebook Page,
Instagram Business และ TikTok เก็บประวัติลง Postgres ของเราเอง แล้วคำนวณว่า
คอนเทนต์ไหนทำผลงานดีกว่าค่าปกติของบัญชีนั้น

> **สถานะ: Stage 1 — รากฐาน**
> โครงสร้างโปรเจกต์, Postgres, Prisma schema และ migration พร้อมแล้ว
> sync engine / metrics / UI จะมาใน stage ถัดไป

---

## ต้องมีอะไรบ้าง

| เครื่องมือ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Node.js | ≥ 20.11 | ทดสอบบน v24.15.0 |
| pnpm | 12.x | `npm i -g pnpm` (corepack ต้องสิทธิ์ admin บนเครื่องนี้) |
| Docker | ล่าสุด | ใช้รัน Postgres 16 ตอน dev |

## ติดตั้งจากเครื่องเปล่า

```bash
pnpm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
docker compose up -d
pnpm db:migrate
```

แค่นี้ก็ได้ฐานข้อมูลที่มี schema ครบและ `metric_weights` แถว default แล้ว

จากนั้นเปิด dev server:

```bash
portless
```

เปิดที่ **https://social-insight.localhost:3443**
(โปรเจกต์นี้เสิร์ฟผ่าน portless ตามมาตรฐานของเครื่องนี้ ไม่ใช้ `localhost:PORT` ตรง ๆ
ถ้าอยากรันแบบธรรมดาจริง ๆ ใช้ `pnpm dev` ได้)

## คำสั่งที่ใช้บ่อย

```bash
pnpm dev              # dev server (ปกติให้เรียกผ่าน portless)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # prisma studio — ส่องข้อมูลในตาราง
pnpm db:reset         # drop + migrate + seed
pnpm sync             # sync จาก provider ที่ตั้งใน env  (Stage 2)
pnpm sync -- --dry    # ดึงข้อมูลแต่ไม่เขียน DB          (Stage 2)
docker compose up -d  # Postgres
docker compose down   # ปิด (ข้อมูลยังอยู่ใน volume)
```

ก่อนบอกว่างานเสร็จ ต้องผ่านทั้งสามอย่าง:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## ฐานข้อมูล

Postgres รันที่ **พอร์ต 5433** ของ host (ไม่ใช่ 5432) เพื่อไม่ชนกับ Postgres
ที่อาจติดตั้งอยู่บนเครื่องแล้ว ข้อมูลเก็บใน docker volume ชื่อ
`social-insight-pgdata` — `docker compose down` ไม่ลบข้อมูล ถ้าอยากล้างจริง ๆ
ต้อง `docker compose down -v`

```
DATABASE_URL="postgresql://social_insight:social_insight@localhost:5433/social_insight?schema=public"
```

### สองเรื่องที่ต้องเข้าใจก่อนแตะ schema

**1. `content_metrics_daily` เป็นยอดสะสม ไม่ใช่ยอดรายวัน**

แถว `(content=X, date=2026-09-07, views=1200)` แปลว่า *"คลิป X มียอดวิวรวมทั้งหมด
1200 ณ สิ้นวันที่ 7 ก.ย."* ไม่ใช่ "วันที่ 7 มีคนดู 1200"
ยอดที่เกิดจริงในวันนั้นคือ `views(7) - views(6)` เรียกว่า **delta**

เก็บแบบนี้เพราะ (ก) API ต้นทางให้มาแบบนี้ และ (ข) ถ้าเก็บเป็นยอดรายวันแล้ว sync
ขาดไปวันหนึ่ง จะกู้คืนไม่ได้เลย แต่ถ้าเก็บสะสมไว้ ยังคำนวณย้อนหลังได้เสมอ

**ข้อยกเว้น:** `account_metrics_daily` ไม่ได้เป็นสะสม — `followers` เป็นค่า ณ จุดเวลา,
`views`/`reach` เป็นยอดที่เกิดในวันนั้น (ตามที่แพลตฟอร์มรายงานมา) มีคอมเมนต์กำกับไว้ใน schema แล้ว

**2. ตัวเลขที่คำนวณเองไม่เก็บลง DB**

ER, performance score, velocity คำนวณตอน query ใน `lib/metrics/` เท่านั้น
แก้ `metric_weights` แล้วตัวเลขย้อนหลังทั้งหมดเปลี่ยนตาม — ตั้งใจให้เป็นแบบนั้น
ในตารางเก็บเฉพาะตัวนับดิบที่ provider ส่งมา

### null ไม่เท่ากับ 0

`reach`, `saves`, `avg_watch_seconds`, `completion_rate` เป็น nullable เพราะบาง
แพลตฟอร์มไม่ให้ข้อมูลนี้ **ห้ามแทนด้วย 0 ทุกกรณี** — 0 กับ "ไม่มีข้อมูล"
คนละความหมาย และตัวหารของ ER (`reach` หรือ `views`) ขึ้นกับเรื่องนี้โดยตรง
UI ต้องแสดง `—` พร้อม tooltip บอกว่าแพลตฟอร์มนี้ไม่ให้ข้อมูล

## Timezone

- ทุก timestamp ใน DB เป็น **UTC** (`timestamptz`)
- ทุกอย่างที่ผู้ใช้เห็นเป็น **Asia/Bangkok**
- `snapshot_date` เป็น **วันตามปฏิทิน Asia/Bangkok** เก็บเป็น `date` เฉย ๆ ไม่มีเวลา

แปลงด้วย helper ใน [`lib/datetime.ts`](lib/datetime.ts) เท่านั้น อย่าใช้ `new Date()`
ตรงจุดเรียกใช้ — คอลัมน์ `date` ของ Postgres ไม่มี timezone และ Prisma คืนมาเป็น
UTC midnight ซึ่งจะเพี้ยน 7 ชั่วโมงถ้าตีความผิด

## Provider

ตอนนี้ยังไม่ได้รับอนุมัติ App Review จาก Meta และ TikTok
**ทุกอย่างต้องรันได้ด้วย `MockProvider` โดยไม่ต้องมี API key จริง**

```
INSIGHT_PROVIDER=mock    # ค่า default — อย่าเปลี่ยนจนกว่าจะถึง Stage 6
MOCK_SEED=20260907       # seed คงที่ ทำให้ sync ซ้ำได้ผลเดิม (idempotent)
```

Provider จริงอยู่หลัง env flag นี้ และจะทำทีละแพลตฟอร์มเริ่มจาก Facebook ใน Stage 6

## โครงสร้าง

```
app/                    routes — overview, content, settings
components/             UI components
lib/
  datetime.ts           UTC <-> Asia/Bangkok, snapshot_date helpers
  db.ts                 prisma client (singleton, hot-reload safe)
  env.ts                zod-validated environment
  providers/            InsightProvider interface + implementations   (Stage 2)
  metrics/              การคำนวณทั้งหมด + unit tests                    (Stage 3)
  sync/                 sync engine, upsert, sync_runs logging        (Stage 2)
  queries/              read layer สำหรับ UI                           (Stage 4)
prisma/
  schema.prisma         data model + คอมเมนต์อธิบายกฎสะสม
  migrations/
  seed.ts               metric_weights แถว default
scripts/
  sync.ts               CLI entrypoint ของ pnpm sync
```

## ปัญหาที่เจอบ่อย

**`docker compose up -d` ฟ้องว่าต่อ daemon ไม่ได้**
เปิด Docker Desktop ก่อน แล้วรอจน daemon ขึ้น (`docker info` ต้องไม่ error)

**Docker Desktop เปิดแล้วเด้ง error ทันที "initializing Ingest server ... sailor-ingest.sock: The file cannot be accessed by the system"**
เป็น socket file ค้างจากครั้งที่ Docker ถูก kill ไม่สวย อยู่ที่
`%LOCALAPPDATA%\Docker\run\` (`sailor-ingest.sock`, `userAnalyticsOtlpHttp.sock`,
`dockerInference`, `dockerEthernetVfkit`) ไฟล์พวกนี้ลบไม่ได้แม้ปิด Docker
หมดแล้วหรือสั่ง `wsl --shutdown` เพราะ kernel ยังจองอยู่ — **ต้อง reboot เครื่อง**
หลัง reboot Docker จะสร้างใหม่เองแล้วเปิดได้ปกติ

**`pnpm install` ฟ้อง `ERR_PNPM_IGNORED_BUILDS`**
pnpm 10+ บล็อก postinstall script โดย default รายการที่อนุญาตอยู่ใน
`pnpm-workspace.yaml` ใต้ `allowBuilds` แล้ว ถ้ายังฟ้องให้ลบ `node_modules`
กับ `pnpm-lock.yaml` แล้วติดตั้งใหม่

**`pnpm db:migrate` ต่อฐานข้อมูลไม่ได้**
เช็คว่า container ขึ้นแล้วและ healthy: `docker compose ps`
แล้วเช็คว่า `DATABASE_URL` ใน `.env` ชี้พอร์ต 5433
