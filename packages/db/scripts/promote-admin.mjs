const email = process.argv
  .slice(2)
  .find((arg) => arg !== "--" && !arg.startsWith("-"));

if (!email) {
  console.error("Usage: pnpm promote-admin <email>");
  console.error(
    "Sign up first at /signup, then run this while `pnpm dev` is running."
  );
  process.exit(1);
}

const response = await fetch("http://localhost:3000/_dev/promote-admin", {
  body: JSON.stringify({ email }),
  headers: {
    "content-type": "application/json",
  },
  method: "POST",
});

const payload = await response.json().catch(() => null);

if (!response.ok) {
  console.error(
    payload?.message ?? `Promote failed with status ${response.status}.`
  );
  process.exit(1);
}

console.log(`Promoted ${payload.email} to ${payload.role}.`);
