# Kickoff Prompt — Stage 5 (ระบบแนะนำ)

> **วิธีใช้:** วางทั้งไฟล์นี้เป็น message แรกใน Claude Code session ใหม่ (ในโฟลเดอร์
> `social-insight` ที่มีอยู่แล้ว) แทนที่จะพิมพ์ "ทำ Stage 5 ต่อเลย" เฉย ๆ — ไฟล์นี้ให้บริบท
> ที่ session ใหม่ไม่มี (เพราะไม่ได้อยู่ในบทสนทนาที่ทำ Stage 1-4 มา)
>
> ไฟล์นี้เสริม `PROMPT.md` และ `CLAUDE.md` (ยังใช้ทั้งสองไฟล์นั้นเป็นกฎหลักเหมือนเดิม) —
> ไม่ได้แทนที่ แค่สรุปว่าตอนนี้โค้ดอยู่ตรงไหนแล้ว ก่อนเริ่ม Stage 5

---

## สถานะปัจจุบัน: Stage 1-4 เสร็จแล้ว, กำลังจะเริ่ม Stage 5

รัน `pnpm typecheck && pnpm lint && pnpm test` ผ่านหมด (66 tests) ก่อนเขียนบรรทัดนี้แล้ว —
ยืนยันว่า codebase อยู่ในสถานะ clean พร้อมต่อยอด

### Stage 1 — รากฐาน ✅
โครงสร้างโปรเจกต์, Docker Compose (Postgres 16, host port 5433), Prisma schema
เต็มรูปแบบ (`accounts`, `contents`, `content_metrics_daily`, `account_metrics_daily`,
`metric_weights`, `raw_payloads`, `sync_runs`), migration แรก, `.env.example`, README

### Stage 2 — Provider + sync engine ✅
- `lib/providers/types.ts` — `InsightProvider` interface กลาง (ไม่ผูกกับ shape ของ API
  ต้นทาง)
- `lib/providers/mock-provider.ts` + `lib/providers/mock/generate.ts` — MockProvider
  generate 3 บัญชี (facebook/instagram/tiktok, แบรนด์เดียวกัน "ครัวชายทะเล") x 40
  คอนเทนต์ = 120 คอนเทนต์ ย้อนหลัง 90 วัน แบบ **deterministic เต็มร้อย** — `MOCK_SEED`
  (`.env`) ถูก parse เป็น `YYYYMMDD` แล้วใช้เป็น "anchor date" ของทั้ง universe ไม่ใช่แค่
  random seed เฉย ๆ ทำให้ `pnpm sync` รันกี่ครั้งก็ได้ผลเหมือนเดิมทุกไบต์ แต่ละบัญชีมี
  content index 0 = คอนเทนต์ "กำลังมา" (published ≤ 2 วันจาก anchor, decay rate สูง
  กว่าปกติ), index 1 = standout เสมอ, index 2 = underperformer เสมอ (การันตี ไม่ได้ปล่อย
  ให้สุ่มเอง)
- `lib/providers/factory.ts` — `getProvider()` อ่าน `INSIGHT_PROVIDER` (default mock)
  provider จริงยังไม่ implement เลย ตั้งใจ — โยน error ชัดเจนว่า "Stage 6 เท่านั้น"
  (CLAUDE.md ข้อห้าม 1: ห้ามเดาชื่อ metric/endpoint จริงจากความจำ)
- `lib/sync/run-sync.ts` — sync engine, upsert idempotent บน natural unique key ของ
  ทุกตาราง, เขียน `raw_payloads` ก่อน normalize เสมอ, log `sync_runs`
- `scripts/sync.ts` (`pnpm sync` / `pnpm sync -- --dry`) และ `app/api/sync/route.ts`
  (`x-sync-secret` header, constant-time compare, ปิดเองถ้า `SYNC_SECRET` ว่าง)
- **ทดสอบจริงแล้ว:** รัน `pnpm sync` 2 ครั้งติดกัน → row count ในทุกตาราง (ยกเว้น
  `raw_payloads`/`sync_runs` ซึ่งเป็น audit log ที่ตั้งใจให้เพิ่มทุกรัน) เท่าเดิมเป๊ะ

### Stage 3 — Metrics layer ✅
`lib/metrics/` — **pure functions ล้วน ไม่มี Prisma/I-O ในไฟล์เหล่านี้เลย** (สำคัญมาก
สำหรับ Stage 5: ห้าม query DB ใน `lib/metrics/` — ให้ query ใน `lib/queries/` แล้วส่ง
array/number ธรรมดาเข้าไปแทน):

