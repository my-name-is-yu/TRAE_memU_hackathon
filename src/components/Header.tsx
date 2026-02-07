"use client";

import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-ink text-surface border-b-2 border-ink shadow-step">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-wide">
          TripMemo
        </Link>
        <p className="text-sm text-mustard tracking-wide">AIで旅程をスマートに管理</p>
      </div>
    </header>
  );
}
