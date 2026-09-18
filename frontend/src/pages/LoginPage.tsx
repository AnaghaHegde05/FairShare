import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../context/AuthContext";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";
import AuthLayout from "../components/AuthLayout";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAccountNotFound(false);

    if (!username || !password) {
      setFormError("Username and password are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      navigate(user.householdId ? "/chores" : "/household", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't log you in");
      // The backend uses 404 specifically for "no account with this
      // username" (as opposed to 401 for a wrong password) — see
      // POST /api/auth/login.
      setAccountNotFound(err instanceof ApiError && err.status === 404);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see where things stand.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={formError} />
        {accountNotFound && (
          <p className="text-sm text-muted">
            <Link to="/signup" className="font-semibold text-pine hover:underline">
              Create an account
            </Link>{" "}
            with this username instead.
          </p>
        )}
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-pine hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
