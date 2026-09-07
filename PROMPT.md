# Kickoff Prompt — Social Insight Dashboard

> วิธีใช้: วางทั้งไฟล์นี้เป็น message แรกใน Claude Code (ในโฟลเดอร์โปรเจกต์เปล่า) และวาง `CLAUDE.md` ไว้ที่ root ของ repo ก่อน

---

สร้างเว็บแอปภายในบริษัทชื่อ **Social Insight Dashboard** สำหรับแผนก marketing ใช้ดูข้อมูล insight จาก Facebook Page, Instagram Business และ TikTok รวมในที่เดียว เก็บประวัติลง database ของเราเอง และมีระบบแนะนำว่าคลิปไหน engagement ดีกว่าปกติ

## Tech stack (ใช้ตามนี้ ไม่ต้องเสนอทางเลือกอื่น)

- Next.js 15 (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn/ui + Recharts
- PostgreSQL 16 + Prisma
- Background sync: node script รันได้ทั้งจาก CLI (`pnpm sync`) และจาก API route ที่ป้องกันด้วย secret header (เพื่อให้ cron เรียกได้)
- Vitest สำหรับ unit test
- Docker Compose สำหรับ Postgres ตอน dev
- pnpm

## ข้อกำหนดสถาปัตยกรรมที่สำคัญที่สุด

**1. Provider adapter pattern**
สร้าง interface กลางชื่อ `InsightProvider` แล้ว implement 4 ตัว: `MockProvider`, `FacebookProvider`, `InstagramProvider`, `TiktokProvider`
ทุกตัวคืนค่าเป็น type กลางของเราเอง ไม่ใช่ shape ของ API ต้นทาง

**2. เริ่มด้วย MockProvider เท่านั้น**
ตอนนี้เรายังไม่ได้รับอนุมัติ App Review จาก Meta และ TikTok ดังนั้น **stage 1–3 ต้องทำงานได้สมบูรณ์โดยใช้ MockProvider ล้วน** ห้ามเขียนโค้ดที่ต้องมี API key จริงจึงจะรันได้ ให้ provider จริงอยู่หลัง env flag และ default = mock
MockProvider ต้อง generate ข้อมูลที่ดูสมจริง: ~120 คอนเทนต์ย้อนหลัง 90 วัน กระจาย 3 แพลตฟอร์ม มีคลิปที่ผลงานโดดเด่นบ้าง แย่บ้าง และมีคลิปที่กำลังพุ่งในช่วง 2 วันล่าสุด (จะได้เห็นว่าฟีเจอร์ "กำลังมา" ทำงาน)

**3. เก็บ raw payload ทุกครั้ง**
ทุก response จาก provider ต้องเก็บลงตาราง `raw_payloads` (JSONB) ก่อน แล้วค่อย normalize เข้าตารางจริง ถ้าสูตรคำนวณเปลี่ยนต้องย้อน recompute จาก raw ได้โดยไม่ต้องเรียก API ซ้ำ

**4. Metric ที่คำนวณเองไม่เก็บลง DB**
ER, performance score, velocity คำนวณตอน query ในชั้น service แยก (`lib/metrics/`) มี unit test ครบ

## Data model

```
accounts          id, platform, external_id, name, timezone, is_active,
                  token_ref (nullable), token_expires_at
contents          id, account_id, platform, external_id, kind (video|image|reel|carousel),
                  caption, published_at, permalink, thumbnail_url,
                  duration_seconds (nullable), tags (string[])
content_metrics_daily
                  id, content_id, snapshot_date, views, reach (nullable),
                  likes, comments, shares, saves (nullable),
                  avg_watch_seconds (nullable), completion_rate (nullable)
                  UNIQUE (content_id, snapshot_date)
account_metrics_daily
                  id, account_id, snapshot_date, followers, follower_delta, views, reach
metric_weights    id, like_weight, comment_weight, share_weight, save_weight, updated_at, updated_by
raw_payloads      id, account_id, provider, endpoint, fetched_at, payload (JSONB)
sync_runs         id, account_id, provider, started_at, finished_at,
                  status (success|partial|failed), items_synced, error_message
```

ข้อสำคัญ: `content_metrics_daily` เป็น **snapshot รายวันแบบ cumulative** (ยอดสะสมของคลิปนั้น ณ วันนั้น) ไม่ใช่ยอดที่เกิดในวันนั้น ทำให้คำนวณ delta ย้อนหลังได้ ให้เขียน comment อธิบายเรื่องนี้ใน schema

`reach`, `saves`, `completion_rate` เป็น nullable เพราะบางแพลตฟอร์มไม่ให้ — **UI ต้องรับมือกับค่า null ได้ทุกที่ ห้ามแสดง 0 แทน null**

## Metric logic (ต้องมี test)

```ts
// ER — ถ้าไม่มี reach ให้ใช้ views แต่ต้องติดธง basis ไว้
engagementRate = weightedEngagements / (reach ?? views) * 100
weightedEngagements = likes*w.like + comments*w.comment + shares*w.share + (saves??0)*w.save

// Performance score — เทียบกับ median ของ 30 วันย้อนหลังใน account เดียวกัน
// และเทียบเฉพาะคอนเทนต์ที่ ER basis เหมือนกัน
performanceScore = contentER / median(accountER_last30d)

// Velocity — จับคลิปกำลังมา
first24hViews = views ณ snapshot วันแรก
velocity = first24hViews / median(first24hViews ของ 20 คอนเทนต์ล่าสุดใน account)
// flag "rising" เมื่อ velocity >= 1.5 และ published_at <= 72 ชม.
```

น้ำหนัก default: like 1, comment 3, share 5, save 4 — อ่านจากตาราง `metric_weights` และแก้ได้ในหน้า settings

**ห้ามเรียงคอนเทนต์ที่ใช้ ER basis ต่างกัน (reach vs views) ปนกันในตารางอันดับเดียว** ให้แยกกลุ่มหรือแสดง badge บอก basis ให้ชัด

## แผนการทำงาน — ทำทีละ stage แล้วหยุดรอ review

หลังจบแต่ละ stage: รัน `pnpm typecheck && pnpm lint && pnpm test`, สรุปสั้น ๆ ว่าทำอะไรไปและมีจุดไหนที่ตัดสินใจแทนผม แล้ว **หยุดรอ ห้ามทำ stage ถัดไปเอง**

**Stage 1 — รากฐาน**
scaffold โปรเจกต์, docker-compose สำหรับ Postgres, Prisma schema ตามด้านบน, migration, `.env.example`, README บอกวิธีรัน
เกณฑ์ผ่าน: `docker compose up -d && pnpm db:migrate` ทำงานได้จากเครื่องเปล่า

**Stage 2 — Provider + sync engine**
`InsightProvider` interface, `MockProvider`, sync engine ที่ upsert เข้า DB แบบ idempotent (รันซ้ำวันเดียวกันต้องไม่เกิดข้อมูลซ้ำ), บันทึก `sync_runs`, `pnpm sync` CLI
เกณฑ์ผ่าน: รัน `pnpm sync` 2 ครั้งติดกันแล้วจำนวนแถวใน DB ไม่เพิ่มผิดปกติ

**Stage 3 — Metrics layer**
`lib/metrics/` ตามสูตรด้านบน + unit test ครอบ edge case: reach เป็น null, คอนเทนต์ใหม่ที่ยังไม่มี baseline, account ที่มีคอนเทนต์น้อยกว่า 5 ชิ้น, หารด้วยศูนย์

**Stage 4 — UI**
- `/` Overview: KPI cards (views, reach, weighted engagement, ER, followers) เทียบช่วงก่อนหน้า, กราฟ trend รายวัน, สัดส่วนตามแพลตฟอร์ม, ตัวกรองช่วงวันที่ + แพลตฟอร์ม
- `/content` ตารางคอนเทนต์: thumbnail, วันที่, แพลตฟอร์ม, ตัวเลข, performance score, ค้นหา/เรียง/กรอง, pagination, export CSV
- `/content/[id]` รายละเอียด: กราฟการเติบโตรายวันจาก snapshot, ลิงก์ไปโพสต์จริง
- `/settings` ปรับน้ำหนัก metric, ดูสถานะบัญชีและเวลา sync ล่าสุด
- ทุกหน้าต้องแสดงเวลา sync ล่าสุดชัดเจน และมี empty state / loading state

**Stage 5 — ระบบแนะนำ**
section บนหน้า Overview: "กำลังมา" (rising), "Top 10 ช่วงนี้" (เรียงตาม performance score), "ต่ำกว่าปกติ" พร้อมชี้ว่าตกที่ขั้นไหน (reach ต่ำ / ดูน้อย / ดูแล้วไม่ interact)

**Stage 6 — Provider จริง**
ทำทีละแพลตฟอร์ม เริ่มจาก Facebook เท่านั้น หยุดให้ผมทดสอบก่อนทำตัวถัดไป
**สำคัญ: ห้ามเดาชื่อ metric หรือ endpoint จากความจำ** ถ้าไม่แน่ใจให้เขียนเป็น TODO พร้อมระบุว่าต้องไปเช็ค docs หน้าไหน แล้วบอกผม — ผมจะไปเช็ค API docs ล่าสุดมาให้

## เริ่มต้น

อย่าเขียนโค้ดทันที ให้ทำตามนี้ก่อน:
1. อ่าน `CLAUDE.md`
2. เสนอโครงสร้างไฟล์ของทั้งโปรเจกต์
3. บอกจุดที่คุณเห็นว่า spec นี้ยังกำกวมหรือขัดแย้งกัน สูงสุด 5 ข้อ
4. หยุดรอผมยืนยัน แล้วค่อยเริ่ม Stage 1
