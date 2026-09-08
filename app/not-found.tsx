import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/shared/EmptyState";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-[900px] px-[var(--space-2xl)] py-[var(--space-3xl)]">
      <EmptyState
        icon={Compass}
        title="ไม่พบหน้านี้"
        description="ลิงก์อาจผิดพลาด หรือคอนเทนต์นี้ไม่มีอยู่ในระบบ"
      />
      <div className="mt-[var(--space-xl)] text-center">
        <Link
          href="/"
          className="cursor-pointer text-[13px] font-medium text-[var(--accent-ink)] hover:underline"
        >
          กลับไปหน้า Overview
        </Link>
      </div>
    </main>
  );
}
