# Social Insight Dashboard

Internal dashboard สำหรับแผนก marketing รวมข้อมูล insight จาก Facebook Page,
Instagram Business และ TikTok เก็บประวัติลง Postgres ของเราเอง แล้วคำนวณว่า
คอนเทนต์ไหนทำผลงานดีกว่าค่าปกติของบัญชีนั้น พร้อมหน้าตั้งเป้าหมาย engagement /
ยอดสมัคร course ให้ทีม marketing ติดตามความคืบหน้าเป็นรายเดือน

> **สถานะ:** ใช้งานได้เต็มรูปแบบด้วย `MockProvider` (ไม่ต้องมี API key จริงเลย) —
> Overview, Content, เป้าหมาย, Settings ครบทุกหน้า Facebook/Instagram/TikTok
> provider เขียนโค้ดครบตามที่ docs ยืนยันได้แล้ว แต่ **ยังไม่มีตัวไหนทดสอบกับ
> บัญชีจริง** ก่อนเปิดใช้ provider จริงตัวไหน อ่าน [ต่อ Facebook/Instagram/TikTok
> ของจริง](#ต่อ-facebookinstagramtiktok-ของจริง) ให้ครบก่อน

โค้ดต่อทั้งหมดยึดกฎในทั้งของทั้งโปรเจกต์ตาม [`CLAUDE.md`](CLAUDE.md) — ที่สำคัญที่สุด:
**ห้ามเดาชื่อ metric/endpoint ของ API พวกนี้จากความจำ** ทุกอย่างที่ยืนยันจาก docs
ไม่ได้ต้องเป็น `UNVERIFIED`/TODO ไว้ ไม่ใช่เดาแล้วปล่อยผ่าน

---

## เริ่มจากเครื่องเปล่า (clone แล้วรันได้เลย)

### ต้องมีอะไรบ้าง

| เครื่องมือ | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| Node.js | ≥ 20.11 | ทดสอบบน v24.15.0 |
| pnpm | 12.x | `npm i -g pnpm` |
| Docker Desktop | ล่าสุด | ใช้รัน Postgres 16 ตอน dev |
| [portless](https://github.com/vercel-labs/portless) | ล่าสุด | `npm i -g portless` — ไม่บังคับ แต่เป็นวิธีมาตรฐานที่ใช้รัน dev server บนเครื่องนี้ ดู [Dev server](#dev-server) |

### ติดตั้ง

```bash
git clone <URL ของ repo นี้>
cd social-insight
pnpm install
cp .env.example .env      # Windows (PowerShell): Copy-Item .env.example .env
docker compose up -d
pnpm db:migrate
```

`.env` ที่ copy มายังไม่ต้องแก้อะไรเลยในขั้นนี้ — ค่า default ทั้งหมดทำให้แอปรันด้วย
`MockProvider` (ข้อมูลปลอมที่ generate ตาม seed คงที่ ไม่ใช่ข้อมูลจริง) ได้ทันที
ไม่ต้องมี API key ใด ๆ

`pnpm db:migrate` จะสร้าง schema ครบและ seed แถว `metric_weights` default ให้ ถ้า
อยากได้ข้อมูล mock ลง DB ด้วย (ไม่ใช่แค่ schema เปล่า) ให้รัน sync ครั้งแรก:

```bash
pnpm sync
```

### Dev server

โปรเจกต์นี้เสิร์ฟผ่าน [portless](https://github.com/vercel-labs/portless) ตาม
มาตรฐานเครื่องพัฒนา (proxy เดียว หน้า URL คงที่ ไม่ชนพอร์ตกันระหว่างหลายโปรเจกต์):

```bash
portless
```

เปิดที่ **https://social-insight.localhost:3443**

ถ้าเครื่องไม่ได้ตั้ง portless ไว้ (เช่น เครื่อง CI หรือเครื่องที่ไม่ใช่เครื่อง dev
หลัก) ใช้ `pnpm dev` แทนได้ตรง ๆ แล้วเปิด `http://localhost:3400` (พอร์ตตั้งตายตัวไว้
ใน [`portless.json`](portless.json) เผื่อใครอยากแชร์ผ่าน LAN ด้วย — ดูหัวข้อถัดไป)

### ให้เครื่องอื่นในวง LAN เดียวกันเข้าถึงได้ (ไม่ต้องตั้ง portless)

ชื่อ `*.localhost` ของ portless ใช้ได้เฉพาะเครื่องที่รัน dev server เอง เครื่องอื่น
ในวง LAN ต้องเข้าผ่าน IP ตรง ๆ:

1. หา IP ของเครื่องที่รัน dev server: `ipconfig` (Windows) มองหา IPv4 ของวง LAN
   ที่ใช้งานจริง (ตัวอย่างในโปรเจกต์นี้: `10.14.4.144`)
2. รัน dev server ตามปกติ (`portless` หรือ `pnpm dev`) — พอร์ตตายตัวคือ `3400`
   ตาม `appPort` ใน `portless.json`
3. เปิด Windows Firewall ให้พอร์ตนั้น (ต้องรันเป็น **Administrator**, จำกัดเฉพาะ
   วง LAN เท่านั้น ไม่เปิดให้ Any):
   ```powershell
   D:\ProjectCode\project-index\open-firewall.ps1
   ```
4. เครื่องอื่นในวงเดียวกันเปิด `http://10.14.4.144:3400` (แทนที่ IP ด้วย IP จริง
   ของเครื่องที่รัน)

---

## คำสั่งที่ใช้บ่อย

```bash
pnpm dev              # dev server ตรง ๆ (ปกติให้เรียกผ่าน portless แทน)
pnpm build            # production build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run
pnpm db:migrate       # prisma migrate dev
pnpm db:studio        # prisma studio — ส่องข้อมูลในตาราง
pnpm db:reset         # drop + migrate + seed ใหม่ทั้งหมด (ล้างข้อมูล!)
pnpm sync             # sync จาก provider ที่ตั้งไว้ใน INSIGHT_PROVIDER
pnpm sync -- --dry    # ดึงข้อมูลแต่ไม่เขียน DB (เช็คว่า provider ต่อได้ก่อนของจริง)
docker compose up -d  # Postgres สำหรับ dev
docker compose down   # ปิด (ข้อมูลยังอยู่ใน volume จนกว่าจะ down -v)
```

ก่อน commit/PR ต้องผ่านทั้งสามอย่าง:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

### รัน sync อัตโนมัติจากภายนอก (เช่น cron)

`POST /api/sync` ทำงานเหมือน `pnpm sync` ทุกอย่าง (เรียก `runSync()` ตัวเดียวกัน)
ต้องแนบ header `x-sync-secret: <ค่าที่ตั้งใน SYNC_SECRET>` — ถ้า `SYNC_SECRET` ว่าง
route นี้จะปิดเอง (คืน 404) ไม่ใช่เปิดแบบไม่ต้อง auth generate ค่าได้ด้วย:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

เพิ่ม `?dry=true` ต่อท้าย URL เพื่อ dry-run แบบเดียวกับ `pnpm sync -- --dry`

---

## ฐานข้อมูล

Postgres รันที่ **พอร์ต 5433** ของ host (ไม่ใช่ 5432 มาตรฐาน) เพื่อไม่ชนกับ
Postgres ที่อาจติดตั้งอยู่บนเครื่องแล้ว (เช่น XAMPP) ข้อมูลเก็บใน docker volume
ชื่อ `social-insight-pgdata` — `docker compose down` ไม่ลบข้อมูล ถ้าอยากล้างจริง ๆ
ต้อง `docker compose down -v`

```
DATABASE_URL="postgresql://social_insight:social_insight@localhost:5433/social_insight?schema=public"
```

### สองเรื่องที่ต้องเข้าใจก่อนแตะ schema

**1. `content_metrics_daily` เป็นยอดสะสม ไม่ใช่ยอดรายวัน**

แถว `(content=X, date=2026-09-07, views=1200)` แปลว่า *"คลิป X มียอดวิวรวมทั้งหมด
1200 ณ สิ้นวันที่ 7 ก.ย."* ไม่ใช่ "วันที่ 7 มีคนดู 1200" ยอดที่เกิดจริงในวันนั้นคือ
`views(7) - views(6)` เรียกว่า **delta** (ดู `lib/metrics/delta.ts`)

เก็บแบบนี้เพราะ (ก) API ต้นทางให้มาแบบนี้ และ (ข) ถ้าเก็บเป็นยอดรายวันแล้ว sync
ขาดไปวันหนึ่ง จะกู้คืนไม่ได้เลย แต่ถ้าเก็บสะสมไว้ ยังคำนวณย้อนหลังได้เสมอ

**ข้อยกเว้น:** `account_metrics_daily` ไม่ได้เป็นสะสม — `followers` เป็นค่า ณ จุดเวลา,
`views`/`reach` เป็นยอดที่เกิดในวันนั้น (ตามที่แพลตฟอร์มรายงานมา) มีคอมเมนต์กำกับไว้
ใน schema แล้ว

**2. ตัวเลขที่คำนวณเองไม่เก็บลง DB**

ER, performance score, velocity คำนวณตอน query ใน `lib/metrics/` เท่านั้น (pure
function ทุกตัว มี unit test คลุม null/หารศูนย์) แก้ `metric_weights` แล้วตัวเลข
ย้อนหลังทั้งหมดเปลี่ยนตาม — ตั้งใจให้เป็นแบบนั้น ในตารางเก็บเฉพาะตัวนับดิบที่
provider ส่งมา

### null ไม่เท่ากับ 0

`reach`, `saves`, `avg_watch_seconds`, `completion_rate` เป็น nullable เพราะบาง
แพลตฟอร์มไม่ให้ข้อมูลนี้ **ห้ามแทนด้วย 0 ทุกกรณี** — 0 กับ "ไม่มีข้อมูล" คนละ
ความหมาย และตัวหารของ ER (`reach` หรือ `views`) ขึ้นกับเรื่องนี้โดยตรง UI ต้องแสดง
`—` พร้อม tooltip บอกว่าแพลตฟอร์มนี้ไม่ให้ข้อมูล

## Timezone

- ทุก timestamp ใน DB เป็น **UTC** (`timestamptz`)
- ทุกอย่างที่ผู้ใช้เห็นเป็น **Asia/Bangkok**
- `snapshot_date` เป็น **วันตามปฏิทิน Asia/Bangkok** เก็บเป็น `date` เฉย ๆ ไม่มีเวลา

แปลงด้วย helper ใน [`lib/datetime.ts`](lib/datetime.ts) เท่านั้น อย่าใช้ `new Date()`
ตรงจุดเรียกใช้ — คอลัมน์ `date` ของ Postgres ไม่มี timezone และ Prisma คืนมาเป็น
UTC midnight ซึ่งจะเพี้ยน 7 ชั่วโมงถ้าตีความผิด

---

## ต่อ Facebook/Instagram/TikTok ของจริง

**อย่าเปลี่ยน `INSIGHT_PROVIDER` จาก `mock`** จนกว่าจะทำครบทุกขั้นตอนของ provider
นั้น และรับรู้ข้อจำกัดที่ระบุไว้ท้ายแต่ละหัวข้อ ทุก endpoint/field/metric ที่โค้ด
เรียกจริงมีลิงก์ docs และวันที่ยืนยันกำกับไว้ใน `lib/providers/<platform>/api-spec.ts`
ของแต่ละตัว — อ่านไฟล์นั้นก่อนเปิดใช้จริงเสมอ ส่วนไหนที่ยืนยันจาก docs ไม่ได้ (โยน
`UnverifiedApiDetailError`) ต้องไปเช็คลิงก์ที่ error บอกก่อน ห้ามแก้โค้ดให้เดาค่าเอง

### Facebook Page

Facebook ใช้ **Meta Graph API** เหมือนกับ Instagram (ดูหัวข้อถัดไป) — ทำ 2 หัวข้อ
นี้ไปพร้อมกันได้ถ้าใช้ Page เดียวกัน

1. **สร้าง Meta App** — ไปที่ [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → Create App → เลือกประเภท "Business" → ตั้งชื่อ จะได้ `App ID` และ `App Secret`
   (หน้า App Dashboard → Settings → Basic)
2. **เพิ่มสิทธิ์ (permissions)** ที่ App Dashboard → App Review → Permissions and
   Features ขอสิทธิ์ที่ต้องใช้:
   - `pages_show_list`, `pages_read_engagement`, `pages_read_user_content` —
     **Standard Access** ใช้ได้ทันทีไม่ต้องรอ App Review
   - `read_insights` — **Advanced Access ต้องผ่าน Meta App Review ก่อน** (ต้องส่ง
     use-case + screencast ให้ Meta ตรวจ อาจใช้เวลาหลายวัน) ถ้ายังไม่ผ่าน จะดึง
     insight ของบัญชีที่ไม่ใช่ admin ของ App เองไม่ได้ — ทดสอบกับ Page ที่ตัวเอง
     เป็น admin ไปก่อนได้โดยไม่ต้องรอ (Meta ให้สิทธิ์ role ของแอปเองใช้ได้เสมอ)
3. **ขอ User Access Token ชั่วคราว** — ที่ [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   เลือก App ที่สร้างไว้ → เลือก permission ตามข้อ 2 → Generate Access Token
   (ได้ token อายุสั้น ~1-2 ชม.)
4. **แลกเป็น long-lived User token** (อายุ ~60 วัน):
   ```
   GET https://graph.facebook.com/v25.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={App ID}
     &client_secret={App Secret}
     &fb_exchange_token={short-lived token จากข้อ 3}
   ```
5. **ขอ Page Access Token** (ใช้ long-lived user token จากข้อ 4 เป็น auth):
   ```
   GET https://graph.facebook.com/v25.0/me/accounts
     ?access_token={long-lived user token}
   ```
   response จะมี `access_token` ต่อ Page ที่ user คนนั้นดูแลอยู่ — **Page token ที่
   ได้จากขั้นตอนนี้ไม่หมดอายุ** (ไม่ต้อง refresh ซ้ำเหมือน user token) เก็บ token นี้
   ไว้ใช้จริง ไม่ใช่ token จากข้อ 3-4
6. **หา Page ID** — อยู่ใน response เดียวกับข้อ 5 (field `id`) หรือดูจาก Page →
   About → Page transparency
7. ใส่ค่าใน `.env`:
   ```
   INSIGHT_PROVIDER="facebook"
   FACEBOOK_APP_ID="..."
   FACEBOOK_APP_SECRET="..."
   FACEBOOK_PAGE_ID="..."
   FACEBOOK_PAGE_ACCESS_TOKEN="..."   # Page token จากข้อ 5 — ไม่ใช่ user token
   ```
8. ทดสอบก่อนด้วย `pnpm sync -- --dry` (ไม่เขียน DB) แล้วค่อย `pnpm sync` จริง

**ข้อควรระวัง:** Meta ลบ/เปลี่ยนชื่อ metric จริงตามกำหนดการ (เช่น `post_impressions_unique`
ถูกลบ 15 มิ.ย. 2025 ใช้ `post_total_media_view_unique` แทน, `page_fans` ถูกลบ
15 พ.ย. 2025 ใช้ `page_follows` แทน — เห็นได้ใน `lib/providers/facebook/api-spec.ts`)
เรียก metric ที่ถูกลบแล้วจะได้ error "invalid metric" ตรง ๆ ไม่ใช่ข้อมูลเปล่า ถ้าเจอ
error แบบนี้ ให้เช็ค [Meta's Graph API Changelog](https://developers.facebook.com/docs/graph-api/changelog)
ก่อนแก้ ห้ามเดาชื่อใหม่เอง

`shares` ที่หายไปทั้ง field (ไม่ใช่ `{count: 0}`) — ทีมตัดสินใจให้ **ถือว่า = 0
แชร์** (ดูคอมเมนต์ที่ `readShareCount` ใน `normalize.ts`) เป็นการตัดสินใจของทีม
ไม่ใช่ข้อเท็จจริงที่ยืนยันจาก Meta เอง

### Instagram Business

Instagram Business account **อ่านผ่าน Graph API ตัวเดียวกับ Facebook** (`graph.facebook.com`
version เดียวกัน) ไม่ใช่ API แยก — ยืนยันจริงจาก example request ใน Instagram
get-started guide

1. Instagram account ต้องเป็น **Instagram Business หรือ Creator account** และ
   **เชื่อมกับ Facebook Page** อยู่แล้ว (ทำได้ที่ Instagram app → Settings →
   Account → Linked Accounts หรือจาก Facebook Page → Settings → Instagram)
2. ทำตามขั้นตอน Facebook ด้านบนทั้งหมด (App เดียวกันได้) แต่เพิ่มสิทธิ์:
   - `instagram_basic` — **Advanced Access ต้องผ่าน App Review**
   - `instagram_manage_insights` — **Advanced Access ต้องผ่าน App Review**
3. Page Access Token จากขั้นตอน Facebook ข้อ 5 **ใช้ตัวเดียวกันได้เลย** ไม่ต้อง
   ขอ token แยกสำหรับ Instagram
4. หา Instagram Business Account ID จาก:
   ```
   GET https://graph.facebook.com/v25.0/{Facebook Page ID}
     ?fields=instagram_business_account
     &access_token={Page access token}
   ```
5. ใส่ค่าใน `.env`:
   ```
   INSIGHT_PROVIDER="instagram"
   INSTAGRAM_PAGE_ID="..."          # Facebook Page ID ที่ต่อ Instagram ไว้ (ไม่ใช่ IG account id)
   INSTAGRAM_ACCESS_TOKEN="..."     # Page access token เดียวกับ Facebook ข้างบน
   ```

**ข้อจำกัดสำคัญ:** `followers_count` เป็น field ปัจจุบัน ณ ตอนนั้น ไม่ใช่
time-series ที่ backfill ย้อนหลังได้ — แต่ละ sync จะได้แค่แถว `account_metrics_daily`
ของ "วันนี้" วันเดียว และ `follower_delta` เป็น `null` เสมอในวันแรกที่ sync (คำนวณ
delta ต้องมีค่าเมื่อวานอยู่ใน DB ก่อน)

### TikTok

TikTok มีหลาย API surface แยกกัน โปรเจกต์นี้เลือกใช้ **"TikTok for Developers"
Login Kit + Display API** (`open.tiktokapis.com/v2`, OAuth login ของบัญชีเอง) ไม่ใช่
TikTok for Business/Marketing API (นั่นเป็น API สำหรับ advertiser/ad account ไม่ใช่
ข้อมูล organic content ของบัญชีตัวเอง) — เหตุผลเต็มอยู่ใน
[`lib/providers/tiktok/api-spec.ts`](lib/providers/tiktok/api-spec.ts)

1. **สมัคร TikTok Developer account** ที่ [developers.tiktok.com](https://developers.tiktok.com/)
   → Manage apps → Create an app
2. **เพิ่ม product "Login Kit"** ให้ app แล้วตั้งค่า:
   - Redirect URI — ต้องเป็น **HTTPS, คงที่ (static), ยาวไม่เกิน 512 ตัวอักษร**
     (ลงทะเบียนได้สูงสุด 10 URI ต่อแอป) — ถ้า dev ผ่าน portless ใช้
     `https://social-insight.localhost:3443/...` ได้ ถ้าไม่มี HTTPS ในเครื่อง ให้ตั้ง
     ชั่วคราวเป็น URL ที่มี HTTPS จริง (เช่น ngrok) เฉพาะตอนขอ token
   - Scopes ที่ต้องขอ: `video.list`, `user.info.basic`, `user.info.stats`
     (`user.info.stats` จำเป็นสำหรับ `follower_count` — ต้องติ๊กตอนสร้าง/แก้ไข
     app ไม่ใช่แค่ตอนเรียก field)
3. **ขอ authorization code** — พา user (เจ้าของบัญชี TikTok ที่จะดึงข้อมูล) ไปที่:
   ```
   https://www.tiktok.com/v2/auth/authorize/
     ?client_key={Client Key}
     &scope=video.list,user.info.basic,user.info.stats
     &redirect_uri={Redirect URI ที่ลงทะเบียนไว้}
     &state={ค่าสุ่มกันเดา}
     &response_type=code
   ```
   หลัง user กด "อนุญาต" จะ redirect กลับไปที่ `redirect_uri` พร้อม query param
   `code=...`
4. **แลก code เป็น access token** (endpoint นี้ยืนยันจาก
   [Access Token Management doc](https://developers.tiktok.com/doc/oauth-user-access-token-management)):
   ```
   POST https://open.tiktokapis.com/v2/oauth/token/
   Content-Type: application/x-www-form-urlencoded

   client_key={Client Key}
   &client_secret={Client Secret}
   &code={code จากข้อ 3 — ต้อง URL-decode ก่อน}
   &grant_type=authorization_code
   &redirect_uri={Redirect URI เดียวกับข้อ 3}
   ```
   response ที่ได้มี `access_token`, `refresh_token`, `expires_in` (วินาที),
   `refresh_expires_in` (วินาที) — **access token อายุประมาณ 24 ชั่วโมง**,
   **refresh token อายุประมาณ 365 วัน**
5. ใส่ `access_token` จากข้อ 4 ใน `.env`:
   ```
   INSIGHT_PROVIDER="tiktok"
   TIKTOK_ACCESS_TOKEN="..."
   ```

**ข้อควรระวังก่อนใช้จริง — สำคัญกว่า Facebook/Instagram:**
- โปรเจกต์นี้**ไม่ได้ implement refresh flow อัตโนมัติ** — token จากข้อ 4 หมดอายุ
  ใน ~24 ชม. ต้องทำข้อ 3-4 ซ้ำเองเป็นระยะ (token หมดอายุจะทำให้ sync fail ด้วย
  401 ชัดเจน ไม่ใช่ค้างเงียบ ๆ) ถ้าจะใช้ยาว ควรเขียน refresh flow เพิ่มก่อน (ใช้
  `refresh_token` แลก `access_token` ใหม่ได้โดยไม่ต้องให้ user login ซ้ำ — endpoint
  หน้าเดียวกับข้อ 4 แต่ `grant_type=refresh_token`) — ยังไม่ได้เขียนในโปรเจกต์นี้
- งานวิจัย docs ของ TikTok (ทำเมื่อ 2026-09-07) ยืนยันได้ไม่แน่นเท่า Facebook/Instagram
  — เว็บ docs หลักเป็น JS-rendered อ่านตรงไม่ได้ ผลค้นหาหลายอันขัดแย้งกันเองก่อนจะ
  เจอหน้าที่ยืนยันได้ชัด อ่าน `UNVERIFIED` ทั้งหมดใน
  [`lib/providers/tiktok/api-spec.ts`](lib/providers/tiktok/api-spec.ts) ก่อนใช้จริง โดยเฉพาะ:
  - ไม่มี metric ไหนยืนยันได้สำหรับ reach/saves/avg watch time/completion rate —
    ค่าพวกนี้เป็น `null` เสมอ ไม่ใช่ปัดเป็น 0
  - ทุกคอนเทนต์ถูกจัดเป็น `video` เสมอ (ไม่พบ field แยกโพสต์แบบ "photo mode")
  - สิทธิ์/App Review requirement ของ scope พวกนี้สำหรับ production app (เกิน
    sandbox testing) **ยังไม่ได้ยืนยันจาก docs** — เจอเฉพาะหน้าที่อธิบาย OAuth
    flow เอง ไม่ได้บอกเรื่อง review requirement ต่อ scope ถ้า production app ถูก
    ปฏิเสธ scope ไหน ให้เช็ค [TikTok for Developers docs](https://developers.tiktok.com/)
    หน้า scope นั้นโดยตรง ห้ามเดา

---

## กฎที่ห้ามแหก

ดูฉบับเต็มใน [`CLAUDE.md`](CLAUDE.md) — สรุปสั้น ๆ:

1. ห้ามเดาชื่อ metric/endpoint ของ Facebook/Instagram/TikTok API จากความจำ
2. ห้ามเขียนโค้ดที่ต้องมี API credential จริงจึงจะรันได้ — ทุกอย่างต้องรันได้ด้วย `MockProvider`
3. ห้ามแสดง 0 แทน null
4. ห้ามเทียบตัวเลขข้ามแพลตฟอร์มโดยไม่บอกผู้ใช้
5. ห้าม commit token/secret — ทุก secret อ่านจาก env เท่านั้น
6. ห้าม migrate schema แบบทำลายข้อมูลโดยไม่ถาม

## สิ่งที่ยังไม่ตัดสินใจ (อย่าเดาต่อ ให้ถามทีมก่อน)

- ระบบ auth/SSO ของบริษัท — ยังไม่มี auth เลยในแอปนี้ (`updatedBy` ในทุก action
  hardcode ไว้เป็น string คงที่ ไม่ใช่ user จริง)
- จะ deploy ที่ไหน
- จะเชื่อมข้อมูล ads spend ด้วยไหม
- น้ำหนัก metric สุดท้ายที่ marketing ต้องการ (ใช้ default ไปก่อน ปรับได้ที่หน้า
  Settings)

---

## โครงสร้างโค้ด

```
app/
  page.tsx              Overview — กำลังมา / Top 10 / ต่ำกว่าปกติ
  content/               รายการ content ทั้งหมด, filter, export
  goals/                 ตั้งเป้าหมาย engagement/ยอดสมัคร course รายเดือน
  settings/              ปรับน้ำหนัก metric (likeWeight ฯลฯ)
  api/sync/              cron-triggered sync (ดู "รัน sync อัตโนมัติ" ด้านบน)
  api/content/export/    export ข้อมูล content
components/              UI components (แยกตามหน้า)
lib/
  datetime.ts            UTC <-> Asia/Bangkok, snapshot_date helpers
  db.ts                  prisma client (singleton, hot-reload safe)
  env.ts                 zod-validated environment
  form-action-state.ts   ชนิด return ของ Server Action ที่ผูกกับ useActionState
  providers/             InsightProvider interface + implementations
    meta/                 graph client + insights parser ที่ Facebook/Instagram ใช้ร่วมกัน
    facebook/              api-spec (endpoint/metric ที่ยืนยันแล้ว + UNVERIFIED), normalize + tests
    instagram/             api-spec, normalize + tests
    tiktok/                client แยกต่างหาก (shape ต่าง Meta), api-spec, normalize + tests
  metrics/               การคำนวณทั้งหมด (pure function, unit test ครบ null/หารศูนย์)
  sync/                  sync engine, upsert, sync_runs logging
  queries/               read layer สำหรับ UI (ชั้นเดียวที่แตะ Prisma ได้)
prisma/
  schema.prisma          data model + คอมเมนต์อธิบายกฎสะสม/nullable
  migrations/
  seed.ts                metric_weights แถว default
scripts/
  sync.ts                CLI entrypoint ของ pnpm sync
```

**แนวคิดหลักที่ต้องรู้ก่อนแก้โค้ด:** `lib/metrics/` เป็น pure function ล้วน ห้ามแตะ
Prisma/I-O ตรงนั้น — ถ้าต้องอ่าน DB ให้ทำใน `lib/queries/` แล้วส่งข้อมูลธรรมดาเข้า
`lib/metrics/` แทน (โครงนี้ทำให้ทุกฟังก์ชันคำนวณ test ได้โดยไม่ต้องมี DB จริง)

---

## ปัญหาที่เจอบ่อย

**`docker compose up -d` ฟ้องว่าต่อ daemon ไม่ได้**
เปิด Docker Desktop ก่อน แล้วรอจน daemon ขึ้น (`docker info` ต้องไม่ error)

**Docker Desktop เปิดแล้วเด้ง error ทันที "initializing Ingest server ... sailor-ingest.sock: The file cannot be accessed by the system"**
เป็น socket file ค้างจากครั้งที่ Docker ถูก kill ไม่สวย อยู่ที่
`%LOCALAPPDATA%\Docker\run\` (`sailor-ingest.sock`, `userAnalyticsOtlpHttp.sock`,
`dockerInference`, `dockerEthernetVfkit`) ไฟล์พวกนี้ลบไม่ได้แม้ปิด Docker หมดแล้ว
หรือสั่ง `wsl --shutdown` เพราะ kernel ยังจองอยู่ — **ต้อง reboot เครื่อง** หลัง
reboot Docker จะสร้างใหม่เองแล้วเปิดได้ปกติ

**`pnpm install` ฟ้อง `ERR_PNPM_IGNORED_BUILDS`**
pnpm 10+ บล็อก postinstall script โดย default รายการที่อนุญาตอยู่ใน
`pnpm-workspace.yaml` ใต้ `allowBuilds` แล้ว ถ้ายังฟ้องให้ลบ `node_modules` กับ
`pnpm-lock.yaml` แล้วติดตั้งใหม่

**`pnpm db:migrate` ต่อฐานข้อมูลไม่ได้**
เช็คว่า container ขึ้นแล้วและ healthy: `docker compose ps` แล้วเช็คว่า
`DATABASE_URL` ใน `.env` ชี้พอร์ต 5433

**เปลี่ยน `INSIGHT_PROVIDER` เป็น facebook/instagram/tiktok แล้ว sync fail**
เช็ค error message ก่อน — ถ้าเป็น `UnverifiedApiDetailError` แปลว่ามีรายละเอียดที่
ยังไม่ยืนยันจาก docs ตามลิงก์ที่ error บอก (ห้ามแก้โค้ดให้เดาค่าเอง) ถ้าเป็น
"invalid metric" จาก Meta แปลว่า metric นั้นถูก deprecate แล้ว เช็ค
[Graph API Changelog](https://developers.facebook.com/docs/graph-api/changelog)
ถ้าเป็น 401 จาก TikTok มักเป็นเพราะ access token หมดอายุ (~24 ชม.) ต้องขอใหม่ตาม
ขั้นตอนใน [TikTok section](#tiktok) ด้านบน