| ไฟล์ | สูตร | คืนค่า null เมื่อ |
|---|---|---|
| `engagement-rate.ts` | `weighted / (reach ?? views) * 100` พร้อม basis | หารด้วย 0 (ทั้ง reach=0 ที่ตั้งใจ และ views=0) |
| `performance-score.ts` | contentER ÷ median(accountER ช่วง 30 วัน, basis เดียวกัน) | ไม่มี baseline หรือ median=0 |
| `velocity.ts` | first24hViews ÷ median(first24hViews ของ 20 คอนเทนต์ล่าสุด) | ไม่มี baseline หรือ median=0 |
| `rising.ts` | `isRising({velocity, publishedAt, now})` → velocity≥1.5 && age≤72h | velocity เป็น null → false เสมอ (ไม่ใช่ "rising by default") |
| `delta.ts` | แปลง cumulative snapshot series → per-day delta | ค่า null คงเป็น null (ไม่ทบกับ 0) |
| `median.ts`, `weighted-engagement.ts` | helper ที่ใช้ร่วมกัน | — |

**ค่าสำคัญที่ต้องรู้:** ทุกค่า ER ที่ได้จาก `computeEngagementRate` เป็นสเกล ×100 อยู่แล้ว
(เช่น `74.9` แปลว่า "74.9%") — **ห้ามคูณ 100 ซ้ำ** ตอนแสดงผล ใช้
`formatPercentValue()` ใน `lib/format.ts` ไม่ใช่ `formatPercent()` (อันหลังคาดหวัง
fraction 0..1 สำหรับ share/proportion)

### Stage 4 — UI ✅
- `lib/queries/` (`overview.ts`, `content-list.ts`, `content-detail.ts`, `weights.ts`,
  `sync-status.ts`, `latest-data-date.ts`, `date-range.ts`) — ชั้นเดียวที่อนุญาตให้
  Prisma query แล้วแปลงเป็น array/number ป้อนเข้า `lib/metrics/`
  **สำคัญ:** ทุก query ใช้ `getLatestDataDate()` (MAX ของ `account_metrics_daily`) เป็น
  "today" ไม่ใช่ `new Date()` จริง — เพราะ MockProvider universe หยุดตายตัวที่
  `MOCK_SEED`, ถ้า sync จริงมาทีหลังก็อาจ lag ได้เหมือนกัน
- `/` Overview, `/content` (search/sort/pagination/export CSV), `/content/[id]`
  (growth chart), `/settings` (ปรับน้ำหนัก metric ผ่าน Server Action, ดูสถานะ sync
  ล่าสุดของทุกบัญชี) — ทุกหน้ามี `loading.tsx` และ empty state
- `components/layout/AppHeader.tsx` แสดงเวลา sync ล่าสุดบนทุกหน้า (ผ่าน root layout)
- Design tokens จาก `design-system/social-insight-dashboard/MASTER.md` (สี, font
  IBM Plex Sans Thai/Mono, spacing scale) ถูกใช้จริงแล้วทั้งแอป ไม่ใช่แค่ prototype —
  `lib/platform.ts` คือ single source of truth ของสี/label แต่ละแพลตฟอร์ม (`PLATFORM_MARK_COLOR`, `PLATFORM_LABEL`)
- Bug 2 จุดที่เจอและแก้ระหว่าง verify: `ScrollReveal` ไม่มี fallback ถ้า
  `IntersectionObserver` ไม่ยิง (เพิ่ม timeout 600ms), `/settings` ถูก Next.js
  prerender เป็น static โดยไม่ตั้งใจ (เพิ่ม `export const dynamic = "force-dynamic"`)

---

## Stage 5 — ระบบแนะนำ (จาก PROMPT.md เดิม)

> section บนหน้า Overview: **"กำลังมา"** (rising), **"Top 10 ช่วงนี้"** (เรียงตาม
> performance score), **"ต่ำกว่าปกติ"** พร้อมชี้ว่าตกที่ขั้นไหน (reach ต่ำ / ดูน้อย /
> ดูแล้วไม่ interact)

### สิ่งที่มีให้ใช้แล้ว (ไม่ต้องสร้างใหม่)
- `isRising()`, `computePerformanceScore()`, `computeVelocity()` ใน `lib/metrics/` —
  ตรงกับ "กำลังมา" และ "Top 10" ได้เลย เพียงต่อ query layer ให้ป้อนข้อมูลถูก shape
- Pattern การคำนวณ baseline ต่อบัญชีทำไว้แล้วใน `lib/queries/content-list.ts`
  (`erHistoryByAccount`) — Stage 5 ต้องการ pattern คล้ายกันสำหรับ velocity baseline
  (first-24h views ของ 20 คอนเทนต์ล่าสุด) ซึ่งยังไม่มีใครสร้าง query จริงให้ในระบบเลย
  (Stage 4 ไม่ได้ต้องใช้ velocity — Stage 5 เป็น consumer ตัวแรก)
- Mock data การันตีว่าทุกบัญชีมีคอนเทนต์ index 0 ที่ velocity สูงพอจะ "กำลังมา" จริง
  (ดู Stage 2 ด้านบน) — ใช้ทดสอบ UI ได้ทันทีโดยไม่ต้องรัน sync ซ้ำ

