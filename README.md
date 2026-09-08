# Social Insight Dashboard

Internal dashboard สำหรับแผนก marketing รวมข้อมูล insight จาก Facebook Page,
Instagram Business และ TikTok เก็บประวัติลง Postgres ของเราเอง แล้วคำนวณว่า
คอนเทนต์ไหนทำผลงานดีกว่าค่าปกติของบัญชีนั้น

> **สถานะ: Stage 1-5 เสร็จ, Stage 6 — Facebook/Instagram/TikTok provider เขียนครบแล้ว
> แต่ยังไม่มีตัวไหนทดสอบกับบัญชีจริงเลย**
> `pnpm sync` ทำงานได้เต็มรูปแบบด้วย MockProvider, หน้า Overview (รวมระบบแนะนำ
> "กำลังมา / Top 10 / ต่ำกว่าปกติ") / Content / Settings ใช้งานได้จริงบนข้อมูลใน
> ฐานข้อมูล — ดู [Provider](#provider) ด้านล่างก่อนลองเปิดใช้ provider จริงตัวไหน

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

### FacebookProvider (Stage 6)

```
INSIGHT_PROVIDER=facebook
FACEBOOK_PAGE_ID=...            # Page id
FACEBOOK_PAGE_ACCESS_TOKEN=...  # Page access token — ส่งเป็น Authorization header เท่านั้น
FACEBOOK_GRAPH_VERSION=         # ว่าง = v25.0 ตามที่ยืนยันไว้ใน api-spec.ts
FACEBOOK_LOOKBACK_DAYS=90
```

ทุก endpoint / field / metric ที่ยิงออกไปอยู่ใน
[`lib/providers/facebook/api-spec.ts`](lib/providers/facebook/api-spec.ts) ไฟล์เดียว
พร้อมลิงก์ docs และวันที่ยืนยันของแต่ละตัว **ห้ามเพิ่มชื่อ metric จากความจำ** —
Meta ลบ metric ตามกำหนดการจริง เช่น `post_impressions_unique` (reach ของโพสต์ที่คู่มือ
ส่วนใหญ่ยังสอนอยู่) ถูกลบไปแล้ว 15 มิ.ย. 2025 ต้องใช้ `post_total_media_view_unique` แทน
และ `page_fans` ถูกลบ 15 พ.ย. 2025 ใช้ `page_follows` แทน — เรียก metric ที่ถูกลบแล้ว
จะได้ error "invalid metric" ไม่ใช่ข้อมูลเปล่า

รายละเอียดที่ยัง **ยืนยันจาก docs ไม่ได้** ถูกรวมไว้ที่ `UNVERIFIED` ในไฟล์เดียวกัน
โค้ดจะโยน `UnverifiedApiDetailError` พร้อมลิงก์หน้า docs ที่ต้องไปเช็ค แทนที่จะเดาค่า
ให้ตัวเลขผิดหลุดเข้า DB ส่วน MockProvider ยังทำงานได้ปกติทุกอย่าง

**อัปเดต 2026-09-07:** เช็ค `comments.summary.total_count` แล้วยืนยันได้จาก
[Post Comments reference](https://developers.facebook.com/docs/graph-api/reference/post/comments/)
— ไม่ใช่ของค้างอีกต่อไป ส่วน `shares` ที่หายไปทั้งฟิลด์ (ไม่ใช่ `{count: 0}`) ยืนยันจาก
docs ไม่ได้ว่าหมายถึงอะไร ทีมตัดสินใจให้ **ถือว่า = 0 แชร์** (ดูคอมเมนต์ที่
`readShareCount` ใน `normalize.ts`) — เป็นการตัดสินใจของทีม ไม่ใช่ข้อเท็จจริงที่ยืนยัน
จาก Meta ยังมีของค้างอื่นเหลืออยู่ (attachment type ที่ไม่อยู่ในลิสต์เอกสาร เช่น reel,
avg watch seconds, completion rate, ฯลฯ — ดู `UNVERIFIED` ทั้งหมดใน api-spec.ts) แต่
อันเหล่านั้นไม่ block ทุก sync เหมือนสองอันแรก

**หมายเหตุ:** ตาม `PROMPT.md` Stage 6 ควรทำทีละแพลตฟอร์มแล้วหยุดให้ทดสอบจริงก่อนทำตัว
ถัดไป — Instagram และ TikTok ด้านล่างถูกเขียนขึ้นตามคำสั่งของผู้ใช้ให้ทำต่อโดยไม่รอ
ทดสอบ Facebook ก่อน ไม่ใช่เพราะ Facebook ผ่านการทดสอบแล้ว **ยังไม่มี provider จริงตัว
ไหนเลยที่ทดสอบกับบัญชีจริง**

### InstagramProvider (Stage 6)

```
INSIGHT_PROVIDER=instagram
INSTAGRAM_PAGE_ID=...            # Facebook Page ที่ต่อ Instagram Business Account ไว้
INSTAGRAM_ACCESS_TOKEN=...       # Page access token เดียวกับที่ FacebookProvider ใช้ได้
INSTAGRAM_GRAPH_VERSION=         # ว่าง = v25.0 (Graph API เดียวกับ Facebook)
INSTAGRAM_LOOKBACK_DAYS=90
```

Instagram Business account อ่านผ่าน **Graph API ตัวเดียวกับ Facebook**
(`graph.facebook.com`, version เดียวกัน) ยืนยันจริงจาก example request ใน
Instagram get-started guide ไม่ใช่เดาตามความคล้ายคลึงกัน — โค้ดเลยใช้
`GraphClient` ตัวเดียวกัน (ย้ายไปอยู่ `lib/providers/meta/`) รายละเอียดอยู่ใน
[`lib/providers/instagram/api-spec.ts`](lib/providers/instagram/api-spec.ts)

ข้อจำกัดสำคัญ: `followers_count` เป็น field ปัจจุบัน ณ ตอนนั้น ไม่ใช่ metric แบบ
time-series ที่ backfill ย้อนหลังได้ — แต่ละ sync จะได้แค่แถว `account_metrics_daily`
ของ "วันนี้" วันเดียว และ `follower_delta` เป็น `null` เสมอ (คำนวณ delta ต้องรู้ค่าเมื่อวาน
ซึ่งอยู่ใน DB เท่านั้น ส่วน provider ไม่แตะ DB)

### TikTokProvider (Stage 6)

```
INSIGHT_PROVIDER=tiktok
TIKTOK_ACCESS_TOKEN=...   # "TikTok for Developers" OAuth token ของบัญชีเอง (ไม่ใช่ TikTok Business/Marketing API)
TIKTOK_LOOKBACK_DAYS=90
```

**ข้อควรระวังก่อนใช้จริง:** งานวิจัย docs ของ TikTok (2026-09-07) ยืนยันได้ไม่แน่นเท่า
Facebook/Instagram — เว็บ docs หลักเป็น JS-rendered อ่านตรงไม่ได้ และผลค้นหาหลายอันขัดแย้ง
กันเองก่อนจะเจอหน้าที่ยืนยันได้ชัด รายละเอียดทั้งหมด (endpoint ไหนยืนยันแล้ว, อะไรยังไม่ยืนยัน,
ทำไมเลือกใช้ TikTok for Developers แทน TikTok for Business) อยู่ใน
[`lib/providers/tiktok/api-spec.ts`](lib/providers/tiktok/api-spec.ts) — ควรอ่านทั้งไฟล์ก่อน
ตั้งค่าจริง โดยเฉพาะ:
- ไม่มี metric ไหนที่ยืนยันได้สำหรับ reach/saves/avg watch time/completion rate เลย —
  ค่าพวกนี้เป็น `null` เสมอ ไม่ใช่ปัดเป็น 0
- ทุกคอนเทนต์ถูกจัดเป็น `video` เสมอ (ไม่พบ field แยกโพสต์รูปแบบ "photo mode")
- `create_time` สมมติว่าเป็นหน่วยวินาที (ยืนยันจาก docs v1 เท่านั้น ไม่ใช่ v2) โค้ดมี
  sanity check ถ้า parse ออกมาไกลจากปัจจุบันเกิน 20 ปีจะ throw แทนที่จะเก็บวันที่ผิดเงียบ ๆ
- access token อายุสั้น (~24 ชม.) ไม่มี refresh flow อัตโนมัติ ต้องขอ token ใหม่เอง

## โครงสร้าง

```
app/                    routes — overview, content, settings
components/             UI components
lib/
  datetime.ts           UTC <-> Asia/Bangkok, snapshot_date helpers
  db.ts                 prisma client (singleton, hot-reload safe)
  env.ts                zod-validated environment
  providers/            InsightProvider interface + implementations   (Stage 2)
    meta/               graph client + insights parser ที่ Facebook/Instagram ใช้ร่วมกัน
    facebook/           api-spec (endpoint/metric ที่ยืนยันแล้ว), normalize + tests (Stage 6)
    instagram/          api-spec, normalize + tests                   (Stage 6)
    tiktok/             client, api-spec, normalize + tests            (Stage 6)
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
