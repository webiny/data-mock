import { createTheme } from "@mantine/core";
import { tokens } from "./tokens.js";

export const theme = createTheme({
  primaryColor: "orange",
  defaultRadius: "md",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  spacing: {
    xs: `${tokens.spacing.xs}px`,
    sm: `${tokens.spacing.sm}px`,
    md: `${tokens.spacing.md}px`,
    lg: `${tokens.spacing.lg}px`,
    xl: `${tokens.spacing.xl}px`,
  },
});
