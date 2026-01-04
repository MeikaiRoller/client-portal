export default function CardCompletePage({ searchParams }: { searchParams: { captureId?: string } }) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Card capture complete</h1>
      <p>Thanks! You can close this tab.</p>
      <pre>captureId: {searchParams?.captureId ?? "(none)"}</pre>
    </main>
  );
}
