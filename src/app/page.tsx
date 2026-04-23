import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Landing() {
  const { userId } = await auth();
  if (userId) redirect("/app");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-neutral-900">PAAI Sales CMS</h1>
        <p className="mt-2 text-sm text-neutral-600">Sign in to continue.</p>
      </div>
      <SignIn routing="hash" forceRedirectUrl="/app" signUpForceRedirectUrl="/app" />
    </main>
  );
}
