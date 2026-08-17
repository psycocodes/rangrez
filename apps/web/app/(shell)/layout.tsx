export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#F4EFE6]">
      <main className="min-h-0 flex-1 overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}
