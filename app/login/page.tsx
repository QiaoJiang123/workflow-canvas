import { LoginPage } from "@/components/login-page";

export default function Login({ searchParams }: { searchParams?: { next?: string } }) {
  return <LoginPage next={searchParams?.next ?? "/workflows"} />;
}

