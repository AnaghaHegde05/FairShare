import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../context/AuthContext";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import ErrorBanner from "../components/ui/ErrorBanner";
import AuthLayout from "../components/AuthLayout";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Enter your name";
    if (!USERNAME_PATTERN.test(username.trim())) {
      errors.username =
        "3-20 characters — letters, numbers, and underscores only";
    }
    if (password.length < 8) errors.password = "Must be at least 8 characters";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const user = await signup(name.trim(), username.trim(), password);
      navigate(user.householdId ? "/chores" : "/household", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't create your account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking who's actually doing the dishes."
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <ErrorBanner message={formError} />
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
        />
        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          error={fieldErrors.username}
          placeholder="e.g. anagha05"
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          placeholder="At least 8 characters"
        />
        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-pine hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
