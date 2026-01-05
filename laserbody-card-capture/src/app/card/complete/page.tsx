import { CheckCircle2, Lock } from "lucide-react";

// ✅ Prevent build-time prerender for this page
export const dynamic = "force-dynamic";

type Props = {
  searchParams?: { captureId?: string };
};

export default function CardCompletePage({ searchParams }: Props) {
  const captureId = searchParams?.captureId ?? null;

  return (
    <div className="fixed inset-0 bg-zinc-950 text-zinc-100 grid place-items-center px-6">
      <div className="w-full max-w-xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-[0_20px_80px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="p-8 sm:p-10 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-400">
                  LaserbodyMD
                </div>

                <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
                  Thank you!
                </h1>

                <p className="mt-3 text-sm text-zinc-300 leading-relaxed max-w-md">
                  Your card has been securely saved on file. You can close this tab now.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300">
                <Lock className="h-4 w-4" />
                <span>Encrypted</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-zinc-100">
                    Card capture complete
                  </div>
                  <div className="mt-1 text-xs text-zinc-300">
                    LaserbodyMD does not see or store your full card number.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 sm:px-10 py-6 border-t border-zinc-800">
            <div className="flex items-end justify-end">
              {captureId ? (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Reference ID
                  </div>
                  <div className="mt-1 font-mono text-xs text-zinc-300 break-all">
                    {captureId}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          If you have any questions, please contact the clinic.
        </p>
      </div>
    </div>
  );
}
