"use client";

export default function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-5 right-5 bg-[var(--accent)] text-white px-5 py-2.5 rounded-md text-xs z-[200] animate-fade-in">
      {message}
    </div>
  );
}
