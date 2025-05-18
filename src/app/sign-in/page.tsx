import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          baseTheme: dark,
          variables: {
            colorBackground: "#0a0a0a",
            colorPrimary: "#4facfe",
            colorText: "#ededed",
            colorInputBackground: "rgba(255, 255, 255, 0.05)",
          },
          elements: {
            formButtonPrimary: {
              backgroundColor: "#4facfe",
              "&:hover": {
                backgroundColor: "#357abd"
              }
            },
            card: {
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)"
            },
            input: {
              border: "1px solid rgba(255, 255, 255, 0.1)"
            }
          }
        }}
      />
    </div>
  );
}