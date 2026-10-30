import { AuthForm } from './AuthForm';

function safeRedirect(value: string | string[] | undefined): string {
  const target = Array.isArray(value) ? value[0] : value;
  return target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')
    ? target
    : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AuthForm redirectTo={safeRedirect(params.redirect)} />;
}
