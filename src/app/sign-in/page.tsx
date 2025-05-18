import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#4facfe",
          },
          elements: {
            // Light mode styles (default)
            formButtonPrimary: {
              backgroundColor: "#4facfe",
              "&:hover": {
                backgroundColor: "#357abd"
              }
            },
            card: {
              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
            },
            input: {
              border: "1px solid rgba(0, 0, 0, 0.1)"
            },
            // Dark mode styles
            "formButtonPrimary.dark": {
              backgroundColor: "#4facfe",
              "&:hover": {
                backgroundColor: "#357abd"
              }
            },
            "card.dark": {
              backgroundColor: "#0d0d0d", 
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)"
            },
            "input.dark": {
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              color: "#ededed"
            }
          }
        }}
      />
    </div>
  );
}