export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen min-h-dvh w-full flex-col bg-[#F4EFE6]">
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
