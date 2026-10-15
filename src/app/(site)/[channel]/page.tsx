import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelListView } from "@/components/ChannelListView";
import { getChannelBySlug, listChannels } from "@/lib/repo";
import { channelUrl } from "@/lib/urls";

export const revalidate = 120;

type Props = { params: Promise<{ channel: string }> };

export async function generateStaticParams() {
  return (await listChannels()).map((c) => ({ channel: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getChannelBySlug((await params).channel);
  if (!c) return {};
  return {
    title: `${c.name}频道`,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: channelUrl(c) },
    openGraph: { type: "website", title: `${c.name}频道`, description: c.description, url: channelUrl(c) },
  };
}

export default async function ChannelPage({ params }: Props) {
  const c = await getChannelBySlug((await params).channel);
  if (!c) notFound();
  return <ChannelListView channel={c} page={1} />;
}
