import { redirect } from "next/navigation";
import { db } from "@/db";
import { authUsers, authAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import Link from "next/link";

export default function SignUpPage() {
  async function handleSignUp(formData: FormData) {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = formData.get("name") as string;

    if (!email || !password || !name) {
      redirect("/sign-up?error=MissingFields");
    }

    if (password.length < 6) {
      redirect("/sign-up?error=PasswordTooShort");
    }

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      redirect("/sign-up?error=EmailExists");
    }

    // Create auth user
    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    await db.insert(authUsers).values({
      id: userId,
      email: email.toLowerCase().trim(),
      name: name.trim(),
    });

    await db.insert(authAccounts).values({
      userId,
      type: "credentials",
      provider: "credentials",
      providerAccountId: email.toLowerCase().trim(),
      access_token: passwordHash,
    });

    redirect("/sign-in?registered=true");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)]">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-surface)] p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-accent)]">
            LeadSens
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Create your account
          </p>
        </div>

        <form action={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm text-[var(--color-text-secondary)]">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Martin Paviot"
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm text-[var(--color-text-secondary)]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-[var(--color-text-secondary)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="Min 6 characters"
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-base)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-[var(--color-text-tertiary)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
