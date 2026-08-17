import { redirect } from "next/navigation";

export default async function AtelierPage({
  searchParams,
}: {
  searchParams: Promise<{ replace?: string }>;
}) {
  const params = await searchParams;
  redirect(params.replace ? `/avatar-new?replace=${params.replace}` : "/avatar-new");
}
