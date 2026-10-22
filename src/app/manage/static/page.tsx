import { redirect } from 'next/navigation'
export default async function LegacyPages({ searchParams }: { searchParams: Promise<{ tab?: string }> }) { redirect((await searchParams).tab === 'sites' ? '/manage/static-sites' : '/manage/pages') }