### สิ่งที่ Stage 5 ต้องสร้างใหม่
1. `lib/queries/recommendations.ts` (ชื่อไฟล์แนะนำ) — ดึง candidate contents +
   คำนวณ velocity/performanceScore/rising ให้แต่ละอัน คล้ายที่ `content-list.ts` ทำกับ
   performance score แต่เพิ่ม first-24h-views baseline สำหรับ velocity ด้วย
2. Section "กำลังมา" — filter `isRising(...) === true`, เรียงตาม velocity มากไปน้อย
3. Section "Top 10 ช่วงนี้" — เรียงตาม performanceScore มากไปน้อย, **ห้ามปนกันข้าม ER
   basis ในตารางอันดับเดียว** (CLAUDE.md) — ต้องตัดสินใจว่าจะแยกเป็น 2 ตารางย่อย
   (by basis) หรือแสดง basis badge กำกับทุกแถวแล้วเรียงข้าม basis ได้ (การจัดอันดับ
   performanceScore ปลอดภัยกว่าการจัดอันดับ ER ตรง ๆ เพราะ performanceScore เป็นค่า
   normalize แล้ว แต่ควรถามผู้ใช้ก่อนตัดสินใจเอง)
4. Section "ต่ำกว่าปกติ" — **ยังไม่มีนิยามที่ชัดเจนในสเปกเดิม** ว่า "reach ต่ำ" /
   "ดูน้อย" / "ดูแล้วไม่ interact" แปลว่า threshold เท่าไหร่ นี่คือจุดที่ต้องถามผู้ใช้
   ก่อนเขียนโค้ด (ตาม `PROMPT.md` ข้อ 3 ที่บอกให้ระบุจุดกำกวมก่อนเริ่ม) ข้อเสนอเบื้องต้น
   ที่อาจถามผู้ใช้:
   - "reach ต่ำ": reach ของคอนเทนต์นี้ต่ำกว่า median reach ของบัญชีเกิน threshold
     เท่าไหร่ (เช่น < 50% ของ median)?
   - "ดูน้อย": views ต่ำกว่า median views ของบัญชี แต่ reach ปกติ (แปลว่าคนเห็นแต่ไม่กด)?
   - "ดูแล้วไม่ interact": views/reach ปกติ แต่ performanceScore < threshold (เช่น < 0.5)?
   - ลำดับการเช็ค (เช่น เช็ค reach ก่อน ถ้าปกติค่อยเช็ค views ถ้าปกติค่อยเช็ค ER) —
     ต้อง sequential ไม่ใช่ independent เพราะ "ตกที่ขั้นไหน" หมายถึง funnel step แรกที่พัง

### กฎที่ต้องระวังเป็นพิเศษใน Stage 5
- CLAUDE.md ข้อห้าม 4: ถ้า Top 10 มีคอนเทนต์จาก basis ต่างกันปนกัน ต้องมี badge/footnote
  กำกับชัดเจน — เหมือนที่ `PlatformSplit.tsx` และ content table ทำไว้แล้ว (ก็อปปี้
  pattern เดิมได้)
- คอนเทนต์ที่ `performanceScore` หรือ `velocity` เป็น `null` (ไม่มี baseline) ต้อง
  **ไม่ปรากฏ** ในทั้ง 3 section เลย ไม่ใช่ปรากฏพร้อมค่า 0 — กรองออกอย่างชัดเจน ไม่ใช่
  ปล่อยให้ sort function ดันไปท้ายตารางเฉย ๆ (เพราะ section พวกนี้มีความหมายเชิงการ
  แจ้งเตือน ถ้าไม่มีข้อมูลพอจะให้คำแนะนำ ไม่ควรแสดงเป็น "แย่ที่สุด" ทั้งที่จริงคือ "ยังไม่รู้")
- Section ใหม่นี้จะอยู่หน้า Overview (`app/page.tsx`) เพิ่มจากของเดิม (KPI/trend/
  platform split) ไม่ใช่แทนที่

---

## เริ่มต้น

ตาม `PROMPT.md` เดิม: **อย่าเขียนโค้ดทันที**
1. อ่าน `CLAUDE.md` และไฟล์นี้ให้ครบ
2. เสนอโครงสร้างไฟล์ที่จะเพิ่ม/แก้สำหรับ Stage 5
3. ถามผู้ใช้เรื่อง threshold ของ "ต่ำกว่าปกติ" (ข้อ 4 ด้านบน) และการจัดอันดับข้าม ER
   basis ใน Top 10 — ห้ามเดาเอง
4. หยุดรอผมยืนยัน แล้วค่อยเริ่มเขียนโค้ด
5. จบแล้วรัน `pnpm typecheck && pnpm lint && pnpm test`, สรุปสั้น ๆ, **หยุดรอ ห้ามทำ
   Stage 6 ต่อเอง**
