export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div role="status" className="flex flex-col items-center gap-3">
        <span aria-hidden="true" className="size-7 animate-spin rounded-full border-2 border-rule border-t-accent" />
        <span className="text-sm text-fg-2">Carregando tela...</span>
      </div>
    </div>
  );
}
